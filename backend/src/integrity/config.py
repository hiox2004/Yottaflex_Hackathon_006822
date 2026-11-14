"""Runtime settings, read from environment variables or a local .env file."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://integrity:integrity_dev@localhost:5433/integrity"

    # Optional AI layer. Off by default: the core must never depend on it.
    ai_enabled: bool = False
    llm_base_url: str = "http://localhost:11434/v1"
    llm_model: str = "llama3.2:3b"


@lru_cache
def get_settings() -> Settings:
    return Settings()
