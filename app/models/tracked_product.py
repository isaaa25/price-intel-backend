import uuid
from sqlalchemy import String, Boolean, DateTime, ForeignKey, func,text,  NUMERIC, Text

from decimal import Decimal
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.database import Base
from typing import List, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.competitor_listing import CompetitorListing


class TrackedProduct(Base):
    __tablename__='tracked_products'

    # core identification and foreign key 
    id : Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True),primary_key=True,server_default=text("gen_random_uuid()"))
    user_id : Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True),ForeignKey("users.id"),nullable=False,index=True)

    # Product Details 
    title : Mapped[str] = mapped_column(String(255),nullable=False)
    own_cost : Mapped[Optional[Decimal]] = mapped_column(NUMERIC,nullable=True)
    own_url : Mapped[str] = mapped_column(Text,nullable=False)
    category : Mapped[Optional[str]] = mapped_column(String(255),nullable=True)

    is_active : Mapped[bool] = mapped_column(Boolean,server_default=text("true"),nullable=False)

    # time stamps 
    created_at : Mapped[datetime] = mapped_column(DateTime(timezone=True),server_default=func.now(),nullable=False)

    updated_at : Mapped[datetime] = mapped_column(DateTime(timezone=True),server_default=func.now(),onupdate=func.now(),nullable=False)

    # Relationships 
    user: Mapped["User"] = relationship("User", back_populates="tracked_products")

    competitor_listings: Mapped[List["CompetitorListing"]] = relationship(
    "CompetitorListing", back_populates="tracked_product", cascade="all, delete-orphan"
)