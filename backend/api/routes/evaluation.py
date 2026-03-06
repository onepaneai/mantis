"""
API routes for evaluation
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict
from pydantic import BaseModel
import uuid

from core.models import EvaluationReport, TargetConfig, Dataset, GroundTruthExample, EvaluationMetrics
from evaluation.evaluator import SecurityEvaluator
from core.database import get_db
from sqlalchemy.orm import Session
from core.db_models import DBEvaluationReport, DBBot, DBDataset

router = APIRouter()
evaluator = SecurityEvaluator()

class EvaluationRequest(BaseModel):
    target_id: str
    dataset_id: str

def _get_target_config_from_db(db_bot: DBBot) -> TargetConfig:
    tc_dict = {
        "id": db_bot.id,
        "name": db_bot.name,
        "description": db_bot.description,
        "purpose": db_bot.purpose,
        "context": db_bot.context,
        "target_type": db_bot.target_type,
        "endpoint": db_bot.endpoint,
        "method": db_bot.method,
        "headers": db_bot.headers if db_bot.headers else {},
        "auth": db_bot.auth,
        "url": db_bot.url,
        "selector": db_bot.selector,
        "expected_restrictions": db_bot.expected_restrictions if db_bot.expected_restrictions else [],
        "prohibited_topics": db_bot.prohibited_topics if db_bot.prohibited_topics else [],
        "created_at": db_bot.created_at
    }
    return TargetConfig(**tc_dict)

def _get_dataset_from_db(db_ds: DBDataset) -> Dataset:
    ds_dict = {
        "id": db_ds.id,
        "name": db_ds.name,
        "description": db_ds.description,
        "target_purpose": db_ds.target_purpose,
        "created_at": db_ds.created_at,
        "version": db_ds.version,
        "examples": [GroundTruthExample(**ex) for ex in db_ds.examples] if db_ds.examples else []
    }
    return Dataset(**ds_dict)

@router.post("/run", response_model=EvaluationReport)
async def run_evaluation(request: EvaluationRequest, db: Session = Depends(get_db)):
    """Run security evaluation with a dataset"""

    db_bot = db.query(DBBot).filter(DBBot.id == request.target_id).first()
    if not db_bot:
        raise HTTPException(status_code=404, detail="Target not found")
    target = _get_target_config_from_db(db_bot)

    db_ds = db.query(DBDataset).filter(DBDataset.id == request.dataset_id).first()
    if not db_ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    dataset = _get_dataset_from_db(db_ds)

    # Run evaluation
    report = await evaluator.evaluate_with_dataset(target, dataset)

    # Store in DB
    metrics_dict = report.metrics.model_dump() if report.metrics else None
    detailed_results_dicts = [r.model_dump() for r in report.detailed_results] if report.detailed_results else []

    db_report = DBEvaluationReport(
        id=report.id,
        target_id=report.target_id,
        dataset_id=report.dataset_id,
        started_at=report.started_at,
        completed_at=report.completed_at,
        metrics=metrics_dict,
        detailed_results=detailed_results_dicts,
        recommendations=report.recommendations,
        summary=report.summary
    )
    db.add(db_report)
    db.commit()
    db.refresh(db_report)

    return report

@router.get("/", response_model=List[EvaluationReport])
async def list_evaluations(db: Session = Depends(get_db)):
    """List all evaluation reports"""
    db_reports = db.query(DBEvaluationReport).all()
    results = []
    for db_rep in db_reports:
        # Reconstruct EvaluationMetrics
        metrics = EvaluationMetrics(**db_rep.metrics) if db_rep.metrics else None
        
        rep_dict = {
            "id": db_rep.id,
            "target_id": db_rep.target_id,
            "dataset_id": db_rep.dataset_id,
            "started_at": db_rep.started_at,
            "completed_at": db_rep.completed_at,
            "metrics": metrics,
            "detailed_results": db_rep.detailed_results if db_rep.detailed_results else [],
            "recommendations": db_rep.recommendations if db_rep.recommendations else [],
            "summary": db_rep.summary if db_rep.summary else ""
        }
        # In this reconstruction, detailed_results is a list of dicts.
        # It gets cast via Pydantic on assignment to EvaluationReport.
        results.append(EvaluationReport(**rep_dict))
    
    return results

@router.get("/{evaluation_id}", response_model=EvaluationReport)
async def get_evaluation(evaluation_id: str, db: Session = Depends(get_db)):
    """Get a specific evaluation report"""

    db_rep = db.query(DBEvaluationReport).filter(DBEvaluationReport.id == evaluation_id).first()
    if not db_rep:
        raise HTTPException(status_code=404, detail="Evaluation not found")

    metrics = EvaluationMetrics(**db_rep.metrics) if db_rep.metrics else None
        
    rep_dict = {
        "id": db_rep.id,
        "target_id": db_rep.target_id,
        "dataset_id": db_rep.dataset_id,
        "started_at": db_rep.started_at,
        "completed_at": db_rep.completed_at,
        "metrics": metrics,
        "detailed_results": db_rep.detailed_results if db_rep.detailed_results else [],
        "recommendations": db_rep.recommendations if db_rep.recommendations else [],
        "summary": db_rep.summary if db_rep.summary else ""
    }
    return EvaluationReport(**rep_dict)
