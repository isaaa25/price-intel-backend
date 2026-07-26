import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.competitor_listing import CompetitorListing


class MarketplaceSeller(Base):
    __tablename__ = "marketplace_sellers"

    __table_args__ = (
        UniqueConstraint(
            "marketplace",
            "country",
            "external_store_id",
            name="uq_marketplace_seller",
        ),
    )

    # ------------------------------------------------------------------
    # Core Identification
    # ------------------------------------------------------------------

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )

    # noon
    # daraz
    # amazon
    marketplace: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )

    # UAE
    # SAU
    # PAK
    country: Mapped[str] = mapped_column(
        String(15),
        nullable=False,
        server_default=text("'UAE'"),
    )

    # Marketplace's internal seller ID
    # Example:
    # p-40123456
    external_store_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )

    # Human-readable name
    store_name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )

    # Optional SEO slug
    store_slug: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    added_at: Mapped[datetime] = mapped_column(
        nullable=False,
        server_default=text("now()"),
    )

    # ------------------------------------------------------------------
    # Relationships
    # ------------------------------------------------------------------

    competitor_listings: Mapped[list["CompetitorListing"]] = relationship(
        "CompetitorListing",
        back_populates="marketplace_seller",
    )