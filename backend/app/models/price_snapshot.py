import uuid
from decimal import Decimal
from sqlalchemy import String, DateTime, ForeignKey, func, text, NUMERIC, Float,Integer,Text,CheckConstraint,SMALLINT,Boolean

from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.database import Base
from typing import Optional,TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.competitor_listing import CompetitorListing
    from app.models.listing_signal import ListingSignal
    

class PriceSnapshot(Base):
    __tablename__='price_snapshots'

    __table_args__=(
        CheckConstraint(
            "stock_status IN ('in_stock', 'out_of_stock', 'limited', 'pre_order', 'unknown')",
            name="ck_stock_status" 
        ),
    )

    # core ID's 
    id : Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True),primary_key=True,server_default=text("gen_random_uuid()"))
    competitor_listing_id : Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True),ForeignKey('competitor_listings.id'),nullable=False,index=True)
    scrape_job_id: Mapped[Optional[uuid.UUID]] = mapped_column(
    UUID(as_uuid=True), ForeignKey('scrape_jobs.id'), nullable=True
)

    # Scraped metadata 
    seller_name : Mapped[Optional[str]] = mapped_column(String(255))
    seller_id : Mapped[Optional[str]] = mapped_column(String(255))
    product_title : Mapped[Optional[str]] = mapped_column(String(255))

    # Finanical Data
    price : Mapped[Decimal] = mapped_column(NUMERIC(12,2),nullable=False)
    currency : Mapped[str] = mapped_column(String(15),server_default='PKR',nullable=False)

    # The original (crossed-out) price shown before discount.
    # Nullable because not every product has a discount — if nothing is
    # crossed out on the page, original_price is NULL.
    # NUMERIC(10,2): up to 99,999,999.99 — covers any realistic price in AED.
    # 10 total digits, 2 decimal places. Exact arithmetic, no float rounding.
    original_price: Mapped[float | None] = mapped_column(
        NUMERIC(10, 2),
        nullable=True
    )

    # The discount percentage shown on the product listing.
    # Nullable because NULL means "no discount on this snapshot".
    # NUMERIC(5,2): up to 999.99%. In practice 0.00 to 99.99.
    # 5 total digits, 2 decimal places.
    discount_pct: Mapped[float | None] = mapped_column(
        NUMERIC(5, 2),
        nullable=True
    )

    # ── Inventory & Signal Fields (from the product-page API's offers[]) ──

    # The seller's actual unit count for this offer, straight from the API's
    # `stock` field. This is raw inventory truth — independent of whatever
    # marketing message Noon decides to show a shopper.
    # Integer, not NUMERIC: stock is always a whole number of units. Using a
    # decimal type here would be the wrong tool and waste storage for no gain.
    stock_count: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True
        # Nullable because store-scraped or older snapshots (before this
        # column existed) won't have it. NULL means "unknown", not zero.
    )

    # Whether Noon displayed a "Lowest price in N days" badge on this offer
    # at scrape time. This is a UI/marketing signal, distinct from
    # stock_count — it tells you what message the seller's price triggered,
    # not what the price or stock actually was. Two different competitors
    # can have identical prices while only one gets this badge, depending
    # on their own price history.
    is_lowest_price_nudge: Mapped[bool] = mapped_column(
        Boolean,
        server_default=text("false"),
        nullable=False
        # NOT NULL is deliberate here: this is always derivable (true or
        # false) once you've parsed the nudges array — there's no
        # legitimate "unknown" state, so NULL should never occur. Keeping
        # it NOT NULL means every downstream query can write
        # `WHERE is_lowest_price_nudge` instead of `IS TRUE` everywhere.
    )

    # The exact number Noon shows in an "Only N left in stock" urgency
    # nudge, when that nudge is present. Deliberately kept separate from
    # stock_count because Noon's displayed urgency number is not guaranteed
    # to always equal true inventory (it can be rounded, throttled, or
    # suppressed above some threshold) — this column reflects what the
    # *buyer saw*, stock_count reflects what's *actually true*.
    # Integer, not NUMERIC(3,2): a real API value of 12+ would silently
    # overflow a NUMERIC(3,2) column (max 9.99) and crash the insert.
    low_stock_nudge_value: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True
        # NULL means no low-stock nudge was shown on this snapshot —
        # which is the normal case, not a data-quality gap.
    )

    # Free-text delivery estimate as shown on the listing, e.g.
    # "Get it Tomorrow" or "GET IN 51 MINS". Kept as raw text rather than
    # parsed into a structured duration — Noon's phrasing varies enough
    # (rocket delivery vs standard) that normalizing it now would be
    # premature; store the raw signal, parse later if a real need appears.
    delivery_estimate: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
        # `str | None` matches nullable=True — the earlier draft claimed
        # `str` while allowing NULL, which would make Pylance lie about
        # the guaranteed type everywhere this column is read.
    )

    # Where this product appeared in search results (1 = first result).
    # Nullable because store-scraped products have no search position —
    # they came from a store page, not a keyword search.
    # SMALLINT: max 32,767. Search results go 1-40 per page, across maybe
    # 100 pages = max ~4,000. SMALLINT is the right size.
    search_position: Mapped[int | None] = mapped_column(
        SMALLINT,
        nullable=True
    )


    # status and analytics 
    stock_status : Mapped[Optional[str]] = mapped_column(String(50),server_default=text("'unknown'"),nullable=True)
    rating : Mapped[Optional[float]] = mapped_column(Float)
    review_count : Mapped[Optional[int]] = mapped_column(Integer,server_default=text("0"),nullable=True)

    # time stamps 
    scraped_at : Mapped[datetime] = mapped_column(DateTime(timezone=True),nullable=False)
    created_at : Mapped[datetime] = mapped_column(DateTime(timezone=True),server_default=func.now(),nullable=False)

    # Relationships 
    competitor_listing: Mapped["CompetitorListing"] = relationship(
    "CompetitorListing", back_populates="price_snapshots",
    foreign_keys=[competitor_listing_id]
)
    listing_signal: Mapped[Optional["ListingSignal"]] = relationship("ListingSignal", back_populates="price_snapshot", uselist=False)