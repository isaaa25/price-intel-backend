import uuid
from sqlalchemy import String, Boolean, DateTime, ForeignKey, func,text,  NUMERIC, Text

from decimal import Decimal
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.database import Base
from typing import List, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.competitor_listing import CompetitorListing
    from app.models.user_store import UserStore
    from app.models.tracked_product_snapshot import TrackedProductSnapshot


class TrackedProduct(Base):
    __tablename__='tracked_products'

    # core identification and foreign key 
    id : Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True),primary_key=True,server_default=text("gen_random_uuid()"))

    store_id: Mapped[uuid.UUID] = mapped_column(
    UUID(as_uuid=True),
    ForeignKey("user_stores.id", ondelete="CASCADE"),
    nullable=False,
    index=True
)

    # Product Details 
    title : Mapped[str] = mapped_column(String(255),nullable=False)

    # search keyword 
    search_keyword : Mapped[Optional[str]] = mapped_column(String(300),nullable=True)
    own_cost : Mapped[Optional[Decimal]] = mapped_column(NUMERIC,nullable=True)
    own_url : Mapped[str] = mapped_column(Text,nullable=False)

    # The client's Noon product SKU — e.g. N12345678.
    # Nullable because the product might be discovered later, or the
    # client might add it manually before the first scrape runs.
    platform_sku: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True
    # 50 chars: Noon SKUs are typically 8-12 chars like N12345678.
    # 50 gives breathing room for any future platform with longer IDs.
    )
    # Product category — e.g. "Mobiles & Tablets > Smartphones".
    # Nullable because category comes from the scraper — it may not be
    # known until the first scrape runs.
    category: Mapped[str | None] = mapped_column(
        String(300),
        nullable=True
        # 300 chars for nested category paths which can be long.
        # "Electronics > Mobile Phones & Communication > Smartphones & PDAs"
        # is 64 chars. 300 covers any realistic depth.
    )

    # Product image URL from Noon.
    # Nullable because not every product has an image, and the image
    # URL is only known after the first scrape.
    image_url: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True
        # 1000 chars for URLs. Noon's CDN image URLs are typically ~120 chars
        # but can include query parameters. 1000 covers any realistic URL length.
        # Do NOT use Text here — URLs have a practical maximum length and
        # String(1000) signals that intent clearly.
    )

    # When this product was last seen by the scraper.
    # Nullable because a newly created product has never been scraped yet.
    # This field updates on every successful scrape run.
    last_seen_at: Mapped[datetime | None] = mapped_column(
        nullable=True
        # TIMESTAMPTZ — real-world timestamp with timezone.
        # NULL means "never scraped yet". This is valid and meaningful.
    )

    is_active : Mapped[bool] = mapped_column(Boolean,server_default=text("true"),nullable=False)

    # time stamps 
    created_at : Mapped[datetime] = mapped_column(DateTime(timezone=True),server_default=func.now(),nullable=False)

    updated_at : Mapped[datetime] = mapped_column(DateTime(timezone=True),server_default=func.now(),onupdate=func.now(),nullable=False)

    # Relationships 
    store: Mapped["UserStore"] = relationship(
    "UserStore",
    back_populates="tracked_products"
)

    competitor_listings: Mapped[List["CompetitorListing"]] = relationship(
    "CompetitorListing", back_populates="tracked_product", cascade="all, delete-orphan"
)
    
    own_snapshots: Mapped[List["TrackedProductSnapshot"]] = relationship(
    "TrackedProductSnapshot", back_populates="tracked_product", cascade="all, delete-orphan"
)