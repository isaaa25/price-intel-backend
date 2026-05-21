

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    pool_size = 5, # Keeps 5 open connections ready
    max_overflow = 10, # Can temporarily create 10 extra connections
    pool_pre_ping = True, # PostgreSQL drops idle connections after a timeout. Without this, if your app sits idle for 10 minutes and then gets a request, SQLAlchemy might try to use a dead connection and crash. With pool_pre_ping=True, it sends a lightweight SELECT 1 before using any connection to verify it's alive.
    echo = settings.debug # Logs SQL queries in dev
)
# Engine is like a phone line to your databse. It manages the physical TCP connection pool. 
# You create it once the app starts. 


# Async factory for database sessions 
AsyncSessionLocal = async_sessionmaker(
    bind=engine, # Connects session to your engine
    autoflush=False, # Prevents automatic DB writes
    autocommit=False, # nothing is saved to the database until you explicitly call db.commit(). This is what gives you transactional safety. If your code crashes halfway through saving data, nothing partial gets written.
    expire_on_commit=False, # required for async to prevent errors after commiting 
    class_=AsyncSession
)
# Ssession is like a conversation on that phone line. It tracks everything you do -- evrey query , every update, every insert ,
# and you can either commit all at once or roll them all back if something fails. 
# You create a session for every API request, and close it when the request is done.

class Base(DeclarativeBase):
    """Base is what connects all your models to the same database. 
    Every model that inherits from Base is part of the same "registry" - SQLAlchemy knows they all belong to the same database."""
    pass # It's an ORM base class. All our models will inherit from this

