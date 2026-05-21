import uuid
from sqlalchemy import String,Boolean,DateTime,func,text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.database import Base
from typing import List, TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.tracked_product import TrackedProduct
    from app.models.alert import Alert
# Since you are using DeclarativeBase in your database.py, the enterprise-standard way to write this now is using Mapped and mapped_column. 
# This version catches typos more easily and is optimized for the Async environment.
class User(Base):
    __tablename__= "users"

    id : Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True),primary_key=True,server_default=text("gen_random_uuid()"))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True,nullable=False)
    password_hash : Mapped[str] = mapped_column(String(255),nullable=False)

    full_name : Mapped[str | None] = mapped_column(String(255),nullable=True)
    plan : Mapped[str] = mapped_column(String(50),server_default='free',nullable=False)
    is_active : Mapped[bool] = mapped_column(server_default=text("true"),nullable=False)

    # let's create the timestamp data
    created_at : Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at : Mapped[datetime] = mapped_column(DateTime(timezone=True),server_default=func.now(),onupdate=func.now())

    # Relationship 

    tracked_products: Mapped[List["TrackedProduct"]] = relationship(
    "TrackedProduct", back_populates="user", cascade="all, delete-orphan"
)
    alerts: Mapped[List["Alert"]] = relationship(
    "Alert", back_populates="user", cascade="all, delete-orphan"
)
