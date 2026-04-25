from sqlalchemy.orm import Session
from app.models.tracked_product import TrackedProduct


def create_product(db:Session,product_data):
    product = TrackedProduct(**product_data.dict())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product
