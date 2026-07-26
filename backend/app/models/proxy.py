import uuid
from decimal import Decimal
from sqlalchemy import String, Boolean, DateTime, func, text, NUMERIC, Integer, BigInteger

from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.database import Base
from typing import List, Optional, Any, TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.scraper_profile import ScraperProfile

class Proxy(Base):
    __tablename__ = "proxies"

    # Core identification
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    
    # Connection details
    ip_address: Mapped[str] = mapped_column(String(150), nullable=False)
    port: Mapped[int] = mapped_column(Integer, nullable=False)
    username: Mapped[Optional[str]] = mapped_column(String(255))
    password: Mapped[Optional[str]] = mapped_column(String(255))
    
    # Provider metadata
    provider: Mapped[Optional[str]] = mapped_column(String(100)) # e.g., 'brightdata', 'oxylabs'
    type: Mapped[str] = mapped_column(String(80), server_default="residential", nullable=False)
    
    # Health and Protection Logic
    health_score: Mapped[int] = mapped_column(Integer, server_default=text("100"), nullable=False)
    # Stores a list of domains where this specific IP is blocked
    burned_on_domains: Mapped[list[str]] = mapped_column(
        JSONB, server_default=text("'[]'::jsonb"), nullable=False
    )
    
    # Financial and Usage tracking
    monthly_cost_usd: Mapped[Optional[Decimal]] = mapped_column(NUMERIC(100, 2))
    bytes_used_this_month: Mapped[int] = mapped_column(BigInteger, server_default=text("0"), nullable=False)
    
    # Status and Timestamps
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"), nullable=False)
    last_used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationship to the browser profiles using this proxy
    scraper_profiles: Mapped[List["ScraperProfile"]] = relationship(
        "ScraperProfile", back_populates="proxy"
    )