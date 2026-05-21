import uuid
from sqlalchemy import String, DateTime, ForeignKey, func, text, Integer, Text

from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.database import Base
from typing import Optional,TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.competitor_listing import CompetitorListing
    from app.models.price_snapshot import PriceSnapshot
    from app.models.scraper_profile import ScraperProfile


class ScrapeJob(Base):
    __tablename__ = "scrape_jobs"

    # Core IDs
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    competitor_listing_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("competitor_listings.id"), nullable=False, index=True
    )
    # Profile used for this specific job attempt
    profile_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("scraper_profiles.id"), nullable=True
    )

    # Queue Logic
    # composite score: user tier + volatility + staleness
    priority_score: Mapped[int] = mapped_column(Integer, server_default=text("0"), nullable=False)
    
    # Status tracking (pending, running, done, failed)
    status: Mapped[str] = mapped_column(String(50), server_default="pending", nullable=False)
    failure_reason: Mapped[Optional[str]] = mapped_column(Text)
    attempt_number: Mapped[int] = mapped_column(Integer, server_default=text("1"), nullable=False)

    # Execution Timestamps
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


    extraction_method_used: Mapped[Optional[str]] = mapped_column(String(60),nullable=True)

    extraction_step_reached: Mapped[Optional[int]] = mapped_column(Integer,nullable=True)



    # Relationships (The Bridges)
    competitor_listing: Mapped["CompetitorListing"] = relationship(
    "CompetitorListing", back_populates="scrape_jobs",
    foreign_keys=[competitor_listing_id]
)
  
    profile: Mapped[Optional["ScraperProfile"]] = relationship(
    "ScraperProfile", back_populates="scrape_jobs"
)