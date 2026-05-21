import uuid
from sqlalchemy import String, Boolean, DateTime, ForeignKey, func, text, Integer, Text

from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.database import Base
from typing import List, Optional, Any, TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.proxy import Proxy
    from app.models.scrape_job import ScrapeJob

class ScraperProfile(Base):
    __tablename__ = "scraper_profiles"

    # Core Identification
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    
    # Domain-specific isolation
    domain: Mapped[str] = mapped_column(String(255), nullable=False)
    proxy_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("proxies.id"), nullable=True
    )

    # Stealth & Identity Data
    user_agent: Mapped[str] = mapped_column(Text, nullable=False)
    fingerprint_json: Mapped[dict[str, Any]] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb"), nullable=False
    )
    cookies: Mapped[dict[str, Any]] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb"), nullable=False
    )

    # Health & Performance
    health_score: Mapped[int] = mapped_column(Integer, server_default=text("100"), nullable=False)
    is_burned: Mapped[bool] = mapped_column(Boolean, server_default=text("false"), nullable=False)
    total_successful_scrapes: Mapped[int] = mapped_column(
        Integer, server_default=text("0"), nullable=False
    )

    # Session Management (Time & Behavior Based)
    session_started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    requests_this_session: Mapped[int] = mapped_column(
        Integer, server_default=text("0"), nullable=False
    )
    
    # Tracking Timestamps
    last_used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships (The Bridges)
    proxy: Mapped[Optional["Proxy"]] = relationship("Proxy", back_populates="scraper_profiles")
    scrape_jobs: Mapped[List["ScrapeJob"]] = relationship("ScrapeJob", back_populates="profile")