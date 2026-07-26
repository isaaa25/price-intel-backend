import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List

from sqlalchemy import (
    String,
    Boolean,
    DateTime,
    ForeignKey,
    func,
    text,
    UniqueConstraint
    
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship


from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.tracked_product import TrackedProduct


class UserStore(Base):
    __tablename__ = "user_stores"

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "marketplace",
            "external_store_id",
            name="uq_user_store"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()")
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
        # Every store belongs to one PriceIntel user.
        # If the user is deleted, their stores should also be deleted.
    )


    marketplace: Mapped[str] = mapped_column(
        String(50),
        nullable=False
        # Examples:
        # "noon"
        # "daraz"
        #
        # String instead of Enum keeps onboarding new marketplaces easy.
    )

    country: Mapped[str] = mapped_column(
        String(30),
        nullable=False
        # Examples:
        # UAE
        # Saudi Arabia
        # Pakistan
        #
        # Required because marketplaces operate in multiple countries.
    )

    store_name: Mapped[str] = mapped_column(
        String(200),
        nullable=False
        # Human-readable store name.
        # Example:
        # "TechZone UAE"
    )

    store_slug: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True
        # Marketplace-friendly slug.
        # Example:
        # "techzone-uae"
        #
        # Nullable because not every marketplace exposes one.
    )

    external_store_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True
        # Marketplace's internal seller/store identifier.
        # Example:
        # "p-40123456"
        #
        # Nullable because different marketplaces identify stores differently.
    )

    store_url: Mapped[str] = mapped_column(
        String(1000),
        nullable=False
        # Canonical URL to the marketplace store.
        #
        # Stored so the scraper doesn't have to reconstruct URLs.
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("true")
        # Whether this store is currently being monitored.
    )


    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now()
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="stores"
    )

    tracked_products: Mapped[List["TrackedProduct"]] = relationship(
        "TrackedProduct",
        back_populates="store",
        cascade="all, delete-orphan"
    )