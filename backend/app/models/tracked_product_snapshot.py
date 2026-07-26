import uuid
from decimal import Decimal
from sqlalchemy import String, DateTime, ForeignKey, func, text, NUMERIC, Float, Integer, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.database import Base
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.tracked_product import TrackedProduct
    from app.models.scrape_job import ScrapeJob


class TrackedProductSnapshot(Base):
    """
    Price/stock history for the USER'S OWN product — the direct
    counterpart to price_snapshots, which only ever holds competitor
    data. Without this table, tracked_products.own_cost is a single
    static number with no timeline: the user's own price has no
    history to chart, compare against competitor trends, or detect
    changes in. This table exists to close that gap.

    Same append-only philosophy as price_snapshots: rows are never
    updated or deleted. A row means "at this moment, this was our own
    price/stock." Comparisons (e.g. "we're now priced above 3 of our
    4 confirmed competitors") are built by joining the latest row here
    against the latest price_snapshots row per confirmed competitor
    listing for the same tracked_product_id.
    """
    __tablename__ = "tracked_product_snapshots"

    __table_args__ = (
        CheckConstraint(
            "stock_status IN ('in_stock', 'out_of_stock', 'limited', 'unknown')",
            name="ck_tracked_product_snapshots_stock_status",
        ),
        CheckConstraint(
            "rating IS NULL OR (rating >= 0 AND rating <= 5)",
            name="ck_tracked_product_snapshots_rating",
        ),
        CheckConstraint(
            "source IN ('manual', 'scraped')",
            name="ck_tracked_product_snapshots_source",
        ),
    )

    # ── Core IDs ──────────────────────────────────────────────────────────
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    tracked_product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tracked_products.id"), nullable=False, index=True
    )
    scrape_job_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("scrape_jobs.id"), nullable=True
        # Nullable because a "manual" source row (the user typing in a
        # price update through the dashboard) has no associated scrape
        # job at all — this FK is only ever populated when source='scraped'.
    )

    # ── Financial Data ───────────────────────────────────────────────────
    # Same precision as price_snapshots.price — exact decimal arithmetic,
    # no float rounding, matches the seller's real currency amounts.
    price: Mapped[Decimal] = mapped_column(NUMERIC(12, 2), nullable=False)

    # Pre-discount price, if the seller runs their own promotions and
    # wants that reflected in their own history too. Nullable: most
    # snapshots won't have an active discount.
    original_price: Mapped[Decimal | None] = mapped_column(
        NUMERIC(10, 2),
        nullable=True
    )

    currency: Mapped[str] = mapped_column(String(15), server_default="PKR", nullable=False)

    # ── Status and Analytics ─────────────────────────────────────────────
    stock_status: Mapped[Optional[str]] = mapped_column(
        String(50),
        server_default=text("'unknown'"),
        nullable=True
    )
    rating: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    review_count: Mapped[Optional[int]] = mapped_column(
        Integer, server_default=text("0"), nullable=True
    )

    # Records HOW this snapshot was captured — 'manual' (the user typed
    # a new price into the dashboard) or 'scraped' (own_url was scraped
    # automatically, same mechanism as competitor monitoring). Kept as
    # an explicit column rather than inferred from scrape_job_id being
    # NULL, so it's directly queryable/filterable on its own ("how many
    # of our snapshots are still manual vs. automated") without having
    # to reason about a FK's nullability as a proxy for meaning.
    source: Mapped[str] = mapped_column(
        String(20), server_default=text("'manual'"), nullable=False
    )

    # ── Timestamps ────────────────────────────────────────────────────────
    scraped_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # ── Relationships ────────────────────────────────────────────────────
    tracked_product: Mapped["TrackedProduct"] = relationship(
        "TrackedProduct", back_populates="own_snapshots"
    )
    scrape_job: Mapped[Optional["ScrapeJob"]] = relationship(
        "ScrapeJob"
    )