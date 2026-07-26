"""
app/schemas/store.py

Pydantic schemas for UserStore — the missing piece that ProductCreate
needs to reference via store_id. A user must create a store first
(marketplace + country + store details), then every TrackedProduct
they add is created under one specific store.
"""

import uuid
from pydantic import BaseModel, Field
from typing import Optional


class StoreCreate(BaseModel):
    marketplace: str = Field(..., description="e.g. 'noon' or 'daraz'")
    country: str = Field(..., description="e.g. 'UAE', 'PK'")
    store_name: str
    store_slug: Optional[str] = None
    external_store_id: Optional[str] = None
    store_url: str


class StoreResponse(BaseModel):
    id: uuid.UUID
    marketplace: str
    country: str
    store_name: str
    store_url: str
    is_active: bool

    class Config:
        from_attributes = True