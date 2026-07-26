# from pydantic import BaseModel

# class ProductCreate(BaseModel):
#     title : str
#     own_url : str
#     own_cost : float
#     category : str

# class ProductResponse(BaseModel):
#     id : int

#     class Config:
#         from_attributes = True

"""
app/schemas/product.py

FIXES vs. the previous version:
    - ProductCreate now includes store_id — without it there is no way
      to populate tracked_products.store_id (NOT NULL, FK to
      user_stores), so product creation could not have been producing
      valid rows before this.
    - ProductResponse.id changed from int to uuid.UUID — tracked_products.id
      is a UUID (gen_random_uuid() default) per the schema, not an
      auto-incrementing int. The old type would have raised a
      pydantic validation error the first time a real row was returned.
    - ProductResponse expanded to include search_keyword so the
      frontend can show the user what search term will actually be
      used for discovery, and (eventually) let them edit it.
"""

import uuid
from pydantic import BaseModel
from typing import Optional


class ProductCreate(BaseModel):
    store_id: uuid.UUID
    title: str
    own_url: str
    own_cost: float
    category: Optional[str] = None


class ProductResponse(BaseModel):
    id: uuid.UUID
    store_id: uuid.UUID
    title: str
    own_url: str
    own_cost: float
    category: Optional[str] = None
    search_keyword: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True