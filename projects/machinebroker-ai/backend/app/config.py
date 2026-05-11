from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/machinebroker"

    ai_provider: Literal["openai", "anthropic"] = "openai"
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o"
    openai_embedding_model: str = "text-embedding-3-small"
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-opus-4-7"

    match_strategy: Literal["embedding", "prompt", "hybrid"] = "hybrid"
    match_auto_draft_threshold: int = Field(default=80, ge=0, le=100)
    match_candidate_limit: int = Field(default=25, ge=1, le=200)

    email_transport: Literal["smtp", "sendgrid", "console"] = "console"
    email_from: str = "broker@machinebroker.ai"
    email_from_name: str = "MachineBroker AI"
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    sendgrid_api_key: str | None = None

    allowed_origins: str = "http://localhost:3000"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
