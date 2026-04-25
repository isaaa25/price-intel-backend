from pydantic import BaseModel

class ProductCreate(BaseModel):
    title : str
    own_url : str
    own_cost : float
    category : str

class ProductResponse(BaseModel):
    id : int

    class Config:
        from_attributes = True
