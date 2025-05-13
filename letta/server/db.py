import os
import threading
from contextlib import asynccontextmanager, contextmanager
from typing import Any, AsyncGenerator, Generator

from rich.console import Console
from rich.panel import Panel
from rich.text import Text
from sqlalchemy import Engine, create_engine
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import sessionmaker

from letta.config import LettaConfig
from letta.log import get_logger
from letta.settings import settings


def print_sqlite_schema_error():
    """Print a formatted error message for SQLite schema issues"""
    console = Console()
    error_text = Text()
    error_text.append("Existing SQLite DB schema is invalid, and schema migrations are not supported for SQLite. ", style="bold red")
    error_text.append("To have migrations supported between Letta versions, please run Letta with Docker (", style="white")
    error_text.append("https://docs.letta.com/server/docker", style="blue underline")
    error_text.append(") or use Postgres by setting ", style="white")
    error_text.append("LETTA_PG_URI", style="yellow")
    error_text.append(".\n\n", style="white")
    error_text.append("If you wish to keep using SQLite, you can reset your database by removing the DB file with ", style="white")
    error_text.append("rm ~/.letta/sqlite.db", style="yellow")
    error_text.append(" or downgrade to your previous version of Letta.", style="white")

    console.print(Panel(error_text, border_style="red"))


@contextmanager
def db_error_handler():
    """Context manager for handling database errors"""
    try:
        yield
    except Exception as e:
        # Handle other SQLAlchemy errors
        print(e)
        print_sqlite_schema_error()
        # raise ValueError(f"SQLite DB error: {str(e)}")
        exit(1)


class DatabaseRegistry:
    """Registry for database connections and sessions.

    This class manages both synchronous and asynchronous database connections
    and provides context managers for session handling.
    """

    def __init__(self):
        self._engines: dict[str, Engine] = {}
        self._async_engines: dict[str, AsyncEngine] = {}
        self._session_factories: dict[str, sessionmaker] = {}
        self._async_session_factories: dict[str, async_sessionmaker] = {}
        self._initialized: dict[str, bool] = {"sync": False, "async": False}
        self._lock = threading.Lock()
        self.config = LettaConfig.load()
        self.logger = get_logger(__name__)

    def initialize_sync(self, force: bool = False) -> None:
        """Initialize the synchronous database engine if not already initialized."""
        with self._lock:
            if self._initialized.get("sync") and not force:
                return

            # Postgres engine
            if settings.letta_pg_uri_no_default:
                self.logger.info("Creating postgres engine")
                self.config.recall_storage_type = "postgres"
                self.config.recall_storage_uri = settings.letta_pg_uri_no_default
                self.config.archival_storage_type = "postgres"
                self.config.archival_storage_uri = settings.letta_pg_uri_no_default

                engine = create_engine(
                    settings.letta_pg_uri,
                    # f"{settings.letta_pg_uri}?options=-c%20client_encoding=UTF8",
                    pool_size=settings.pg_pool_size,
                    max_overflow=settings.pg_max_overflow,
                    pool_timeout=settings.pg_pool_timeout,
                    pool_recycle=settings.pg_pool_recycle,
                    echo=settings.pg_echo,
                    # connect_args={"client_encoding": "utf8"},
                )

                self._engines["default"] = engine
            # SQLite engine
            else:
                from letta.orm import Base

                # TODO: don't rely on config storage
                engine_path = "sqlite:///" + os.path.join(self.config.recall_storage_path, "sqlite.db")
                self.logger.info("Creating sqlite engine " + engine_path)

                engine = create_engine(engine_path)

                # Wrap the engine with error handling
                self._wrap_sqlite_engine(engine)

                Base.metadata.create_all(bind=engine)
                self._engines["default"] = engine

            # Create session factory
            self._session_factories["default"] = sessionmaker(autocommit=False, autoflush=False, bind=self._engines["default"])
            self._initialized["sync"] = True

    def initialize_async(self, force: bool = False) -> None:
        """Initialize the asynchronous database engine if not already initialized."""
        with self._lock:
            if self._initialized.get("async") and not force:
                return

            if settings.letta_pg_uri_no_default:
                self.logger.info("Creating async postgres engine")

                # Create async engine - convert URI to async format
                pg_uri = settings.letta_pg_uri
                if pg_uri.startswith("postgresql://"):
                    async_pg_uri = pg_uri.replace("postgresql://", "postgresql+asyncpg://")
                else:
                    async_pg_uri = f"postgresql+asyncpg://{pg_uri.split('://', 1)[1]}" if "://" in pg_uri else pg_uri
                async_pg_uri = async_pg_uri.replace("sslmode=", "ssl=")

                async_engine = create_async_engine(
                    async_pg_uri,
                    pool_size=settings.pg_pool_size,
                    max_overflow=settings.pg_max_overflow,
                    pool_timeout=settings.pg_pool_timeout,
                    pool_recycle=settings.pg_pool_recycle,
                    echo=settings.pg_echo,
                )

                self._async_engines["default"] = async_engine

                # Create async session factory
                self._async_session_factories["default"] = async_sessionmaker(
                    autocommit=False, autoflush=False, bind=self._async_engines["default"], class_=AsyncSession
                )
                self._initialized["async"] = True
            else:
                self.logger.warning("Async SQLite is currently not supported. Please use PostgreSQL for async database operations.")
                # TODO (cliandy): unclear around async sqlite support in sqlalchemy, we will not currently support this
                self._initialized["async"] = False

    def _wrap_sqlite_engine(self, engine: Engine) -> None:
        """Wrap SQLite engine with error handling."""
        original_connect = engine.connect

        def wrapped_connect(*args, **kwargs):
            with db_error_handler():
                connection = original_connect(*args, **kwargs)
                original_execute = connection.execute

                def wrapped_execute(*args, **kwargs):
                    with db_error_handler():
                        return original_execute(*args, **kwargs)

                connection.execute = wrapped_execute
                return connection

        engine.connect = wrapped_connect

    def get_engine(self, name: str = "default") -> Engine:
        """Get a database engine by name."""
        self.initialize_sync()
        return self._engines.get(name)

    def get_async_engine(self, name: str = "default") -> AsyncEngine:
        """Get an async database engine by name."""
        self.initialize_async()
        return self._async_engines.get(name)

    def get_session_factory(self, name: str = "default") -> sessionmaker:
        """Get a session factory by name."""
        self.initialize_sync()
        return self._session_factories.get(name)

    def get_async_session_factory(self, name: str = "default") -> async_sessionmaker:
        """Get an async session factory by name."""
        self.initialize_async()
        return self._async_session_factories.get(name)

    @contextmanager
    def session(self, name: str = "default") -> Generator[Any, None, None]:
        """Context manager for database sessions."""
        session_factory = self.get_session_factory(name)
        if not session_factory:
            raise ValueError(f"No session factory found for '{name}'")

        session = session_factory()
        try:
            yield session
        finally:
            session.close()

    @asynccontextmanager
    async def async_session(self, name: str = "default") -> AsyncGenerator[AsyncSession, None]:
        """Async context manager for database sessions."""
        session_factory = self.get_async_session_factory(name)
        if not session_factory:
            raise ValueError(f"No async session factory found for '{name}' or async database is not configured")

        session = session_factory()
        try:
            yield session
        finally:
            await session.close()


# Create a singleton instance
db_registry = DatabaseRegistry()


def get_db():
    """Get a database session."""
    with db_registry.session() as session:
        yield session


async def get_db_async():
    """Get an async database session."""
    async with db_registry.async_session() as session:
        yield session


# Prefer calling db_registry.session() or db_registry.async_session() directly
# This is for backwards compatibility
db_context = contextmanager(get_db)
