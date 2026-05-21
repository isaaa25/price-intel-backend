import uuid
from decimal import Decimal
from sqlalchemy import String, DateTime, ForeignKey, func, text, NUMERIC, Float,Integer,Text,CheckConstraint

from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.database import Base
from typing import Optional,TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.competitor_listing import CompetitorListing
    

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
    original_price : Mapped[Optional[Decimal]] = mapped_column(NUMERIC(12,2))
    currency : Mapped[str] = mapped_column(String(15),server_default='PKR',nullable=False)

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