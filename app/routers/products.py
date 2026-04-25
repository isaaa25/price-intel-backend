from fastapi import APIRouter,Depends

from sqlalchemy.orm import Session
from app.dependencies import get_db
from app.schemas.product import ProductCreate,ProductResponse
from app.services.product_service import create_product

router = APIRouter()

@router.post("/",response_model=ProductResponse)
def add_product(product:ProductCreate,db:Session = Depends(get_db)):
    return create_product(db,product)