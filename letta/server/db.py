import os
from contextlib import contextmanager

from rich.console import Console
from rich.panel import Panel
from rich.text import Text
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from letta.config import LettaConfig
from letta.log import get_logger
from letta.orm import Base

# NOTE: hack to see if single session management works
from letta.settings import settings

config = LettaConfig.load()

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


if settings.letta_pg_uri_no_default:
    print("Creating postgres engine")
    config.recall_storage_type = "postgres"
    config.recall_storage_uri = settings.letta_pg_uri_no_default
    config.archival_storage_type = "postgres"
    config.archival_storage_uri = settings.letta_pg_uri_no_default

    # create engine
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
else:
    # TODO: don't rely on config storage
    engine_path = "sqlite:///" + os.path.join(config.recall_storage_path, "sqlite.db")
    logger.info("Creating sqlite engine " + engine_path)

    engine = create_engine(engine_path)

    # Store the original connect method
    original_connect = engine.connect

    def wrapped_connect(*args, **kwargs):
        with db_error_handler():
            # Get the connection
            connection = original_connect(*args, **kwargs)

            # Store the original execution method
            original_execute = connection.execute

            # Wrap the execute method of the connection
            def wrapped_execute(*args, **kwargs):
                with db_error_handler():
                    return original_execute(*args, **kwargs)

            # Replace the connection's execute method
            connection.execute = wrapped_execute

            return connection

    # Replace the engine's connect method
    engine.connect = wrapped_connect

    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db_context = contextmanager(get_db)
