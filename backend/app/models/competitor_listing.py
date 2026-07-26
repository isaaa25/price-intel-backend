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
    from app.models.marketplace_seller import MarketplaceSeller


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
    # new columns 
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

     # Foreign key to marketplace_sellers. Which store is this listing from?
    # Nullable because this column is Marketplace-specific. A competitor listing
    # on Daraz or Amazon will not have a marketplace_seller_id. NULL here means
    # "this listing is not from a Marketplace seller" — which is valid and expected.
    marketplace_seller_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("marketplace_sellers.id", ondelete="SET NULL"),
        nullable=True
    # ondelete=SET NULL: if the MarketplaceSeller row is deleted, this FK
    # becomes NULL. The competitor listing is preserved — you lose the
    # store association but keep the price history. Better than CASCADE
    # which would delete years of price history when you remove a store.
    )
    # The product name as it appears in the competitor's listing.
    # Nullable because the name is scraped — it might not be known until
    # the first successful scrape for this listing.
    name: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True
    # 500 chars: product names can be long.
    # "Apple iPhone 15 Pro Max 256GB Natural Titanium - Middle East Version
    #  with Apple Warranty" is 84 chars. 500 covers any edge case.
    )

    # Competitor's platform SKU for this product.
    platform_sku: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True
    # Same reasoning as tracked_products.platform_sku.
    # Nullable because it is scraped data — may not be available yet.
    )

    # Product category from the competitor's listing.
    category: Mapped[str | None] = mapped_column(
        String(300),
        nullable=True
    # Same reasoning as tracked_products.category.
    )

    # Product image URL from the competitor's listing.
    image_url: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True
        # Same reasoning as tracked_products.image_url.
    )

    # When this competitor listing was last confirmed as still active.
    last_seen_at: Mapped[datetime | None] = mapped_column(
        nullable=True
        # NULL means "never scraped yet".
        # After each scrape, update this for every listing that was found.
        # Listings where last_seen_at is older than 7 days may have been removed.
    )

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

  
    marketplace_seller: Mapped["MarketplaceSeller | None"] = relationship(
        "MarketplaceSeller", back_populates="competitor_listings"
    )


    
    scrape_jobs: Mapped[List["ScrapeJob"]] = relationship(
        "ScrapeJob", back_populates="competitor_listing", cascade="all, delete-orphan"
    )
    
    extraction_config: Mapped[Optional["ExtractionConfig"]] = relationship(
        "ExtractionConfig", back_populates="competitor_listings"
    )