import os
from sqlalchemy import create_engine, inspect
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL not found in .env")

engine = create_engine(DATABASE_URL)

inspector = inspect(engine)

print("\n========== DATABASE STRUCTURE ==========\n")

tables = inspector.get_table_names()

for table in tables:
    print(f"\nTABLE: {table}")
    print("-" * 60)

    columns = inspector.get_columns(table)

    for column in columns:
        print(
            f"  Column: {column['name']}"
            f" | Type: {column['type']}"
            f" | Nullable: {column['nullable']}"
            f" | Default: {column['default']}"
        )

    print("\n  Primary Key:")
    pk = inspector.get_pk_constraint(table)
    print(f"    {pk.get('constrained_columns')}")

    print("\n  Foreign Keys:")
    fks = inspector.get_foreign_keys(table)

    if fks:
        for fk in fks:
            print(
                f"    {fk['constrained_columns']}"
                f" -> {fk['referred_table']}"
                f"({fk['referred_columns']})"
            )
    else:
        print("    None")

print("\n========== END ==========\n")