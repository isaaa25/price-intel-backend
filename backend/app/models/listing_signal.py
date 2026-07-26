# import uuid
# from datetime import datetime
# from sqlalchemy import text,ForeignKey,Text,NUMERIC,DateTime,func
# from sqlalchemy.dialects.postgresql import UUID,JSONB
# from sqlalchemy.orm import Mapped,mapped_column,relationship
# from app.database import Base
# from typing import Optional,TYPE_CHECKING,Any


# class ListingSignal(Base):
#     __tablename__ = "listing_signals"

#     # core id 
#     id : Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True),primary_key=True,server_default=text("gen_random_uuid()"))
#     competitor_listing_id : Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True),ForeignKey('competitor_listings.id'),nullable=False,index=True)
#     price_snapshot_id : Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True),ForeignKey('price_snapshots.id'),nullable=False) # ask when to use index= true and when no

#     nudges: Mapped[dict[str,Any]] = mapped_column(JSONB,server_default=text("'{}'::jsonb"),nullable=True)

#     warranty : Mapped[str] = mapped_column(Text,nullable=True)
    
#     partner_rating : Mapped[int] = mapped_column(NUMERIC(4,2),nullable=True)

#     positive_seller_rating : Mapped[int] = mapped_column(NUMERIC(3,1),nullable=True)

#     detected_at : Mapped[datetime] = mapped_column(DateTime(timezone=True),server_default=func.now(),nullable=False)

import uuid
from datetime import datetime
from sqlalchemy import text, ForeignKey, Text, NUMERIC, Integer, DateTime, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from typing import Optional, TYPE_CHECKING, Any

if TYPE_CHECKING:
    from app.models.competitor_listing import CompetitorListing
    from app.models.price_snapshot import PriceSnapshot


class ListingSignal(Base):
    """
    Side table for the 'extra' competitive intelligence that comes back
    from the product-page API but doesn't belong on the hot, frequently
    queried price_snapshots table: nudge messaging, warranty text, and
    seller-quality ratings. One row per price_snapshot (1:1) — kept
    separate so price_snapshots stays lean for chart/history queries,
    and this richer data is only touched when building competitor-profile
    or pattern-detection views.
    """
    __tablename__ = "listing_signals"

    # ── Core IDs ──
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )

    # Which competitor listing this signal belongs to. Indexed because
    # "show me all signal history for this competitor over time" is a
    # standard query pattern (e.g. building a competitor profile page) —
    # without the index, that becomes a full table scan once this table
    # has meaningful volume. NOT unique: many signal rows accumulate for
    # one listing over its lifetime (one per scrape that found a change).
    competitor_listing_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("competitor_listings.id"),
        nullable=False,
        index=True
    )

    # Which specific snapshot this signal data corresponds to. This is a
    # 1:1 relationship — exactly one listing_signals row is written per
    # price_snapshot insert, never more. `unique=True` enforces that
    # invariant at the database level: it becomes structurally impossible
    # to accidentally double-insert signal rows for the same snapshot,
    # even if a retry or error-handling path gets it wrong later.
    # Indexed for the same reason as above — joining signals back to
    # their snapshot (e.g. to pull price + nudges together) is routine.
    price_snapshot_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("price_snapshots.id"),
        nullable=False,
        unique=True,
        index=True
    )

    # ── Signal Data ──

    # Raw nudges array from the API, stored as-is: [{"text": ..., "icon":
    # ...}, ...]. Kept as JSONB rather than fully normalized into columns
    # because Noon can introduce new nudge types at any time (we've
    # already seen "Lowest price in 30 days", "Selling out fast", "#N in
    # Smartphones", "N+ sold recently") — storing the raw array means new
    # nudge types are captured automatically with zero schema changes.
    # The handful of nudges worth querying directly (lowest-price flag,
    # low-stock count) are already broken out as their own typed columns
    # on price_snapshots for that reason — this JSONB is the complete,
    # unopinionated record underneath those derived flags.
    #
    # Default is an empty ARRAY in JSON, '[]', not an empty OBJECT '{}' —
    # the API always returns nudges as a list, even when there's only one
    # or none. Defaulting to the wrong JSON type would mean the first real
    # insert changes the column's shape inconsistently across rows.
    nudges: Mapped[list[dict[str, Any]] | None] = mapped_column(
        JSONB,
        server_default=text("'[]'::jsonb"),
        nullable=True
    )

    # Warranty text as shown on the offer, when present (e.g. "1 Year
    # Apple Warranty"). Free text because warranty terms vary too much
    # across sellers/categories to normalize usefully right now.
    warranty: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )

    # The seller's overall partner rating on a 0–5 scale (e.g. 4.5).
    # NUMERIC(4,2): up to 99.99 — more headroom than a 0–5 scale strictly
    # needs, but keeps this consistent with how ratings are typed
    # elsewhere in the schema (price_snapshots.rating uses Float instead;
    # NUMERIC is preferred here since this feeds seller-comparison
    # analytics where exact, non-drifting values matter more than in a
    # simple star-rating display).
    partner_rating: Mapped[float | None] = mapped_column(
        NUMERIC(4, 2),
        nullable=True
    )

    # The seller's positive-rating percentage, always a whole number in
    # the actual API payload (e.g. 89, 98, 100) — never a fraction.
    # Integer, not NUMERIC(3,1): NUMERIC(3,1) maxes out at 99.9, which
    # cannot represent a perfect 100% seller score and would overflow on
    # insert the first time a seller hits it.
    positive_seller_rating: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True
    )

    # When this signal was captured. Deliberately NOT left to default
    # independently via func.now() in normal use — pass the same value as
    # the parent snapshot's `scraped_at` explicitly at insert time, so the
    # two rows stay exactly in sync for any time-series join later. The
    # server_default below is a safety net for direct/manual inserts, not
    ## the intended path for the scraper's own writes.
    detected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    # ── Relationships ──
    competitor_listing: Mapped["CompetitorListing"] = relationship(
        "CompetitorListing"
    )
    price_snapshot: Mapped["PriceSnapshot"] = relationship(
        "PriceSnapshot",back_populates="listing_signal"
    )