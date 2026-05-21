import uuid
from sqlalchemy import String, Boolean, DateTime, ForeignKey, func, text, Float, Integer, Text,CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.database import Base
from typing import List, Optional, TYPE_CHECKING

# The TYPE_CHECKING block prevents red underlines in Pylance 
# without causing circular import crashes at runtime.
if TYPE_CHECKING:
    from app.models.tracked_product import TrackedProduct
    from app.models.price_snapshot import PriceSnapshot
    from app.models.scrape_job import ScrapeJob
    from app.models.extraction_config import ExtractionConfig

class CompetitorListing(Base):
    __tablename__ = 'competitor_listings'

    __table_args__=(
        CheckConstraint(
            """render_type IN (
            'server_rendered',
            'client_rendered',
            'api_driven',
            'unknown')""",
            name='ck_competitor_listings_render_type'
        ),  
    )

    # Core IDs
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    tracked_product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tracked_products.id"), nullable=False, index=True
    )
    extraction_config_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("extraction_configs.id"), nullable=True
    )

    # Scraper Information 
    url: Mapped[str] = mapped_column(Text, nullable=False)
    platform: Mapped[str] = mapped_column(String(100), server_default='unknown', nullable=False)
    discovered_by: Mapped[str] = mapped_column(String(100), server_default='manual', nullable=False)

    # Status and Verification 
    confirmed_by_user: Mapped[bool] = mapped_column(Boolean, server_default=text("false"), nullable=False)
    
    # ADDED: This was in your screenshot but not your code
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"), nullable=False)

    # Adaptive Logic Fields
    # ADDED: Necessary for tracking how aggressive a competitor's pricing is
    volatility_score: Mapped[float] = mapped_column(Float, server_default=text("0.0"), nullable=False)
    
    scrape_frequency_hours: Mapped[int] = mapped_column(Integer, server_default=text("12"), nullable=False)
    consecutive_unchanged: Mapped[int] = mapped_column(Integer, server_default=text("0"), nullable=False)

    # Tracking timestamps - FIXED: name changed to match your DB image exactly
    last_price_change_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


    discovered_api_endpoint: Mapped[Optional[str]] = mapped_column(Text,nullable=True)

    render_type: Mapped[str] = mapped_column(String(50),server_default=text("'unknown'"),nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships (The Bridges)
    tracked_product: Mapped["TrackedProduct"] = relationship(
        "TrackedProduct", back_populates="competitor_listings"
    )
    
    price_snapshots: Mapped[List["PriceSnapshot"]] = relationship(
        "PriceSnapshot", back_populates="competitor_listing", cascade="all, delete-orphan"
    )

  
    
    scrape_jobs: Mapped[List["ScrapeJob"]] = relationship(
        "ScrapeJob", back_populates="competitor_listing", cascade="all, delete-orphan"
    )
    
    extraction_config: Mapped[Optional["ExtractionConfig"]] = relationship(
        "ExtractionConfig", back_populates="competitor_listings"
    )