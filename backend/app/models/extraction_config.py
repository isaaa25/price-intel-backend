import uuid
from sqlalchemy import String, DateTime, func, text, Float,Integer,CheckConstraint


from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.database import Base
from typing import List, Optional, Any,TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.competitor_listing import CompetitorListing

class ExtractionConfig(Base):
    __tablename__ = "extraction_configs"

    __table_args__=(
        CheckConstraint(
            "status IN ('probationary','confirmed','degraded')",
            name="ck_extraction_configs_status" 
        ),
    )

    # Core identification
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    
    # Domain (e.g., 'daraz.pk') and extraction method
    domain: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    method: Mapped[str] = mapped_column(String(50), nullable=False) # 'json_ld', 'css_selector', 'api', 'llm'
    
    # Configuration storage using JSONB
    config_json: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"), nullable=False)
    
    # Performance tracking
    success_rate: Mapped[float] = mapped_column(Float, server_default=text("1.0"), nullable=False)
    
    # Timestamps
    last_verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # verified count
    verified_count: Mapped[int] = mapped_column(Integer,server_default=text("0"),nullable=False)

    status: Mapped[str] = mapped_column(String(60),server_default=text("'probationary'"),nullable=False)


    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationship back to the listings that use this config
    competitor_listings: Mapped[List["CompetitorListing"]] = relationship(
        "CompetitorListing", back_populates="extraction_config"
    )