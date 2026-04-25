from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv
import os

load_dotenv()


DATABASE_URL = os.getenv('DATABASE_URL')

if DATABASE_URL is None:
    raise ValueError("DATABASE_URL is not set in .env file")

engine = create_engine(DATABASE_URL,echo=True)

sessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False
)

Base = declarative_base()