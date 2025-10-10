import uuid
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy import NullPool
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from letta.database_utils import get_database_uri_for_context
from letta.settings import settings

# Convert PostgreSQL URI to async format using common utility
async_pg_uri = get_database_uri_for_context(settings.letta_pg_uri, "async")

# Build engine configuration based on settings
engine_args = {
    "echo": settings.pg_echo,
    "pool_pre_ping": settings.pool_pre_ping,
}

# Configure pooling
if settings.disable_sqlalchemy_pooling:
    engine_args["poolclass"] = NullPool
else:
    # Use default AsyncAdaptedQueuePool with configured settings
    engine_args.update(
        {
            "pool_size": settings.pg_pool_size,
            "max_overflow": settings.pg_max_overflow,
            "pool_timeout": settings.pg_pool_timeout,
            "pool_recycle": settings.pg_pool_recycle,
        }
    )

# Add asyncpg-specific settings for connection
if not settings.disable_sqlalchemy_pooling:
    engine_args["connect_args"] = {
        "timeout": settings.pg_pool_timeout,
        "prepared_statement_name_func": lambda: f"__asyncpg_{uuid.uuid4()}__",
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
    }

# Create the engine once at module level
engine: AsyncEngine = create_async_engine(async_pg_uri, **engine_args)

# Create session factory once at module level
async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class DatabaseRegistry:
    """Dummy registry to maintain the existing interface."""

    @asynccontextmanager
    async def async_session(self) -> AsyncGenerator[AsyncSession, None]:
        """Get an async database session."""
        async with async_session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()


# Create singleton instance to match existing interface
db_registry = DatabaseRegistry()


# Backwards compatibility function
def get_db_registry() -> DatabaseRegistry:
    """Get the global database registry instance."""
    return db_registry


# FastAPI dependency helper
async def get_db_async() -> AsyncGenerator[AsyncSession, None]:
    """Get an async database session."""
    async with db_registry.async_session() as session:
        yield session


# Optional: cleanup function for graceful shutdown
async def close_db() -> None:
    """Close the database engine."""
    await engine.dispose()


# Usage remains the same:
# async with db_registry.async_session() as session:
#     result = await session.execute(select(User))
#     users = result.scalars().all()
