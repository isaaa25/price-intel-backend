from fastapi import FastAPI
from app.routers.routes import products

app = FastAPI()

app.include_router(products.router,prefix="/products",tags=["Products"])

@app.get("/")
def root():
    return {"message": "Price Intel API running"}
