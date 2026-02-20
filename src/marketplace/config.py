import os


class Settings:
    jwt_secret: str = os.getenv("JWT_SECRET", "dev-jwt-secret-change-in-production")
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./marketplace.db")
    frontend_origin: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
    base_url: str = os.getenv("BASE_URL", "http://localhost:8000")


settings = Settings()
