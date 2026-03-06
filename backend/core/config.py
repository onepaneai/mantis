"""
Configuration settings for LLMSec
"""
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    # Server settings
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = True

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "https://mantis.onepane.ai",
        "http://mantis.onepane.ai",
        "chrome-extension://*"
    ]

    # Database
    DATABASE_URL: str = "sqlite:///./llmsec.db"

    # Redis for caching and task queue
    REDIS_URL: str = "redis://localhost:6379/0"

    # API Keys (optional, for testing with real LLMs)
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    ENVIRONMENT: str = "development"

    # Attack settings
    MAX_CONVERSATION_TURNS: int = 10
    ATTACK_TIMEOUT: int = 30
    IMPROVEMENT_THRESHOLD: float = 0.7

    # Dataset

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
