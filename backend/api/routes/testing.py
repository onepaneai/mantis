from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, Request
from core.auth import require_role
from core.db_models import User
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import uuid

from core.models import UseCase, TestCase, TestExecutionResult, TestSuite, UseCaseExport
from core.database import get_db
from sqlalchemy.orm import Session
from core.db_models import DBUseCase, DBTestCase, DBTestExecutionResult, DBBot, DBTestSuite
from core.ai_usecase_generator import generate_use_cases_with_ai

router = APIRouter()

# --- Test Suites ---

@router.post("/suites", response_model=TestSuite)
async def create_test_suite(
    suite: TestSuite, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["owner", "member"]))
):
    if not suite.id:
        suite.id = str(uuid.uuid4())
        
    db_suite = DBTestSuite(
        id=suite.id,
        bot_id=suite.bot_id,
        project_id=suite.project_id,
        name=suite.name,
        description=suite.description,
        created_at=suite.created_at
    )
    db.add(db_suite)
    db.commit()
    db.refresh(db_suite)
    return suite

@router.get("/suites/{bot_id}", response_model=List[TestSuite])
async def list_test_suites(bot_id: str, project_id: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(DBTestSuite).filter(DBTestSuite.bot_id == bot_id)
    if project_id:
        query = query.filter(DBTestSuite.project_id == project_id)
    
    suites = query.all()
    return [
        TestSuite(
            id=s.id, bot_id=s.bot_id, project_id=s.project_id, name=s.name, 
            description=s.description, created_at=s.created_at
        ) for s in suites
    ]

@router.delete("/suites/{suite_id}")
async def delete_test_suite(
    suite_id: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["owner", "member"]))
):
    suite = db.query(DBTestSuite).filter(DBTestSuite.id == suite_id).first()
    if not suite:
        raise HTTPException(status_code=404, detail="Test Suite not found")
        
    db.query(DBTestExecutionResult).filter(DBTestExecutionResult.test_suite_id == suite_id).delete()
    db.delete(suite)
    db.commit()
    return {"message": "Test Suite and associated executions deleted successfully"}

# --- Use Cases ---

@router.post("/usecases", response_model=UseCase)
async def create_use_case(
    use_case: UseCase, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["owner", "member"]))
):
    if not use_case.id:
        use_case.id = str(uuid.uuid4())
        
    count = db.query(DBUseCase).filter(DBUseCase.bot_id == use_case.bot_id).count()
    vid = f"UC-{count + 1}"
    use_case.visual_id = vid
        
    db_uc = DBUseCase(
        id=use_case.id,
        bot_id=use_case.bot_id,
        project_id=use_case.project_id,
        visual_id=vid,
        name=use_case.name,
        description=use_case.description,
        created_at=use_case.created_at
    )
    db.add(db_uc)
    db.commit()
    db.refresh(db_uc)
    return use_case

@router.get("/usecases/{bot_id}", response_model=List[UseCase])
async def list_use_cases(bot_id: str, project_id: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(DBUseCase).filter(DBUseCase.bot_id == bot_id)
    if project_id:
        query = query.filter(DBUseCase.project_id == project_id)
        
    ucs = query.all()
    return [
        UseCase(
            id=uc.id, bot_id=uc.bot_id, project_id=uc.project_id, visual_id=uc.visual_id, name=uc.name, 
            description=uc.description, created_at=uc.created_at
        ) for uc in ucs
    ]

@router.get("/usecases/{bot_id}/export", response_model=List[UseCaseExport])
async def export_use_cases(bot_id: str, project_id: Optional[str] = None, db: Session = Depends(get_db)):
    """Fetch all use cases and their associated test cases for PDF export"""
    # Verify bot
    bot = db.query(DBBot).filter(DBBot.id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Target not found")
        
    query = db.query(DBUseCase).filter(DBUseCase.bot_id == bot_id)
    if project_id:
        query = query.filter(DBUseCase.project_id == project_id)
        
    ucs = query.all()
    
    result = []
    for uc in ucs:
        # DB relationships allow us to access uc.test_cases
        tc_list = [
            TestCase(
                id=tc.id,
                use_case_id=tc.use_case_id,
                visual_id=tc.visual_id,
                name=tc.name,
                description=tc.description,
                input_prompt=tc.input_prompt,
                expected_output=tc.expected_output,
                manual_ground_truth=tc.manual_ground_truth,
                created_at=tc.created_at
            ) for tc in uc.test_cases
        ]
        
        result.append(
            UseCaseExport(
                id=uc.id, bot_id=uc.bot_id, project_id=uc.project_id, visual_id=uc.visual_id, 
                name=uc.name, description=uc.description, created_at=uc.created_at,
                test_cases=tc_list
            )
        )
        
    return result

# Conceptual endpoint for Agentic AI Use Case composition
class UseCaseGenerationRequest(BaseModel):
    bot_id: str
    project_id: Optional[str] = None
    num_usecases: int = 3
    custom_prompt: Optional[str] = None

@router.post("/usecases/generate", response_model=List[UseCase])
async def generate_use_cases(
    req: UseCaseGenerationRequest, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["owner", "member"]))
):
    # Verify bot
    bot = db.query(DBBot).filter(DBBot.id == req.bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot/Target not found")
        
    base_uc_count = db.query(DBUseCase).filter(DBUseCase.bot_id == req.bot_id).count()
        
    generated: List[UseCase] = []
    try:
        # Pass the custom prompt directly to the generator
        ai_payload = await generate_use_cases_with_ai(bot, req.num_usecases, custom_prompt=req.custom_prompt)
        
        for i, uc_data in enumerate(ai_payload):
            uc_id = str(uuid.uuid4())
            vid = f"UC-{base_uc_count + i + 1}"
            uc = UseCase(
                id=uc_id,
                bot_id=req.bot_id,
                project_id=req.project_id,
                visual_id=vid,
                name=uc_data.get("name", "Generated Use Case"),
                description=uc_data.get("description", "AI composed definition")
            )
            db_uc = DBUseCase(
                id=uc.id,
                bot_id=uc.bot_id,
                project_id=uc.project_id,
                visual_id=vid,
                name=uc.name,
                description=uc.description,
                created_at=uc.created_at
            )
            db.add(db_uc)
            generated.append(uc)
            
            for j, tc_data in enumerate(uc_data.get("test_cases", [])):
                tc_vid = f"{vid}-TC-{j + 1}"
                db_tc = DBTestCase(
                    id=str(uuid.uuid4()),
                    use_case_id=uc.id,
                    visual_id=tc_vid,
                    name=tc_data.get("name", "Test Case"),
                    description=tc_data.get("description", ""),
                    input_prompt=tc_data.get("input_prompt", "")
                )
                db.add(db_tc)
                
        db.commit()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    return generated

@router.delete("/usecases/{use_case_id}")
async def delete_use_case(
    use_case_id: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["owner", "member"]))
):
    uc = db.query(DBUseCase).filter(DBUseCase.id == use_case_id).first()
    if not uc:
        raise HTTPException(status_code=404, detail="Use Case not found")
        
    # Cascade delete is handled by database foreign keys if configured correctly,
    # but let's be explicit to ensure SQLite does it if PRAGMA foreign_keys=ON is not set
    tcs = db.query(DBTestCase).filter(DBTestCase.use_case_id == use_case_id).all()
    for tc in tcs:
        db.query(DBTestExecutionResult).filter(DBTestExecutionResult.test_case_id == tc.id).delete()
    db.query(DBTestCase).filter(DBTestCase.use_case_id == use_case_id).delete()
    db.delete(uc)
    db.commit()
    return {"message": "Use Case deleted successfully"}


# --- Test Cases ---

@router.post("/testcases", response_model=TestCase)
async def create_test_case(
    test_case: TestCase, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["owner", "member"]))
):
    if not test_case.id:
        test_case.id = str(uuid.uuid4())
        
    uc = db.query(DBUseCase).filter(DBUseCase.id == test_case.use_case_id).first()
    if not uc:
        raise HTTPException(status_code=404, detail="Use Case not found")
        
    tc_count = db.query(DBTestCase).filter(DBTestCase.use_case_id == test_case.use_case_id).count()
    vid = f"{uc.visual_id or 'UC-X'}-TC-{tc_count + 1}"
    test_case.visual_id = vid
        
    db_tc = DBTestCase(
        id=test_case.id,
        use_case_id=test_case.use_case_id,
        visual_id=vid,
        name=test_case.name,
        description=test_case.description,
        input_prompt=test_case.input_prompt,
        expected_output=test_case.expected_output,
        manual_ground_truth=test_case.manual_ground_truth,
        created_at=test_case.created_at
    )
    db.add(db_tc)
    db.commit()
    db.refresh(db_tc)
    return test_case

@router.get("/testcases/{use_case_id}", response_model=List[TestCase])
async def list_test_cases(use_case_id: str, db: Session = Depends(get_db)):
    tcs = db.query(DBTestCase).filter(DBTestCase.use_case_id == use_case_id).all()
    return [
        TestCase(
            id=tc.id, use_case_id=tc.use_case_id, visual_id=tc.visual_id, name=tc.name,
            description=tc.description, input_prompt=tc.input_prompt,
            expected_output=tc.expected_output, manual_ground_truth=tc.manual_ground_truth,
            created_at=tc.created_at
        ) for tc in tcs
    ]

class TestCaseUpdate(BaseModel):
    expected_output: Optional[str] = None
    input_prompt: Optional[str] = None

@router.patch("/testcases/{test_case_id}", response_model=TestCase)
async def update_test_case(
    test_case_id: str, 
    update_req: TestCaseUpdate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["owner", "member"]))
):
    tc = db.query(DBTestCase).filter(DBTestCase.id == test_case_id).first()
    if not tc:
        raise HTTPException(status_code=404, detail="TestCase not found")
        
    if update_req.expected_output is not None:
        tc.expected_output = update_req.expected_output
    if update_req.input_prompt is not None:
        tc.input_prompt = update_req.input_prompt
        
    db.commit()
    db.refresh(tc)
    return TestCase(
        id=tc.id, use_case_id=tc.use_case_id, visual_id=tc.visual_id, name=tc.name,
        description=tc.description, input_prompt=tc.input_prompt,
        expected_output=tc.expected_output, manual_ground_truth=tc.manual_ground_truth,
        created_at=tc.created_at
    )

@router.delete("/testcases/{test_case_id}")
async def delete_test_case(
    test_case_id: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["owner", "member"]))
):
    tc = db.query(DBTestCase).filter(DBTestCase.id == test_case_id).first()
    if not tc:
        raise HTTPException(status_code=404, detail="TestCase not found")
        
    db.query(DBTestExecutionResult).filter(DBTestExecutionResult.test_case_id == test_case_id).delete()
    db.delete(tc)
    db.commit()
    return {"message": "Test Case deleted successfully"}

# --- Executions ---

class ExecutionRequest(BaseModel):
    test_case_id: str
    test_suite_id: Optional[str] = None
    human_feedback: Optional[str] = None

@router.post("/execute", response_model=TestExecutionResult)
async def execute_test_case(
    req: ExecutionRequest, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["owner", "member", "reader"]))
):
    tc = db.query(DBTestCase).filter(DBTestCase.id == req.test_case_id).first()
    if not tc:
        raise HTTPException(status_code=404, detail="TestCase not found")
        
    uc = db.query(DBUseCase).filter(DBUseCase.id == tc.use_case_id).first()
    bot = db.query(DBBot).filter(DBBot.id == uc.bot_id).first()
    
    result = TestExecutionResult(
        id=str(uuid.uuid4()),
        test_case_id=tc.id,
        test_suite_id=req.test_suite_id,
        is_ground_truth=False,
    )
    
    if bot.target_type == "web_browser":
        result.requires_human_input = True
        result.human_question = "This Bot is configured for 'Web Browser' target type. Please execute this test case from the LLMSec Chrome Extension."
    else:
        import httpx
        from core.ai_usecase_generator import evaluate_or_continue_test
        
        headers = bot.headers.copy() if bot.headers else {}
        if bot.auth:
            if bot.auth.get("type") == "bearer":
                headers["Authorization"] = f"Bearer {bot.auth.get('token')}"
            elif bot.auth.get("type") == "api_key":
                headers[bot.auth.get("header", "X-API-Key")] = bot.auth.get("key")

        chat_history = f"User: {tc.input_prompt}\n"
        current_input = tc.input_prompt
        max_turns = 8
        question_count = 0
        max_questions = 2  # Max follow-up questions the AI agent is allowed to ask
        turn = 0
        final_score = 0.0
        final_reason = ""

        async with httpx.AsyncClient() as client:
            try:
                while turn < max_turns:
                    turn += 1
                    body = { "message": current_input, "prompt": current_input, "input": current_input }
                    
                    response = await client.request(
                        method=bot.method,
                        url=bot.endpoint,
                        headers=headers,
                        json=body,
                        timeout=30.0
                    )
                    response.raise_for_status()
                    data = response.json()
                    response_text = data.get("response") or data.get("message") or data.get("output") or str(data)
                    
                    chat_history += f"Bot: {response_text}\n"
                    
                    eval_res = await evaluate_or_continue_test(
                        bot.context or "", bot.agent_memory or "", uc.description, tc.input_prompt, chat_history,
                        expected_output=tc.expected_output, human_feedback=req.human_feedback,
                        questions_asked=question_count, max_questions=max_questions
                    )
                    
                    if eval_res.get("action") == "continue":
                        synthetic_reply = eval_res.get("reply", "")
                        if not synthetic_reply:
                            final_reason = "Bot asked a question but AI failed to generate a synthetic reply."
                            break
                        question_count += 1
                        chat_history += f"User (Synthetic): {synthetic_reply}\n"
                        current_input = synthetic_reply
                        # Enforce max follow-up question limit
                        if question_count >= max_questions:
                            final_reason = f"Max follow-up questions ({max_questions}) reached. The bot kept asking questions without resolving the task."
                            break
                    else:
                        final_score = eval_res.get("score", 0.0)
                        final_reason = eval_res.get("reason", "")
                        break
                
                if turn >= max_turns and eval_res.get("action") != "complete":
                    final_reason = "Max conversation turns reached before bot completed the task."
                    
                result.result_output = f"Transcript:\n{chat_history}\n\nAI Grade Reason:\n{final_reason}"
                result.evaluation_score = final_score
                
            except Exception as e:
                result.result_output = f"API Error in turn {turn}: {str(e)}\n\nTranscript so far:\n{chat_history}"
                result.evaluation_score = 0.0

    db_res = DBTestExecutionResult(
        id=result.id,
        test_case_id=result.test_case_id,
        test_suite_id=result.test_suite_id,
        result_output=result.result_output,
        evaluation_score=result.evaluation_score,
        is_ground_truth=result.is_ground_truth,
        requires_human_input=result.requires_human_input,
        human_question=result.human_question
    )
    db.add(db_res)
    db.commit()
    db.refresh(db_res)
    return result

class BrowserExecutionRequest(BaseModel):
    test_case_id: str
    response_text: str
    chat_history: Optional[str] = None
    test_suite_id: Optional[str] = None
    human_feedback: Optional[str] = None
    has_confirm_button: bool = False

@router.post("/execute/browser")
async def execute_browser_test_case(
    req: BrowserExecutionRequest, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["owner", "member", "reader"]))
):
    tc = db.query(DBTestCase).filter(DBTestCase.id == req.test_case_id).first()
    if not tc:
        raise HTTPException(status_code=404, detail="TestCase not found")
        
    uc = db.query(DBUseCase).filter(DBUseCase.id == tc.use_case_id).first()
    bot = db.query(DBBot).filter(DBBot.id == uc.bot_id).first()

    chat_history = req.chat_history if req.chat_history else f"User: {tc.input_prompt}\n"
    chat_history += f"Bot: {req.response_text}\n"

    from core.ai_usecase_generator import evaluate_or_continue_test
    
    # Only pass the human feedback override if a physical UI button actually exists to click
    effective_feedback = req.human_feedback if req.has_confirm_button else None
    
    eval_res = await evaluate_or_continue_test(bot.context or "", bot.agent_memory or "", uc.description, tc.input_prompt, chat_history, expected_output=tc.expected_output, human_feedback=effective_feedback)
    
    action = eval_res.get("action", "complete")
    if action == "wait":
        return {
            "action": "wait",
            "chat_history": chat_history
        }
    elif action == "click_confirm":
        chat_history += f"System (Action): Clicked Confirmation Button in UI\n"
        return {
            "action": "click_confirm",
            "chat_history": chat_history
        }
    elif action == "continue":
        synthetic_reply = eval_res.get("reply", "")
        if synthetic_reply:
            chat_history += f"User (Synthetic): {synthetic_reply}\n"
            return {
                "action": "continue",
                "reply": synthetic_reply,
                "chat_history": chat_history
            }
        else:
            final_reason = "Bot asked a question but AI failed to generate a synthetic reply."
            eval_res["score"] = 0.0
    else:
        final_reason = eval_res.get("reason", "")

    # If complete or failed to parse continue reply, save to database
    result = TestExecutionResult(
        id=str(uuid.uuid4()),
        test_case_id=tc.id,
        test_suite_id=req.test_suite_id,
        result_output=f"Transcript:\n{chat_history}\n\nAI Grade Reason:\n{final_reason}",
        evaluation_score=eval_res.get("score", 0.0),
        is_ground_truth=False,
    )
    
    db_res = DBTestExecutionResult(
        id=result.id,
        test_case_id=result.test_case_id,
        test_suite_id=result.test_suite_id,
        result_output=result.result_output,
        evaluation_score=result.evaluation_score,
        is_ground_truth=result.is_ground_truth,
    )
    db.add(db_res)
    db.commit()
    db.refresh(db_res)
    
    return {
        "action": "complete",
        "result": result
    }

from typing import Optional

@router.get("/executions/{test_case_id}", response_model=List[TestExecutionResult])
async def list_executions(test_case_id: str, suite_id: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(DBTestExecutionResult, DBTestCase).join(
        DBTestCase, DBTestExecutionResult.test_case_id == DBTestCase.id
    ).filter(DBTestExecutionResult.test_case_id == test_case_id)
    
    if suite_id:
        query = query.filter(DBTestExecutionResult.test_suite_id == suite_id)
        
    exs = query.order_by(DBTestExecutionResult.executed_at.desc()).all()
    
    return [
        TestExecutionResult(
            id=ex.id, test_case_id=ex.test_case_id, test_suite_id=ex.test_suite_id, result_output=ex.result_output,
            evaluation_score=ex.evaluation_score, is_ground_truth=ex.is_ground_truth,
            test_case_prompt=tc.input_prompt, test_case_name=tc.name,
            requires_human_input=ex.requires_human_input, human_question=ex.human_question,
            executed_at=ex.executed_at
        ) for ex, tc in exs
    ]

@router.get("/suites/{suite_id}/executions", response_model=List[TestExecutionResult])
async def list_suite_executions(suite_id: str, db: Session = Depends(get_db)):
    exs = db.query(DBTestExecutionResult, DBTestCase).join(
        DBTestCase, DBTestExecutionResult.test_case_id == DBTestCase.id
    ).filter(DBTestExecutionResult.test_suite_id == suite_id).order_by(DBTestExecutionResult.executed_at.desc()).all()
    return [
        TestExecutionResult(
            id=ex.id, test_case_id=ex.test_case_id, test_suite_id=ex.test_suite_id, result_output=ex.result_output,
            evaluation_score=ex.evaluation_score, is_ground_truth=ex.is_ground_truth,
            test_case_prompt=tc.input_prompt, test_case_name=tc.name,
            requires_human_input=ex.requires_human_input, human_question=ex.human_question,
            executed_at=ex.executed_at
        ) for ex, tc in exs
    ]

@router.delete("/suites/{suite_id}/executions")
async def delete_suite_executions(
    suite_id: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["owner", "member"]))
):
    db.query(DBTestExecutionResult).filter(DBTestExecutionResult.test_suite_id == suite_id).delete()
    db.commit()
    return {"message": "All executions for the test suite deleted successfully"}

# --- Ground Truth & Adaptive Feedback ---

@router.delete("/executions/{execution_id}")
async def delete_execution(execution_id: str, db: Session = Depends(get_db)):
    ex = db.query(DBTestExecutionResult).filter(DBTestExecutionResult.id == execution_id).first()
    if not ex:
        raise HTTPException(status_code=404, detail="Execution not found")
        
    db.delete(ex)
    db.commit()
    return {"message": "Execution deleted successfully"}

@router.post("/executions/{execution_id}/mark_ground_truth")
async def mark_ground_truth(execution_id: str, db: Session = Depends(get_db)):
    ex = db.query(DBTestExecutionResult).filter(DBTestExecutionResult.id == execution_id).first()
    if not ex:
        raise HTTPException(status_code=404, detail="Execution not found")
    
    ex.is_ground_truth = True
    db.commit()
    
    return TestExecutionResult(
            id=ex.id, test_case_id=ex.test_case_id, test_suite_id=ex.test_suite_id, result_output=ex.result_output,
            evaluation_score=ex.evaluation_score, is_ground_truth=ex.is_ground_truth,
            requires_human_input=ex.requires_human_input, human_question=ex.human_question,
            executed_at=ex.executed_at
        )


class AdaptiveFeedbackRequest(BaseModel):
    human_answer: str

@router.post("/executions/{execution_id}/provide_feedback", response_model=TestExecutionResult)
async def provide_adaptive_feedback(execution_id: str, feedback: AdaptiveFeedbackRequest, db: Session = Depends(get_db)):
    ex = db.query(DBTestExecutionResult).filter(DBTestExecutionResult.id == execution_id).first()
    if not ex:
        raise HTTPException(status_code=404, detail="Execution not found")
    
    if not ex.requires_human_input:
        raise HTTPException(status_code=400, detail="Execution does not require human input at this time.")
        
    # Process feedback and finalize execution simulation
    ex.requires_human_input = False
    ex.human_question = None
    ex.result_output = f"Execution resumed with human feedback: '{feedback.human_answer}'. Process completed."
    ex.evaluation_score = 0.88
    
    db.commit()
    
    return TestExecutionResult(
            id=ex.id, test_case_id=ex.test_case_id, test_suite_id=ex.test_suite_id, result_output=ex.result_output,
            evaluation_score=ex.evaluation_score, is_ground_truth=ex.is_ground_truth,
            requires_human_input=ex.requires_human_input, human_question=ex.human_question,
            executed_at=ex.executed_at
        )

# --- Dashboard Stats ---

@router.get("/stats/{bot_id}")
async def get_bot_dashboard_stats(bot_id: str, suite_id: Optional[str] = None, db: Session = Depends(get_db)):
    ucs = db.query(DBUseCase).filter(DBUseCase.bot_id == bot_id).all()
    uc_ids = [uc.id for uc in ucs]
    
    if not uc_ids:
        return {"total_tests": 0, "run_tests": 0, "pass_rate": 0, "fail_rate": 0, "avg_score": 0.0, "use_case_breakdown": []}
        
    tcs = db.query(DBTestCase).filter(DBTestCase.use_case_id.in_(uc_ids)).all()
    tc_ids = [tc.id for tc in tcs]
    
    if not tc_ids:
        return {"total_tests": 0, "run_tests": 0, "pass_rate": 0, "fail_rate": 0, "avg_score": 0.0, "use_case_breakdown": [{"id": uc.id, "name": uc.name, "pass_rate": 0, "passed": 0, "failed": 0, "run": 0, "total": 0} for uc in ucs]}
        
    query = db.query(DBTestExecutionResult).filter(DBTestExecutionResult.test_case_id.in_(tc_ids))
    if suite_id is not None:
        query = query.filter(DBTestExecutionResult.test_suite_id == suite_id)
    exs = query.all()
    
    # Map tc.id -> latest execution
    latest_ex_map = {}
    for ex in exs:
        if ex.test_case_id not in latest_ex_map:
            latest_ex_map[ex.test_case_id] = ex
        else:
            if ex.executed_at > latest_ex_map[ex.test_case_id].executed_at:
                latest_ex_map[ex.test_case_id] = ex
                
    total = len(tcs)
    run_tests = len(latest_ex_map)
    passed = sum(1 for ex in latest_ex_map.values() if ex.evaluation_score is not None and ex.evaluation_score >= 0.8)
    failed = run_tests - passed
    avg = (sum(ex.evaluation_score for ex in latest_ex_map.values() if ex.evaluation_score is not None) / run_tests) if run_tests > 0 else 0
    
    uc_breakdown = []
    for uc in ucs:
        uc_tcs = [tc for tc in tcs if tc.use_case_id == uc.id]
        uc_tc_ids = [tc.id for tc in uc_tcs]
        uc_latest_exs = [latest_ex_map[tc_id] for tc_id in uc_tc_ids if tc_id in latest_ex_map]
        
        uc_total = len(uc_tcs)
        uc_run = len(uc_latest_exs)
        uc_passed = sum(1 for ex in uc_latest_exs if ex.evaluation_score is not None and ex.evaluation_score >= 0.8)
        uc_failed = uc_run - uc_passed
        
        uc_breakdown.append({
            "id": uc.id,
            "name": uc.name,
            "passed": uc_passed,
            "failed": uc_failed,
            "total": uc_total,
            "run": uc_run,
            "pass_rate": round((uc_passed / uc_run * 100) if uc_run > 0 else 0)
        })

    return {
        "total_tests": total,
        "run_tests": run_tests,
        "pass_rate": round((passed / run_tests * 100) if run_tests > 0 else 0),
        "fail_rate": round((failed / run_tests * 100) if run_tests > 0 else 0),
        "avg_score": round(avg * 10, 1), # scaled out of 10
        "use_case_breakdown": uc_breakdown
    }
