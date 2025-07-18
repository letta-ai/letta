import asyncio
import threading
import traceback
from contextlib import contextmanager
from functools import wraps
from typing import Any, Callable, Dict, List, Optional

from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode
from sqlalchemy import Engine, event
from sqlalchemy.orm import Session
from sqlalchemy.orm.loading import load_on_ident, load_on_pk_identity
from sqlalchemy.orm.strategies import ImmediateLoader, JoinedLoader, LazyLoader, SelectInLoader, SubqueryLoader

_config = {
    "enabled": True,
    "sql_truncate_length": 1000,
    "monitor_joined_loading": True,
    "log_instrumentation_errors": True,
}

_instrumentation_state = {
    "engine_listeners": [],
    "session_listeners": [],
    "original_methods": {},
    "active": False,
}

_context = threading.local()


def _get_tracer():
    """Get the OpenTelemetry tracer for SQLAlchemy instrumentation."""
    return trace.get_tracer("sqlalchemy_sync_instrumentation", "1.0.0")


def _is_event_loop_running() -> bool:
    """Check if an asyncio event loop is running in the current thread."""
    try:
        loop = asyncio.get_running_loop()
        return loop.is_running()
    except RuntimeError:
        return False


def _is_main_thread() -> bool:
    """Check if we're running on the main thread."""
    return threading.current_thread() is threading.main_thread()


def _truncate_sql(sql: str, max_length: int = 1000) -> str:
    """Truncate SQL statement to specified length."""
    if len(sql) <= max_length:
        return sql
    return sql[: max_length - 3] + "..."


def _create_sync_db_span(
    operation_type: str,
    sql_statement: Optional[str] = None,
    loader_type: Optional[str] = None,
    relationship_key: Optional[str] = None,
    is_joined: bool = False,
    additional_attrs: Optional[Dict[str, Any]] = None,
) -> Any:
    """
    Create an OpenTelemetry span for a synchronous database operation.

    Args:
        operation_type: Type of database operation
        sql_statement: SQL statement being executed
        loader_type: Type of SQLAlchemy loader (selectin, joined, lazy, etc.)
        relationship_key: Name of relationship attribute if applicable
        is_joined: Whether this is from joined loading
        additional_attrs: Additional attributes to add to the span

    Returns:
        OpenTelemetry span
    """
    if not _config["enabled"]:
        return None

    # Only create spans for potentially problematic operations
    if not _is_event_loop_running():
        return None

    tracer = _get_tracer()
    span = tracer.start_span("db_operation")

    # Set core attributes
    span.set_attribute("db.operation.type", operation_type)

    # SQL statement
    if sql_statement:
        span.set_attribute("db.statement", _truncate_sql(sql_statement, _config["sql_truncate_length"]))

    # Loader information
    if loader_type:
        span.set_attribute("sqlalchemy.loader.type", loader_type)
        span.set_attribute("sqlalchemy.loader.is_joined", is_joined)

    # Relationship information
    if relationship_key:
        span.set_attribute("sqlalchemy.relationship.key", relationship_key)

    # Additional attributes
    if additional_attrs:
        for key, value in additional_attrs.items():
            span.set_attribute(key, value)

    return span


def _instrument_engine_events(engine: Engine) -> None:
    """Instrument SQLAlchemy engine events to detect sync operations."""

    # Check if this is an AsyncEngine and get its sync_engine if it is
    from sqlalchemy.ext.asyncio import AsyncEngine

    if isinstance(engine, AsyncEngine):
        engine = engine.sync_engine

    def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        """Track cursor execution start."""
        if not _config["enabled"]:
            return

        # Store context for the after event
        context._sync_instrumentation_span = _create_sync_db_span(
            operation_type="cursor_execute",
            sql_statement=statement,
            additional_attrs={
                "db.executemany": executemany,
                "db.connection.info": str(conn.info),
            },
        )

    def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        """Track cursor execution completion."""
        if not _config["enabled"]:
            return

        span = getattr(context, "_sync_instrumentation_span", None)
        if span:
            span.set_status(Status(StatusCode.OK))
            span.end()
            context._sync_instrumentation_span = None

    def handle_cursor_error(conn, cursor, statement, parameters, context, executemany):
        """Handle cursor execution errors."""
        if not _config["enabled"]:
            return

        span = getattr(context, "_sync_instrumentation_span", None)
        if span:
            span.set_status(Status(StatusCode.ERROR, "Database operation failed"))
            span.end()
            context._sync_instrumentation_span = None

    # Register engine events
    event.listen(engine, "before_cursor_execute", before_cursor_execute)
    event.listen(engine, "after_cursor_execute", after_cursor_execute)
    event.listen(engine, "handle_error", handle_cursor_error)

    # Store listeners for cleanup
    _instrumentation_state["engine_listeners"].extend(
        [
            (engine, "before_cursor_execute", before_cursor_execute),
            (engine, "after_cursor_execute", after_cursor_execute),
            (engine, "handle_error", handle_cursor_error),
        ]
    )


def _instrument_loader_strategies() -> None:
    """Instrument SQLAlchemy loader strategies to detect lazy loading."""

    def create_loader_wrapper(loader_class: type, loader_type: str, is_joined: bool = False):
        """Create a wrapper for loader strategy methods."""

        def wrapper(original_method: Callable):
            @wraps(original_method)
            def instrumented_method(self, *args, **kwargs):
                # Extract relationship information if available
                relationship_key = getattr(self, "key", None)
                if hasattr(self, "parent_property"):
                    relationship_key = getattr(self.parent_property, "key", relationship_key)

                span = _create_sync_db_span(
                    operation_type="loader_strategy",
                    loader_type=loader_type,
                    relationship_key=relationship_key,
                    is_joined=is_joined,
                    additional_attrs={
                        "sqlalchemy.loader.class": loader_class.__name__,
                        "sqlalchemy.loader.method": original_method.__name__,
                    },
                )

                try:
                    result = original_method(self, *args, **kwargs)
                    if span:
                        span.set_status(Status(StatusCode.OK))
                    return result
                except Exception as e:
                    if span:
                        span.set_status(Status(StatusCode.ERROR, str(e)))
                    raise
                finally:
                    if span:
                        span.end()

            return instrumented_method

        return wrapper

    # Instrument different loader strategies
    loaders_to_instrument = [
        (SelectInLoader, "selectin", False),
        (JoinedLoader, "joined", True),
        (LazyLoader, "lazy", False),
        (SubqueryLoader, "subquery", False),
        (ImmediateLoader, "immediate", False),
    ]

    for loader_class, loader_type, is_joined in loaders_to_instrument:
        # Skip if monitoring joined loading is disabled
        if is_joined and not _config["monitor_joined_loading"]:
            continue

        wrapper = create_loader_wrapper(loader_class, loader_type, is_joined)

        # Instrument key methods
        methods_to_instrument = ["_load_for_path", "load_for_path"]

        for method_name in methods_to_instrument:
            if hasattr(loader_class, method_name):
                original_method = getattr(loader_class, method_name)
                key = f"{loader_class.__name__}.{method_name}"

                # Store original method for cleanup
                _instrumentation_state["original_methods"][key] = original_method

                # Apply wrapper
                setattr(loader_class, method_name, wrapper(original_method))

    # Instrument additional joined loading specific methods
    if _config["monitor_joined_loading"]:
        joined_methods = [
            (JoinedLoader, "_create_eager_join"),
            (JoinedLoader, "_generate_cache_key"),
        ]

        wrapper = create_loader_wrapper(JoinedLoader, "joined", True)

        for loader_class, method_name in joined_methods:
            if hasattr(loader_class, method_name):
                original_method = getattr(loader_class, method_name)
                key = f"{loader_class.__name__}.{method_name}"

                _instrumentation_state["original_methods"][key] = original_method
                setattr(loader_class, method_name, wrapper(original_method))


def _instrument_loading_functions() -> None:
    """Instrument SQLAlchemy loading functions."""

    def create_loading_wrapper(func_name: str):
        """Create a wrapper for loading functions."""

        def wrapper(original_func: Callable):
            @wraps(original_func)
            def instrumented_func(*args, **kwargs):
                span = _create_sync_db_span(
                    operation_type="loading_function",
                    additional_attrs={
                        "sqlalchemy.loading.function": func_name,
                    },
                )

                try:
                    result = original_func(*args, **kwargs)
                    if span:
                        span.set_status(Status(StatusCode.OK))
                    return result
                except Exception as e:
                    if span:
                        span.set_status(Status(StatusCode.ERROR, str(e)))
                    raise
                finally:
                    if span:
                        span.end()

            return instrumented_func

        return wrapper

    # Instrument loading functions
    import sqlalchemy.orm.loading as loading_module

    functions_to_instrument = [
        (loading_module, "load_on_ident", load_on_ident),
        (loading_module, "load_on_pk_identity", load_on_pk_identity),
    ]

    for module, func_name, original_func in functions_to_instrument:
        wrapper = create_loading_wrapper(func_name)

        # Store original function for cleanup
        _instrumentation_state["original_methods"][f"loading.{func_name}"] = original_func

        # Apply wrapper
        setattr(module, func_name, wrapper(original_func))


def _instrument_session_operations() -> None:
    """Instrument SQLAlchemy session operations."""

    def before_flush(session, flush_context, instances):
        """Track session flush operations."""
        if not _config["enabled"]:
            return

        span = _create_sync_db_span(
            operation_type="session_flush",
            additional_attrs={
                "sqlalchemy.session.new_count": len(session.new),
                "sqlalchemy.session.dirty_count": len(session.dirty),
                "sqlalchemy.session.deleted_count": len(session.deleted),
            },
        )

        # Store span in session for cleanup
        session._sync_instrumentation_flush_span = span

    def after_flush(session, flush_context):
        """Track session flush completion."""
        if not _config["enabled"]:
            return

        span = getattr(session, "_sync_instrumentation_flush_span", None)
        if span:
            span.set_status(Status(StatusCode.OK))
            span.end()
            session._sync_instrumentation_flush_span = None

    def after_flush_postexec(session, flush_context):
        """Track session flush post-execution."""
        if not _config["enabled"]:
            return

        span = getattr(session, "_sync_instrumentation_flush_span", None)
        if span:
            span.set_status(Status(StatusCode.OK))
            span.end()
            session._sync_instrumentation_flush_span = None

    # Register session events
    event.listen(Session, "before_flush", before_flush)
    event.listen(Session, "after_flush", after_flush)
    event.listen(Session, "after_flush_postexec", after_flush_postexec)

    # Store listeners for cleanup
    _instrumentation_state["session_listeners"].extend(
        [
            (Session, "before_flush", before_flush),
            (Session, "after_flush", after_flush),
            (Session, "after_flush_postexec", after_flush_postexec),
        ]
    )


def setup_sqlalchemy_sync_instrumentation(
    engines: Optional[List[Engine]] = None,
    config_overrides: Optional[Dict[str, Any]] = None,
    lazy_loading_only: bool = True,
) -> None:
    """
    Set up SQLAlchemy synchronous operation instrumentation.

    Args:
        engines: List of SQLAlchemy engines to instrument. If None, will attempt
                to discover engines automatically.
        config_overrides: Dictionary of configuration overrides.
        lazy_loading_only: If True, only instrument lazy loading operations.
    """
    if _instrumentation_state["active"]:
        return  # Already active

    try:
        # Apply configuration overrides
        if config_overrides:
            _config.update(config_overrides)

        # If lazy_loading_only is True, update config to focus on lazy loading
        if lazy_loading_only:
            _config.update(
                {
                    "monitor_joined_loading": False,  # Don't monitor joined loading
                }
            )

        # Discover engines if not provided
        if engines is None:
            engines = []
            # Try to find engines from the database registry
            try:
                from letta.server.db import db_registry

                if hasattr(db_registry, "_async_engines"):
                    engines.extend(db_registry._async_engines.values())
                if hasattr(db_registry, "_sync_engines"):
                    engines.extend(db_registry._sync_engines.values())
            except ImportError:
                pass

        # Instrument loader strategies (focus on lazy loading if specified)
        _instrument_loader_strategies()

        # Instrument loading functions
        _instrument_loading_functions()

        # Instrument session operations
        _instrument_session_operations()

        # Instrument engines last to avoid potential errors with async engines
        for engine in engines:
            try:
                _instrument_engine_events(engine)
            except Exception as e:
                if _config["log_instrumentation_errors"]:
                    print(f"Error instrumenting engine {engine}: {e}")
                    # Continue with other engines

        _instrumentation_state["active"] = True

    except Exception as e:
        if _config["log_instrumentation_errors"]:
            print(f"Error setting up SQLAlchemy instrumentation: {e}")
            import traceback

            traceback.print_exc()
        raise


def teardown_sqlalchemy_sync_instrumentation() -> None:
    """Tear down SQLAlchemy synchronous operation instrumentation."""
    if not _instrumentation_state["active"]:
        return  # Not active

    try:
        # Remove engine listeners
        for engine, event_name, listener in _instrumentation_state["engine_listeners"]:
            event.remove(engine, event_name, listener)

        # Remove session listeners
        for target, event_name, listener in _instrumentation_state["session_listeners"]:
            event.remove(target, event_name, listener)

        # Restore original methods
        for key, original_method in _instrumentation_state["original_methods"].items():
            if "." in key:
                module_or_class_name, method_name = key.rsplit(".", 1)

                if key.startswith("loading."):
                    # Restore loading function
                    import sqlalchemy.orm.loading as loading_module

                    setattr(loading_module, method_name, original_method)
                else:
                    # Restore class method
                    class_name = module_or_class_name
                    # Find the class
                    for cls in [SelectInLoader, JoinedLoader, LazyLoader, SubqueryLoader, ImmediateLoader]:
                        if cls.__name__ == class_name:
                            setattr(cls, method_name, original_method)
                            break

        # Clear state
        _instrumentation_state["engine_listeners"].clear()
        _instrumentation_state["session_listeners"].clear()
        _instrumentation_state["original_methods"].clear()
        _instrumentation_state["active"] = False

    except Exception as e:
        if _config["log_instrumentation_errors"]:
            print(f"Error tearing down SQLAlchemy instrumentation: {e}")
            traceback.print_exc()
        raise


def configure_instrumentation(**kwargs) -> None:
    """
    Configure SQLAlchemy synchronous operation instrumentation.

    Args:
        **kwargs: Configuration options to update.
    """
    _config.update(kwargs)


def get_instrumentation_config() -> Dict[str, Any]:
    """Get current instrumentation configuration."""
    return _config.copy()


def is_instrumentation_active() -> bool:
    """Check if instrumentation is currently active."""
    return _instrumentation_state["active"]


# Context manager for temporary instrumentation
@contextmanager
def temporary_instrumentation(**config_overrides):
    """
    Context manager for temporary SQLAlchemy instrumentation.

    Args:
        **config_overrides: Configuration overrides for the instrumentation.
    """
    was_active = _instrumentation_state["active"]

    if not was_active:
        setup_sqlalchemy_sync_instrumentation(config_overrides=config_overrides)

    try:
        yield
    finally:
        if not was_active:
            teardown_sqlalchemy_sync_instrumentation()


# FastAPI integration helper
def setup_fastapi_instrumentation(app):
    """
    Set up SQLAlchemy instrumentation for FastAPI application.

    Args:
        app: FastAPI application instance
    """

    @app.on_event("startup")
    async def startup_instrumentation():
        setup_sqlalchemy_sync_instrumentation()

    @app.on_event("shutdown")
    async def shutdown_instrumentation():
        teardown_sqlalchemy_sync_instrumentation()
