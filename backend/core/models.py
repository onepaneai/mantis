"""
Data models for LLMSec
"""
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any, Literal
from datetime import datetime
from enum import Enum

class AttackType(str, Enum):
    PROMPT_INJECTION = "prompt_injection"
    ROLE_PLAYING = "role_playing"
    JAILBREAK = "jailbreak"
    ENCODING = "encoding"
    TRANSLATION = "translation"
    PERSUASION = "persuasion"
    MANIPULATION = "manipulation"
    STORYTELLING = "storytelling"
    HYPOTHETICAL = "hypothetical"
    CONTEXTUAL = "contextual"

class AttackMode(str, Enum):
    SINGLE = "single"
    SEQUENTIAL = "sequential"
    ADAPTIVE = "adaptive"

class TargetType(str, Enum):
    WEB_BROWSER = "web_browser"
    API_ENDPOINT = "api_endpoint"

# Auth & Organization Models
class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class OrganizationCreate(BaseModel):
    name: str

from typing import List, Optional

class LLMModelResponse(BaseModel):
    id: str
    organization_id: str
    provider: str
    model_name: str
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class OrganizationResponse(BaseModel):
    id: str
    name: str
    owner_id: str
    created_at: datetime
    
    has_gemini_key: bool = False
    has_openai_key: bool = False
    has_anthropic_key: bool = False
    
    llm_models: List[LLMModelResponse] = []
    
    class Config:
        from_attributes = True

class OrganizationAPIKeysUpdate(BaseModel):
    gemini_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None

class LLMModelCreate(BaseModel):
    provider: str
    model_name: str

class OrganizationMemberResponse(BaseModel):
    id: str
    organization_id: str
    user_id: str
    role: str
    joined_at: datetime
    user: Optional[UserResponse] = None
    
    class Config:
        from_attributes = True

class OrganizationInvite(BaseModel):
    email: str
    role: Literal["reader", "member"]

class APIKeyResponse(BaseModel):
    id: str
    display_prefix: str
    created_at: datetime
    last_used: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class APIKeyCreate(BaseModel):
    key: str # Returned only once on creation
    api_key: APIKeyResponse

# Target Configuration (Also represents a Bot/Project conceptually in LLMSec)
class TargetConfig(BaseModel):
    id: Optional[str] = None
    name: str
    description: str
    purpose: str
    context: Optional[str] = None  # Additional context about the target for AI adaptation
    agent_memory: Optional[str] = None # Information like default subscriptions for the Testing AI to use
    organization_id: Optional[str] = None # Scopes the bot to a tenant
    target_type: TargetType

    # For API endpoints
    endpoint: Optional[str] = None
    method: str = "POST"
    headers: Dict[str, str] = {}
    auth: Optional[Dict[str, str]] = None

    # For browser-based testing
    url: Optional[str] = None
    selector: Optional[str] = None

    # Constraints and guardrails to test
    expected_restrictions: List[str] = []
    prohibited_topics: List[str] = []

    created_at: datetime = Field(default_factory=datetime.now)

# Project Management
class ProjectBase(BaseModel):
    name: str
    description: str = ""

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class ProjectResponse(ProjectBase):
    id: str
    bot_id: str
    created_at: datetime
    
    class Config:
        from_attributes = True

# Testing & Evaluation Area Models
class TestSuite(BaseModel):
    id: Optional[str] = None
    bot_id: str
    project_id: Optional[str] = None
    name: str
    description: str
    created_at: datetime = Field(default_factory=datetime.now)

class UseCase(BaseModel):
    id: Optional[str] = None
    bot_id: str
    project_id: Optional[str] = None
    visual_id: Optional[str] = None
    name: str
    description: str
    created_at: datetime = Field(default_factory=datetime.now)

class UseCaseExport(UseCase):
    test_cases: List["TestCase"] = []
    class Config:
        from_attributes = True

class TestCase(BaseModel):
    id: Optional[str] = None
    use_case_id: str
    visual_id: Optional[str] = None
    name: str
    description: str
    input_prompt: str
    expected_output: Optional[str] = None
    manual_ground_truth: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)

class TestExecutionResult(BaseModel):
    id: Optional[str] = None
    test_case_id: str
    test_suite_id: Optional[str] = None
    result_output: Optional[str] = None
    evaluation_score: Optional[float] = None
    is_ground_truth: bool = False
    test_case_prompt: Optional[str] = None
    test_case_name: Optional[str] = None
    
    # Adaptive Testing Context
    requires_human_input: bool = False
    human_question: Optional[str] = None
    
    executed_at: datetime = Field(default_factory=datetime.now)

# Attack Strategy
class AttackStrategy(BaseModel):
    id: Optional[str] = None
    name: str
    attack_type: AttackType
    description: str
    template: str
    variables: List[str] = []
    success_indicators: List[str] = []
    failure_indicators: List[str] = []

# Sequential Attack Chain
class ConversationTurn(BaseModel):
    turn_number: int
    prompt: str
    expected_response_type: Optional[str] = None
    success_condition: Optional[str] = None
    next_prompt_generator: Optional[str] = None  # Python code to generate next prompt

class AttackChain(BaseModel):
    id: Optional[str] = None
    name: str
    description: str
    attack_types: List[AttackType]
    initial_turn: ConversationTurn
    max_turns: int = 10
    adaptation_strategy: str = "feedback_based"

# Attack Request
class AttackRequest(BaseModel):
    target_id: str
    attack_type: AttackType
    attack_mode: AttackMode = AttackMode.SINGLE
    strategy_id: Optional[str] = None
    chain_id: Optional[str] = None

    # For custom attacks
    custom_prompt: Optional[str] = None

    # Adaptive settings
    enable_improvement: bool = True
    max_improvement_iterations: int = 5

    # Variables for template
    variables: Dict[str, Any] = {}

# Attack Response
class AttackResponse(BaseModel):
    success: bool
    response_text: str
    confidence_score: float
    metadata: Dict[str, Any] = {}

# Attack Result
class ConversationHistory(BaseModel):
    turn: int
    prompt: str
    response: str
    timestamp: datetime
    success: bool
    confidence: float

class AttackResult(BaseModel):
    id: str
    target_id: str
    attack_type: AttackType
    attack_mode: AttackMode
    started_at: datetime
    completed_at: Optional[datetime] = None

    conversation_history: List[ConversationHistory] = []

    final_success: bool = False
    overall_confidence: float = 0.0

    # Improvement tracking
    improvement_iterations: int = 0
    improvement_log: List[Dict[str, Any]] = []

    # Analysis
    vulnerability_found: bool = False
    vulnerability_description: Optional[str] = None
    risk_level: Literal["low", "medium", "high", "critical"] = "low"

    metadata: Dict[str, Any] = {}

# Ground Truth Dataset
class GroundTruthExample(BaseModel):
    id: Optional[str] = None
    scenario: str
    attack_type: AttackType
    prompt: str
    expected_behavior: str
    should_refuse: bool
    refusal_indicators: List[str] = []
    metadata: Dict[str, Any] = {}

class Dataset(BaseModel):
    id: Optional[str] = None
    name: str
    description: str
    target_purpose: str
    examples: List[GroundTruthExample] = []
    created_at: datetime = Field(default_factory=datetime.now)
    version: str = "1.0"

# Evaluation
class EvaluationMetrics(BaseModel):
    total_tests: int
    successful_attacks: int
    failed_attacks: int
    success_rate: float

    vulnerabilities_by_type: Dict[str, int] = {}
    risk_distribution: Dict[str, int] = {}

    avg_turns_to_success: float = 0.0
    avg_confidence: float = 0.0

class EvaluationReport(BaseModel):
    id: str
    target_id: str
    dataset_id: Optional[str] = None

    started_at: datetime
    completed_at: datetime

    metrics: EvaluationMetrics
    detailed_results: List[AttackResult] = []

    recommendations: List[str] = []
    summary: str
