"""
Centralized application configuration.

All values are sourced from environment variables (see .env.example).
Nothing here should be hardcoded for production — this file only
defines names, types, and safe local-dev defaults.
"""
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # --- App ---
    APP_NAME: str = "ResQ API"
    APP_ENV: str = "development"
    APP_DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    # --- CORS ---
    CORS_ORIGINS: List[str] = [
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "https://resq-frontend-m3gq.onrender.com",
]

    # --- MongoDB ---
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGO_DB_NAME: str = "resq"

    # --- JWT ---
    JWT_SECRET_KEY: str = "CHANGE_ME_IN_PRODUCTION"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    REFRESH_TOKEN_EXPIRE_DAYS_REMEMBER_ME: int = 30

    # --- Rate limiting ---
    RATE_LIMIT_DEFAULT: str = "100/minute"
    RATE_LIMIT_AUTH: str = "10/minute"

    # --- File uploads ---
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE_MB: int = 10
    ALLOWED_IMAGE_TYPES: List[str] = ["image/jpeg", "image/png", "image/webp"]

    # --- Third-party provider keys (all optional, service layer falls back to mocks) ---
    OPENWEATHER_API_KEY: str = ""
    WEATHERAPI_KEY: str = ""
    GOOGLE_MAPS_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    GROQ_API_KEY: str = ""   
    GEMINI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""

    # --- Email / SMS (architecture only, unused until configured) ---
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMS_PROVIDER_API_KEY: str = ""

    # --- Google OAuth (architecture only) ---
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
