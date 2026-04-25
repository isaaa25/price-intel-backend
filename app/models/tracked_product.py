from sqlalchemy import Column,Integer,String,Float,ForeignKey

from app.database import Base

class TrackedProduct(Base):
    __tablename__ = "tracked_products"

    id = Column(Integer,primary_key=True,index=True)
    user_id = Column(Integer)
    title = Column(String)
    own_url = Column(String)
    own_cost = Column(Float)
    category = Column(String)