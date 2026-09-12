from functools import lru_cache
import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    database_url = os.getenv("DATABASE_URL", "sqlite:///./pantheon.db")
    api_key = os.getenv("PANTHEON_API_KEY", "")
    allow_insecure_localhost = os.getenv("ALLOW_INSECURE_LOCALHOST", "false").lower() == "true"
    max_snapshot_tabs = int(os.getenv("MAX_SNAPSHOT_TABS", "500"))
    rate_limit_per_minute = int(os.getenv("RATE_LIMIT_PER_MINUTE", "120"))
    cors_origins = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
