import uuid
from sqlalchemy import String, Boolean, DateTime, ForeignKey, func, text

from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.database import Base
from typing import Optional, Any, TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.competitor_listing import CompetitorListing

class Alert(Base):
    __tablename__ = "alerts"

    # Core identification
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    
    # Ownership and Context (The Tunnels)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    competitor_listing_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("competitor_listings.id"), nullable=False, index=True
    )
    # Optional link to the specific snapshot that triggered the alert
    price_snapshot_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("price_snapshots.id"), nullable=True
    )

    # Alert Content
    alert_type: Mapped[str] = mapped_column(String(100), nullable=False) # e.g., 'price_drop', 'out_of_stock'
    
    # Payload stores the "Business Story" (e.g., {"old_price": 85000, "new_price": 83000})
    payload: Mapped[dict[str, Any]] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb"), nullable=False
    )
    
    # Status
    is_read: Mapped[bool] = mapped_column(Boolean, server_default=text("false"), nullable=False)
    
    # Timestamp
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships (The Bridges)
    user: Mapped["User"] = relationship("User", back_populates="alerts")
    competitor_listing: Mapped[Optional["CompetitorListing"]] = relationship("CompetitorListing")