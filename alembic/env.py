import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# import our settings to get DATABASE_URL from .env
from app.config import get_settings

# import base = this is how alembic knows about your tables
from app.database import Base

# Importing all the models so they can register themselves with Base 
# without this, Alembic sees an empty databse and sees nothing
from app.models import *


# Alembic Config object - reads alembic.ini 
config = context.config

# sets up python logging from alembic.ini config 
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# tells alembic where to find your table definitions 
# this is what enables autogenerate to work 
target_metadata = Base.metadata

# Inject your real DATABASE_URL from .env into Alembic's config 
# this replaces the blank sqlalchemy.url we left in alembic.ini
settings = get_settings()
config.set_main_option("sqlalchemy.url",settings.database_url)

# We can run a migration without a live database connection 
# (used internally by Alembic, rarely matters from us)
def run_migration_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle":"named"},
    )
    with context.begin_transaction():
        context.run_migrations()


# we can also run migrations with a liva async database connection 
# this is the one which actually runs when we do alembic upgrade
def do_run_migrations(connection:Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True, # this will detect column type changes
        compare_server_default=True, # detect server default changes
    )
    with context.begin_transaction():
        context.run_migrations()

async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section,{}),
        prefix='sqlalchemy.',
        poolclass=pool.NullPool, # no connection pool for migrations
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()



def run_migrations_online() -> None:
    asyncio.run(run_async_migrations()) 

# this is the entry point -- Alembic calls this when you run any command 
if context.is_offline_mode():
    run_migration_offline()
else:
    run_migrations_online()