import asyncio

from app.database import engine, Base

# Import the models so SQLAlchemy registers
# all tables in Base.metadata.
from app import models


async def create_tables():
    print("Connecting to PostgreSQL...")
    print("Creating database tables...")

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    print("\nDatabase schema created successfully!")

    # Show the tables that SQLAlchemy knows about
    print("\nTables registered in Base.metadata:")

    for table_name in Base.metadata.tables:
        print(f"  - {table_name}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(create_tables())