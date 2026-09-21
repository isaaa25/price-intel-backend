
# app/config.py

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

from sqlalchemy import false


class Settings(BaseSettings):

    # ─── Single model_config — one definition only ────────────────────────────
    # case_sensitive=False  → SECRET_KEY in .env matches secret_key in class
    # extra='ignore'        → .env variables not defined here are silently ignored
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ─── Auth ────────────────────────────────────────────────────────────────
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # ─── App Environment ──────────────────────────────────────────────────────
    env: str = "development"  # "development", "staging", "production"
    debug: bool = False

    # ─── Database ────────────────────────────────────────────────────────────
    DB_HOST: str
    DB_PORT: int
    DB_NAME: str
    DEMO_DB_NAME: str
    DB_USER: str
    DB_PASSWORD: str
    DATABASE_URL_NEON: str

    # ─── External APIs ────────────────────────────────────────────────────────
    SCRAPEOPS_API_KEY: str
    GEMINI_API_KEY : str

    # ─── Scraper Behaviour ────────────────────────────────────────────────────
    DELAY_MIN: float = 2.0
    DELAY_MAX: float = 5.0
    MAX_RETRIES: int = 3
    PAGES_PER_KEYWORD: int = 2
    STORE_PAGES_SMALL: int = 10
    STORE_PAGES_LARGE: int = 4
    STORE_SMALL_THRESHOLD: int = 150
    proxy: Optional[dict] = None

    # ─── IPRoyal Proxy ────────────────────────────────────────────────────────
    IPROYAL_USERNAME: str
    IPROYAL_PASSWORD: str
    IPROYAL_HOST: str = "geo.iproyal.com"
    IPROYAL_HTTP_PORT: int = 11202
    IPROYAL_SOCKS5_PORT: int = 11202
    IPROYAL_COUNTRY: str = "ae"
    IPROYAL_SESSION_LIFETIME: str = "168h"
    PROXY_PROTOCOL: str = "http"
    IPROYAL_SESSION_COUNT: int = 4

    USE_PROXY: bool = False

    # scrapfly api key
    SCRAPFLY_API_KEY: str

    # ─── Session Management ───────────────────────────────────────────────────
    SESSION_MAX_AGE_HOURS: int = 4
    JWT_REFRESH_THRESHOLD_SECS: int = 90
    # block_cooldown_mins: int = 15
    BLOCK_COOLDOWN_MINS: int = 15
    SESSION_BUNDLE_PATH: str = "scraper/platforms/noon/data/session_bundle.json"

    # ─── Pricing and Alerts ───────────────────────────────────────────────────
    PRICE_CHANGE_THRESHOLD_PCT: float = 3.0

    # ─── Scraper Keywords ─────────────────────────────────────────────────────
    # SEARCH_KEYWORDS: list[str] = ["iphone 15"]
    # PAGES_PER_KEYWORD: int = 2

    search_keywords: list[str] = ["iphone 15"]
    pages_per_keyword: int = 2

    # ─── User Agents ──────────────────────────────────────────────────────────
    user_agents: list[str] = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    ]

    # ─── Computed URLs (properties, not fields) ───────────────────────────────

    @property
    def DATABASE_URL(self) -> str:
        """
        Async URL for SQLAlchemy's async engine in database.py.
        Uses asyncpg driver — required for AsyncSession.
        Points to price_intel (the main app database).
        """
        # return (f"postgresql+asyncpg://{self.DATABASE_URL_NEON}?ssl=require")
        return (
            f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
            "?ssl=require"
        )


    # @property
    # def NEON_DATABASE_URL(self) -> str:
    #     """
    #     Async URL for the neon database.
    #     Used by dashboard/db.py when pointing at the demo data.
    #     """
    #     return self.DATABASE_URL_NEON
        

    @property
    def DEMO_DATABASE_URL(self) -> str:
        """
        Async URL for the noon demo/dashboard database.
        Used by dashboard/db.py when pointing at the demo data.
        """
        return (
            f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DEMO_DB_NAME}"
        )

    @property
    def SYNC_DATABASE_URL(self) -> str:
        """
        Sync URL for tools that cannot use async (Alembic, pipeline loader).
        Uses psycopg2 driver.
        Points to price_intel.
        """
        # return (
        #     f"postgresql+psycopg2://{self.DB_USER}:{self.DB_PASSWORD}"
        #     f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        # )
        return (f"postgresql+psycopg2://{self.DATABASE_URL_NEON}"
                "?ssl=require")
                # "?sslmode=require")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()