"""
API routes for dataset generation and management
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any
from pydantic import BaseModel
import uuid
import json

from core.models import Dataset, AttackType, GroundTruthExample, TargetConfig
from dataset.generator import DatasetGenerator
from dataset.ai_generator import AIDatasetGenerator
from core.database import get_db
from sqlalchemy.orm import Session
from core.db_models import DBDataset, DBBot

router = APIRouter()
generator = DatasetGenerator()
ai_generator = AIDatasetGenerator()

class DatasetGenerateRequest(BaseModel):
    target_id: str
    attack_types: List[str]
    num_examples_per_type: int = 10
    use_ai_generation: bool = True  # Use AI by default for contextual attacks

class CustomScenarioRequest(BaseModel):
    target_id: str
    scenarios: List[Dict[str, Any]]

class OWASPDatasetRequest(BaseModel):
    target_id: str
    owasp_categories: List[str]  # e.g., ["ASI01", "ASI09"]
    num_examples_per_category: int = 5

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

@router.post("/generate", response_model=Dataset)
async def generate_dataset(request: DatasetGenerateRequest, db: Session = Depends(get_db)):
    """Generate a ground truth dataset for testing"""

    bot = db.query(DBBot).filter(DBBot.id == request.target_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Target not found")
        
    target = _get_target_config_from_db(bot)

    # Convert string attack types to enum
    attack_types = [AttackType(at) for at in request.attack_types]

    # Generate dataset using AI or templates
    if request.use_ai_generation:
        print(f"[DATASET API] Generating AI-powered dataset for {target.name}")
        dataset = await ai_generator.generate_ai_dataset(
            target,
            attack_types,
            request.num_examples_per_type,
            include_owasp_context=True
        )
    else:
        print(f"[DATASET API] Generating template-based dataset for {target.name}")
        dataset = generator.generate_dataset(
            target,
            attack_types,
            request.num_examples_per_type
        )
        
    # Serialize examples for JSON column
    examples_dicts = [ex.model_dump() for ex in dataset.examples]

    db_ds = DBDataset(
        id=dataset.id,
        name=dataset.name,
        description=dataset.description,
        target_purpose=dataset.target_purpose,
        examples=examples_dicts,
        created_at=dataset.created_at,
        version=dataset.version
    )
    db.add(db_ds)
    db.commit()
    db.refresh(db_ds)

    print(f"[DATASET API] Dataset stored with ID {dataset.id}, {len(dataset.examples)} examples")

    return dataset

@router.post("/generate/custom", response_model=Dataset)
async def generate_custom_dataset(request: CustomScenarioRequest, db: Session = Depends(get_db)):
    """Generate dataset from custom scenarios"""

    bot = db.query(DBBot).filter(DBBot.id == request.target_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Target not found")
        
    target = _get_target_config_from_db(bot)

    dataset = generator.generate_custom_scenarios(target, request.scenarios)
    
    examples_dicts = [ex.model_dump() for ex in dataset.examples]
    db_ds = DBDataset(
        id=dataset.id,
        name=dataset.name,
        description=dataset.description,
        target_purpose=dataset.target_purpose,
        examples=examples_dicts,
        created_at=dataset.created_at,
        version=dataset.version
    )
    db.add(db_ds)
    db.commit()

    return dataset

@router.post("/generate/chains", response_model=Dataset)
async def generate_attack_chains(
    target_id: str,
    attack_type: str,
    num_chains: int = 5,
    db: Session = Depends(get_db)
):
    """Generate progressive attack chains for sequential testing"""

    bot = db.query(DBBot).filter(DBBot.id == target_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Target not found")
        
    target = _get_target_config_from_db(bot)

    dataset = generator.generate_progressive_attack_chains(
        target,
        AttackType(attack_type),
        num_chains
    )

    examples_dicts = [ex.model_dump() for ex in dataset.examples]
    db_ds = DBDataset(
        id=dataset.id,
        name=dataset.name,
        description=dataset.description,
        target_purpose=dataset.target_purpose,
        examples=examples_dicts,
        created_at=dataset.created_at,
        version=dataset.version
    )
    db.add(db_ds)
    db.commit()

    return dataset

@router.get("/", response_model=List[Dataset])
async def list_datasets(db: Session = Depends(get_db)):
    """List all datasets"""
    db_datasets = db.query(DBDataset).all()
    results = []
    for db_ds in db_datasets:
        ds_dict = {
            "id": db_ds.id,
            "name": db_ds.name,
            "description": db_ds.description,
            "target_purpose": db_ds.target_purpose,
            "created_at": db_ds.created_at,
            "version": db_ds.version,
            "examples": [GroundTruthExample(**ex) for ex in db_ds.examples] if db_ds.examples else []
        }
        results.append(Dataset(**ds_dict))
    return results

@router.get("/{dataset_id}", response_model=Dataset)
async def get_dataset(dataset_id: str, db: Session = Depends(get_db)):
    """Get a specific dataset"""

    db_ds = db.query(DBDataset).filter(DBDataset.id == dataset_id).first()
    if not db_ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

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

@router.delete("/{dataset_id}")
async def delete_dataset(dataset_id: str, db: Session = Depends(get_db)):
    """Delete a dataset"""

    db_ds = db.query(DBDataset).filter(DBDataset.id == dataset_id).first()
    if not db_ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

    db.delete(db_ds)
    db.commit()

    return {"message": "Dataset deleted"}

@router.post("/generate/owasp", response_model=Dataset)
async def generate_owasp_dataset(request: OWASPDatasetRequest, db: Session = Depends(get_db)):
    """Generate dataset focused on specific OWASP Agentic AI vulnerabilities"""

    bot = db.query(DBBot).filter(DBBot.id == request.target_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Target not found")
        
    target = _get_target_config_from_db(bot)

    print(f"[DATASET API] Generating OWASP-focused dataset for {target.name}")
    print(f"[DATASET API] OWASP categories: {request.owasp_categories}")

    dataset = await ai_generator.generate_owasp_focused_dataset(
        target,
        request.owasp_categories,
        request.num_examples_per_category
    )

    examples_dicts = [ex.model_dump() for ex in dataset.examples]
    db_ds = DBDataset(
        id=dataset.id,
        name=dataset.name,
        description=dataset.description,
        target_purpose=dataset.target_purpose,
        examples=examples_dicts,
        created_at=dataset.created_at,
        version=dataset.version
    )
    db.add(db_ds)
    db.commit()
    print(f"[DATASET API] OWASP dataset stored with ID {dataset.id}, {len(dataset.examples)} examples")

    return dataset

@router.get("/owasp/categories")
async def list_owasp_categories():
    """List available OWASP Agentic AI categories"""
    return {
        "categories": [
            {"code": code, "name": info["name"], "description": info["description"]}
            for code, info in ai_generator.owasp_mappings.items()
        ]
    }
