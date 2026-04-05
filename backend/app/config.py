from typing import Optional
from pathlib import Path
from pydantic import ConfigDict
from pydantic_settings import BaseSettings

_env_file = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    CELERY_BROKER_URL: Optional[str] = None
    CELERY_RESULT_BACKEND: Optional[str] = None
    R2_ACCESS_KEY_ID: str
    R2_SECRET_ACCESS_KEY: str
    R2_ACCOUNT_ID: str
    R2_BUCKET_NAME: str
    SMTP_HOST: str
    SMTP_PORT: int
    SMTP_USER: str
    SMTP_PASSWORD: str
    
    model_config = ConfigDict(env_file = str(_env_file), extra = "ignore")

settings = Settings()
