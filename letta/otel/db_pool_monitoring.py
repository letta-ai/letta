import time
from typing import Any

from sqlalchemy import Engine, PoolProxiedConnection, QueuePool, event
from sqlalchemy.engine.interfaces import DBAPIConnection
from sqlalchemy.ext.asyncio import AsyncEngine
from sqlalchemy.pool import ConnectionPoolEntry, Pool

from letta.helpers.datetime_helpers import get_utc_timestamp_ns, ns_to_ms
from letta.log import get_logger
from letta.otel.context import get_ctx_attributes

logger = get_logger(__name__)


class DatabasePoolMonitor:
    """Monitor database connection pool metrics and events using SQLAlchemy event listeners."""

    def __init__(self):
        self._active_connections: dict[int, dict[str, Any]] = {}
        self._pool_stats: dict[str, dict[str, Any]] = {}

    def setup_monitoring(self, engine: Engine | AsyncEngine, engine_name: str = "default") -> None:
        """Set up connection pool monitoring for the given engine."""
        if not hasattr(engine, "pool"):
            logger.warning(f"Engine {engine_name} does not have a pool attribute")
            return

        try:
            self._setup_pool_listeners(engine.pool, engine_name)
            logger.info(f"Database pool monitoring initialized for engine: {engine_name}")
        except Exception as e:
            logger.error(f"Failed to setup pool monitoring for {engine_name}: {e}")

    def _setup_pool_listeners(self, pool: Pool, engine_name: str) -> None:
        """Set up event listeners for the connection pool."""

        @event.listens_for(pool, "connect")
        def on_connect(dbapi_connection: DBAPIConnection, connection_record: ConnectionPoolEntry):
            """Called when a new connection is created."""
            connection_id = id(connection_record)

            self._active_connections[connection_id] = {
                "engine_name": engine_name,
                "created_at": time.time(),
                "checked_out_at": None,
                "checked_in_at": None,
                "checkout_count": 0,
            }

            try:
                from letta.otel.metric_registry import MetricRegistry

                attrs = {
                    "engine_name": engine_name,
                    "event": "connect",
                    **get_ctx_attributes(),
                }
                MetricRegistry().db_pool_connection_events_counter.add(1, attributes=attrs)
            except Exception as e:
                logger.info(f"Failed to record connection event metric: {e}")

        @event.listens_for(pool, "first_connect")
        def on_first_connect(dbapi_connection: DBAPIConnection, connection_record: ConnectionPoolEntry):
            """Called when the first connection is created."""
            try:
                from letta.otel.metric_registry import MetricRegistry

                attrs = {
                    "engine_name": engine_name,
                    "event": "first_connect",
                    **get_ctx_attributes(),
                }
                MetricRegistry().db_pool_connection_events_counter.add(1, attributes=attrs)
                logger.info(f"First connection established for engine: {engine_name}")
            except Exception as e:
                logger.info(f"Failed to record first_connect event metric: {e}")

        @event.listens_for(pool, "checkout")
        def on_checkout(dbapi_connection: DBAPIConnection, connection_record: ConnectionPoolEntry, connection_proxy: PoolProxiedConnection):
            """Called when a connection is checked out from the pool."""
            connection_id = id(connection_record)
            checkout_start_ns = get_utc_timestamp_ns()

            if connection_id in self._active_connections:
                self._active_connections[connection_id]["checked_out_at_ns"] = checkout_start_ns
                self._active_connections[connection_id]["checkout_count"] += 1

            try:
                from letta.otel.metric_registry import MetricRegistry

                attrs = {
                    "engine_name": engine_name,
                    **get_ctx_attributes(),
                }
                # Record current pool statistics
                if isinstance(pool, QueuePool):
                    pool_stats = self._get_pool_stats(pool)
                    MetricRegistry().db_pool_connections_checked_out_gauge.set(pool_stats["checked_out"], attributes=attrs)
                    MetricRegistry().db_pool_connections_available_gauge.set(pool_stats["available"], attributes=attrs)
                    MetricRegistry().db_pool_connections_total_gauge.set(pool_stats["total"], attributes=attrs)
                    if pool_stats["overflow"] is not None:
                        MetricRegistry().db_pool_connections_overflow_gauge.set(pool_stats["overflow"], attributes=attrs)

                # Record checkout event
                attrs["event"] = "checkout"
                MetricRegistry().db_pool_connection_events_counter.add(1, attributes=attrs)

            except Exception as e:
                logger.info(f"Failed to record checkout event metric: {e}")

        @event.listens_for(pool, "checkin")
        def on_checkin(dbapi_connection: DBAPIConnection, connection_record: ConnectionPoolEntry):
            """Called when a connection is checked back into the pool."""
            connection_id = id(connection_record)
            checkin_time_ns = get_utc_timestamp_ns()

            if connection_id in self._active_connections:
                conn_info = self._active_connections[connection_id]
                conn_info["checkin_time_ns"] = checkin_time_ns

                # Calculate connection duration if we have checkout time
                if conn_info["checked_out_at_ns"]:
                    duration_ms = ns_to_ms(checkin_time_ns - conn_info["checked_out_at_ns"])

                    try:
                        from letta.otel.metric_registry import MetricRegistry

                        attrs = {
                            "engine_name": engine_name,
                            **get_ctx_attributes(),
                        }
                        MetricRegistry().db_pool_connection_duration_ms_histogram.record(duration_ms, attributes=attrs)
                    except Exception as e:
                        logger.info(f"Failed to record connection duration metric: {e}")

            try:
                from letta.otel.metric_registry import MetricRegistry

                attrs = {
                    "engine_name": engine_name,
                    **get_ctx_attributes(),
                }

                # Record current pool statistics after checkin
                if isinstance(pool, QueuePool):
                    pool_stats = self._get_pool_stats(pool)
                    MetricRegistry().db_pool_connections_checked_out_gauge.set(pool_stats["checked_out"], attributes=attrs)
                    MetricRegistry().db_pool_connections_available_gauge.set(pool_stats["available"], attributes=attrs)

                # Record checkin event
                attrs["event"] = "checkin"
                MetricRegistry().db_pool_connection_events_counter.add(1, attributes=attrs)

            except Exception as e:
                logger.info(f"Failed to record checkin event metric: {e}")

        @event.listens_for(pool, "invalidate")
        def on_invalidate(dbapi_connection: DBAPIConnection, connection_record: ConnectionPoolEntry, exception):
            """Called when a connection is invalidated."""
            connection_id = id(connection_record)

            if connection_id in self._active_connections:
                del self._active_connections[connection_id]

            try:
                from letta.otel.metric_registry import MetricRegistry

                attrs = {
                    "engine_name": engine_name,
                    "event": "invalidate",
                    "exception_type": type(exception).__name__ if exception else "unknown",
                    **get_ctx_attributes(),
                }
                MetricRegistry().db_pool_connection_events_counter.add(1, attributes=attrs)
                MetricRegistry().db_pool_connection_errors_counter.add(1, attributes=attrs)
            except Exception as e:
                logger.info(f"Failed to record invalidate event metric: {e}")

        @event.listens_for(pool, "soft_invalidate")
        def on_soft_invalidate(dbapi_connection: DBAPIConnection, connection_record: ConnectionPoolEntry, exception):
            """Called when a connection is soft invalidated."""
            try:
                from letta.otel.metric_registry import MetricRegistry

                attrs = {
                    "engine_name": engine_name,
                    "event": "soft_invalidate",
                    "exception_type": type(exception).__name__ if exception else "unknown",
                    **get_ctx_attributes(),
                }
                MetricRegistry().db_pool_connection_events_counter.add(1, attributes=attrs)
                logger.debug(f"Connection soft invalidated for engine: {engine_name}")
            except Exception as e:
                logger.info(f"Failed to record soft_invalidate event metric: {e}")

        @event.listens_for(pool, "close")
        def on_close(dbapi_connection: DBAPIConnection, connection_record: ConnectionPoolEntry):
            """Called when a connection is closed."""
            connection_id = id(connection_record)

            if connection_id in self._active_connections:
                del self._active_connections[connection_id]

            try:
                from letta.otel.metric_registry import MetricRegistry

                attrs = {
                    "engine_name": engine_name,
                    "event": "close",
                    **get_ctx_attributes(),
                }
                MetricRegistry().db_pool_connection_events_counter.add(1, attributes=attrs)
            except Exception as e:
                logger.info(f"Failed to record close event metric: {e}")

        @event.listens_for(pool, "close_detached")
        def on_close_detached(dbapi_connection: DBAPIConnection):
            """Called when a detached connection is closed."""
            try:
                from letta.otel.metric_registry import MetricRegistry

                attrs = {
                    "engine_name": engine_name,
                    "event": "close_detached",
                    **get_ctx_attributes(),
                }
                MetricRegistry().db_pool_connection_events_counter.add(1, attributes=attrs)
                logger.debug(f"Detached connection closed for engine: {engine_name}")
            except Exception as e:
                logger.info(f"Failed to record close_detached event metric: {e}")

        @event.listens_for(pool, "detach")
        def on_detach(dbapi_connection: DBAPIConnection, connection_record: ConnectionPoolEntry):
            """Called when a connection is detached from the pool."""
            connection_id = id(connection_record)

            if connection_id in self._active_connections:
                self._active_connections[connection_id]["detached"] = True

            try:
                from letta.otel.metric_registry import MetricRegistry

                attrs = {
                    "engine_name": engine_name,
                    "event": "detach",
                    **get_ctx_attributes(),
                }
                MetricRegistry().db_pool_connection_events_counter.add(1, attributes=attrs)
                logger.debug(f"Connection detached from pool for engine: {engine_name}")
            except Exception as e:
                logger.info(f"Failed to record detach event metric: {e}")

        @event.listens_for(pool, "reset")
        def on_reset(dbapi_connection: DBAPIConnection, connection_record: ConnectionPoolEntry, reset_state):
            """Called when a connection is reset."""
            try:
                from letta.otel.metric_registry import MetricRegistry

                attrs = {
                    "engine_name": engine_name,
                    "event": "reset",
                    **get_ctx_attributes(),
                }
                MetricRegistry().db_pool_connection_events_counter.add(1, attributes=attrs)
                logger.debug(f"Connection reset for engine: {engine_name}")
            except Exception as e:
                logger.info(f"Failed to record reset event metric: {e}")

        # Note: dispatch is not a listenable event, it's a method for custom events
        # If you need to track custom dispatch events, you would need to implement them separately

    # noinspection PyProtectedMember
    @staticmethod
    def _get_pool_stats(pool: Pool) -> dict[str, Any]:
        """Get current pool statistics."""
        stats = {
            "total": 0,
            "checked_out": 0,
            "available": 0,
            "overflow": None,
        }

        try:
            if not isinstance(pool, QueuePool):
                logger.info("Not currently supported for non-QueuePools")

            stats["total"] = pool._pool.maxsize
            stats["available"] = pool._pool.qsize()
            stats["overflow"] = pool._overflow
            stats["checked_out"] = stats["total"] - stats["available"]

        except Exception as e:
            logger.info(f"Failed to get pool stats: {e}")
        return stats


# Global instance
_pool_monitor = DatabasePoolMonitor()


def get_pool_monitor() -> DatabasePoolMonitor:
    """Get the global database pool monitor instance."""
    return _pool_monitor


def setup_pool_monitoring(engine: Engine | AsyncEngine, engine_name: str = "default") -> None:
    """Set up connection pool monitoring for the given engine."""
    _pool_monitor.setup_monitoring(engine, engine_name)
