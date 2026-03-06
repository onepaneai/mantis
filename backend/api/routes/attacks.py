"""
API routes for attack execution
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import List, Dict, Any
from core.models import AttackRequest, AttackResult, AttackType, AttackMode, TargetConfig
from core.attack_orchestrator import AttackOrchestrator
from core.database import get_db
from sqlalchemy.orm import Session
from fastapi import Depends
from core.db_models import DBBot

router = APIRouter()
orchestrator = AttackOrchestrator()

# Persistent attack storage
attack_store: Dict[str, AttackResult] = {}

@router.post("/execute", response_model=AttackResult)
async def execute_attack(request: AttackRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Execute an attack against a target"""

    # Get target configuration
    db_bot = db.query(DBBot).filter(DBBot.id == request.target_id).first()
    if not db_bot:
        raise HTTPException(status_code=404, detail="Target not found")
        
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
    target = TargetConfig(**tc_dict)

    # Execute attack
    result = await orchestrator.execute_attack(request, target)

    # Store result persistently
    attack_store[result.id] = result

    return result

@router.get("/status/{attack_id}", response_model=AttackResult)
async def get_attack_status(attack_id: str):
    """Get status of an ongoing or completed attack"""

    # Check persistent store first
    result = attack_store.get(attack_id)
    if not result:
        # Fallback to active attacks
        result = orchestrator.get_attack_status(attack_id)

    if not result:
        raise HTTPException(status_code=404, detail="Attack not found")

    return result

@router.get("/", response_model=List[AttackResult])
async def list_attacks():
    """List all executed attacks with their conversation history"""
    return list(attack_store.values())

@router.post("/store-result", response_model=AttackResult)
async def store_attack_result(result: AttackResult):
    """Store attack result from Chrome extension"""
    attack_store[result.id] = result
    return result

@router.post("/generate-adaptive-prompt")
async def generate_adaptive_prompt(request: Dict[str, Any]):
    """Generate next adaptive prompt using AI based on conversation history"""
    from core.adaptive_prompt_generator import generate_next_adaptive_prompt
    import traceback

    conversation_history = request.get('conversation_history', [])
    target_behavior = request.get('target_behavior', '')
    last_response = request.get('last_response', '')
    last_evaluation = request.get('last_evaluation', {})
    target_context = request.get('target_context', '')

    try:
        print(f"[ADAPTIVE PROMPT API] Generating prompt for behavior: {target_behavior}")
        print(f"[ADAPTIVE PROMPT API] Conversation turns: {len(conversation_history)}")
        print(f"[ADAPTIVE PROMPT API] Has target context: {bool(target_context)}")

        next_prompt = await generate_next_adaptive_prompt(
            conversation_history,
            target_behavior,
            last_response,
            last_evaluation,
            target_context
        )

        print(f"[ADAPTIVE PROMPT API] Successfully generated prompt: {next_prompt[:100]}...")
        return {"next_prompt": next_prompt}
    except Exception as e:
        print(f"[ADAPTIVE PROMPT API ERROR] {type(e).__name__}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to generate adaptive prompt: {str(e)}")

@router.post("/evaluate-response")
async def evaluate_response(request: Dict[str, Any]):
    """Evaluate if a response indicates vulnerability or refusal using AI"""
    from core.response_evaluator import evaluate_response_with_ai
    import traceback

    prompt = request.get('prompt', '')
    response = request.get('response', '')
    target_behavior = request.get('target_behavior', '')

    print(f"[EVALUATE ENDPOINT] Received evaluation request")
    print(f"[EVALUATE ENDPOINT] Target behavior: {target_behavior}")
    print(f"[EVALUATE ENDPOINT] Prompt: {prompt[:100]}...")
    print(f"[EVALUATE ENDPOINT] Response: {response[:200]}...")

    try:
        evaluation = await evaluate_response_with_ai(prompt, response, target_behavior)
        print(f"[EVALUATE ENDPOINT] Evaluation result: {evaluation}")
        return evaluation
    except Exception as e:
        print(f"[EVALUATE ENDPOINT ERROR] {type(e).__name__}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to evaluate response: {str(e)}")

@router.get("/strategies", response_model=List[Dict[str, Any]])
async def list_strategies():
    """List available attack strategies"""

    from strategies.jailbreak_strategies import ATTACK_STRATEGIES

    strategies = []
    for name, strategy_class in ATTACK_STRATEGIES.items():
        strategy = strategy_class()
        strategies.append({
            "id": name,
            "name": strategy.name,
            "description": strategy.description,
            "type": "sequential" if hasattr(strategy, 'max_turns') else "single"
        })

    return strategies

@router.get("/types", response_model=List[str])
async def list_attack_types():
    """List available attack types"""
    return [t.value for t in AttackType]

@router.get("/modes", response_model=List[str])
async def list_attack_modes():
    """List available attack modes"""
    return [m.value for m in AttackMode]
