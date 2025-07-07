import os
import threading
import uuid
from contextlib import asynccontextmanager, contextmanager
from typing import Any, AsyncGenerator, Generator

from rich.console import Console
from rich.panel import Panel
from rich.text import Text
from sqlalchemy import Engine, NullPool, QueuePool, create_engine
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import sessionmaker

from letta.config import LettaConfig
from letta.log import get_logger
from letta.otel.tracing import trace_method
from letta.settings import settings

logger = get_logger(__name__)


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

                engine = create_engine(settings.letta_pg_uri, **self._build_sqlalchemy_engine_args(is_async=False))

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
                async_engine = create_async_engine(async_pg_uri, **self._build_sqlalchemy_engine_args(is_async=True))
            else:
                # create sqlite async engine
                self._initialized["async"] = False
                # TODO: remove self.config
                engine_path = "sqlite+aiosqlite:///" + os.path.join(self.config.recall_storage_path, "sqlite.db")
                self.logger.info("Creating sqlite engine " + engine_path)
                async_engine = create_async_engine(engine_path, **self._build_sqlalchemy_engine_args(is_async=True))

            # Create async session factory
            self._async_engines["default"] = async_engine
            self._async_session_factories["default"] = async_sessionmaker(
                expire_on_commit=True,
                close_resets_only=False,
                autocommit=False,
                autoflush=False,
                bind=self._async_engines["default"],
                class_=AsyncSession,
            )
            self._initialized["async"] = True

    def _build_sqlalchemy_engine_args(self, *, is_async: bool) -> dict:
        """Prepare keyword arguments for create_engine / create_async_engine."""
        use_null_pool = settings.disable_sqlalchemy_pooling

        if use_null_pool:
            logger.info("Disabling pooling on SqlAlchemy")
            pool_cls = NullPool
        else:
            logger.info("Enabling pooling on SqlAlchemy")
            pool_cls = QueuePool if not is_async else None

        base_args = {
            "echo": settings.pg_echo,
            "pool_pre_ping": settings.pool_pre_ping,
        }

        if pool_cls:
            base_args["poolclass"] = pool_cls

        if not use_null_pool:
            base_args.update(
                {
                    "pool_size": settings.pg_pool_size,
                    "max_overflow": settings.pg_max_overflow,
                    "pool_timeout": settings.pg_pool_timeout,
                    "pool_recycle": settings.pg_pool_recycle,
                }
            )
            if not is_async:
                base_args.update(
                    {
                        "pool_use_lifo": settings.pool_use_lifo,
                    }
                )

        elif is_async:
            # For asyncpg, statement_cache_size should be in connect_args
            base_args.update(
                {
                    "connect_args": {
                        "timeout": settings.pg_pool_timeout,
                        "prepared_statement_name_func": lambda: f"__asyncpg_{uuid.uuid4()}__",
                        "statement_cache_size": 0,
                        "prepared_statement_cache_size": 0,
                    },
                }
            )
        return base_args

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

    def get_session_factory(self, name: str = "default") -> sessionmaker:
        """Get a session factory by name."""
        self.initialize_sync()
        return self._session_factories.get(name)

    def get_async_session_factory(self, name: str = "default") -> async_sessionmaker:
        """Get an async session factory by name."""
        self.initialize_async()
        return self._async_session_factories.get(name)

    @trace_method
    @contextmanager
    def session(self, name: str = "default") -> Generator[Any, None, None]:
        """Context manager for database sessions."""
        caller_info = "unknown caller"
        try:
            import inspect

            frame = inspect.currentframe()
            stack = inspect.getouterframes(frame)

            for i, frame_info in enumerate(stack):
                module = inspect.getmodule(frame_info.frame)
                module_name = module.__name__ if module else "unknown"

                if module_name != "contextlib" and "db.py" not in frame_info.filename:
                    caller_module = module_name
                    caller_function = frame_info.function
                    caller_lineno = frame_info.lineno
                    caller_file = frame_info.filename.split("/")[-1]

                    caller_info = f"{caller_module}.{caller_function}:{caller_lineno} ({caller_file})"
                    break
        except:
            pass
        finally:
            del frame

        self.session_caller_trace(caller_info)

        session_factory = self.get_session_factory(name)
        if not session_factory:
            raise ValueError(f"No session factory found for '{name}'")

        session = session_factory()
        try:
            yield session
        finally:
            session.close()

    @trace_method
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

    @trace_method
    def session_caller_trace(self, caller_info: str):
        """Trace sync db caller information for debugging purposes."""
        pass  # wrapper used for otel tracing only


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
