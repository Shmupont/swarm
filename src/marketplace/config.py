from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///marketplace.db"
    jwt_secret: str = "dev-jwt-secret-change-in-production"
    log_level: str = "INFO"
    base_url: str = "http://localhost:8000"
    frontend_origin: str = "http://localhost:3000"
    encryption_key: str = "swarm-dev-encryption-key-change-in-production"
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
