import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Float, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship

from core.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    email = Column(String, unique=True, index=True)
    name = Column(String)
    picture = Column(String, nullable=True)
    google_id = Column(String, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    owned_organizations = relationship("Organization", back_populates="owner")
    memberships = relationship("OrganizationMember", back_populates="user", cascade="all, delete-orphan")
    api_keys = relationship("APIKey", back_populates="user", cascade="all, delete-orphan")


class Organization(Base):
    __tablename__ = "organizations"
    
    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    name = Column(String)
    owner_id = Column(String, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Provider API Keys
    gemini_api_key = Column(String, nullable=True)
    openai_api_key = Column(String, nullable=True)
    anthropic_api_key = Column(String, nullable=True)

    # Relationships
    owner = relationship("User", back_populates="owned_organizations")
    members = relationship("OrganizationMember", back_populates="organization", cascade="all, delete-orphan")
    bots = relationship("DBBot", back_populates="organization", cascade="all, delete-orphan")
    api_keys = relationship("APIKey", back_populates="organization", cascade="all, delete-orphan")
    llm_models = relationship("OrganizationLLMModel", back_populates="organization", cascade="all, delete-orphan")


class OrganizationLLMModel(Base):
    __tablename__ = "organization_llm_models"
    
    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    provider = Column(String) # e.g., "gemini", "openai", "anthropic"
    model_name = Column(String) # e.g., "gemini-1.5-flash"
    is_active = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    organization = relationship("Organization", back_populates="llm_models")


class OrganizationMember(Base):
    __tablename__ = "organization_members"
    
    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role = Column(String, default="reader") # reader, member
    joined_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", back_populates="members")
    user = relationship("User", back_populates="memberships")


class APIKey(Base):
    __tablename__ = "api_keys"
    
    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    key_hash = Column(String, unique=True, index=True)
    display_prefix = Column(String) # to show like "mtis_..."
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_used = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("User", back_populates="api_keys")
    organization = relationship("Organization", back_populates="api_keys")


class DBBot(Base):
    __tablename__ = "bots"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    name = Column(String, index=True)
    description = Column(Text, default="")
    purpose = Column(Text, default="")
    context = Column(Text, nullable=True)
    agent_memory = Column(Text, nullable=True)
    target_type = Column(String)

    endpoint = Column(String, nullable=True)
    method = Column(String, default="POST")
    headers = Column(JSON, default={})
    auth = Column(JSON, nullable=True)

    url = Column(String, nullable=True)
    selector = Column(String, nullable=True)

    expected_restrictions = Column(JSON, default=[])
    prohibited_topics = Column(JSON, default=[])

    created_at = Column(DateTime, default=datetime.utcnow)
    
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)

    # Relationships
    organization = relationship("Organization", back_populates="bots")
    projects = relationship("DBProject", back_populates="bot", cascade="all, delete-orphan")
    use_cases = relationship("DBUseCase", back_populates="bot", cascade="all, delete-orphan")
    test_suites = relationship("DBTestSuite", back_populates="bot", cascade="all, delete-orphan")


class DBProject(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    bot_id = Column(String, ForeignKey("bots.id", ondelete="CASCADE"), index=True)
    name = Column(String)
    description = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    bot = relationship("DBBot", back_populates="projects")
    use_cases = relationship("DBUseCase", back_populates="project")
    test_suites = relationship("DBTestSuite", back_populates="project")


class DBTestSuite(Base):
    __tablename__ = "test_suites"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    bot_id = Column(String, ForeignKey("bots.id", ondelete="CASCADE"), index=True)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String)
    description = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    bot = relationship("DBBot", back_populates="test_suites")
    project = relationship("DBProject", back_populates="test_suites")
    execution_results = relationship("DBTestExecutionResult", back_populates="test_suite")


class DBUseCase(Base):
    __tablename__ = "use_cases"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    bot_id = Column(String, ForeignKey("bots.id", ondelete="CASCADE"), index=True)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    visual_id = Column(String, nullable=True)
    name = Column(String)
    description = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    bot = relationship("DBBot", back_populates="use_cases")
    project = relationship("DBProject", back_populates="use_cases")
    test_cases = relationship("DBTestCase", back_populates="use_case", cascade="all, delete-orphan")


class DBTestCase(Base):
    __tablename__ = "test_cases"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    use_case_id = Column(String, ForeignKey("use_cases.id", ondelete="CASCADE"), index=True)
    visual_id = Column(String, nullable=True)
    name = Column(String)
    description = Column(Text, default="")
    input_prompt = Column(Text)
    expected_output = Column(Text, nullable=True)
    manual_ground_truth = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    use_case = relationship("DBUseCase", back_populates="test_cases")
    execution_results = relationship("DBTestExecutionResult", back_populates="test_case", cascade="all, delete-orphan")


class DBTestExecutionResult(Base):
    __tablename__ = "test_execution_results"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    test_case_id = Column(String, ForeignKey("test_cases.id", ondelete="CASCADE"), index=True)
    test_suite_id = Column(String, ForeignKey("test_suites.id", ondelete="SET NULL"), nullable=True, index=True)
    
    result_output = Column(Text, nullable=True)
    evaluation_score = Column(Float, nullable=True)
    is_ground_truth = Column(Boolean, default=False)
    
    requires_human_input = Column(Boolean, default=False)
    human_question = Column(Text, nullable=True)
    
    executed_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    test_case = relationship("DBTestCase", back_populates="execution_results")
    test_suite = relationship("DBTestSuite", back_populates="execution_results")


class DBDataset(Base):
    __tablename__ = "datasets"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    name = Column(String)
    description = Column(Text, default="")
    target_purpose = Column(Text, default="")
    examples = Column(JSON, default=[]) # Storing list of GroundTruthExample dicts
    created_at = Column(DateTime, default=datetime.utcnow)
    version = Column(String, default="1.0")


class DBEvaluationReport(Base):
    __tablename__ = "evaluation_reports"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    target_id = Column(String, ForeignKey("bots.id", ondelete="CASCADE"), index=True)
    dataset_id = Column(String, ForeignKey("datasets.id", ondelete="SET NULL"), nullable=True, index=True)
    
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    
    metrics = Column(JSON, nullable=True) # Storing EvaluationMetrics dict
    detailed_results = Column(JSON, default=[]) # Storing list of AttackResult dicts
    
    recommendations = Column(JSON, default=[]) # List of strings
    summary = Column(Text, default="")

    # Relationships
    target = relationship("DBBot")
    dataset = relationship("DBDataset")
