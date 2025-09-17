"""
Integration module for SQLAlchemy synchronous operation instrumentation.

This module provides easy integration with the existing Letta application,
including automatic discovery of database engines and integration with
the existing OpenTelemetry setup.
"""

import logging
from typing import Any, Dict, Optional

from letta.otel.sqlalchemy_instrumentation import (
    configure_instrumentation,
    get_instrumentation_config,
    is_instrumentation_active,
    setup_sqlalchemy_sync_instrumentation,
    teardown_sqlalchemy_sync_instrumentation,
)
from letta.server.db import db_registry

logger = logging.getLogger(__name__)


def setup_letta_db_instrumentation(
    enable_joined_monitoring: bool = True,
    sql_truncate_length: int = 1000,
    additional_config: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Set up SQLAlchemy instrumentation for Letta application.

    Args:
        enable_joined_monitoring: Whether to monitor joined loading operations
        sql_truncate_length: Maximum length of SQL statements in traces
        additional_config: Additional configuration options
    """
    if is_instrumentation_active():
        logger.info("SQLAlchemy instrumentation already active")
        return

    # Build configuration
    config = {
        "enabled": True,
        "monitor_joined_loading": enable_joined_monitoring,
        "sql_truncate_length": sql_truncate_length,
        "log_instrumentation_errors": True,
    }

    if additional_config:
        config.update(additional_config)

    # Get engines from db_registry
    engines = []
    try:
        if hasattr(db_registry, "_async_engines"):
            engines.extend(db_registry._async_engines.values())
        if hasattr(db_registry, "_sync_engines"):
            engines.extend(db_registry._sync_engines.values())
    except Exception as e:
        logger.warning(f"Could not discover engines from db_registry: {e}")

    if not engines:
        logger.warning("No SQLAlchemy engines found for instrumentation")
        return

    try:
        setup_sqlalchemy_sync_instrumentation(
            engines=engines,
            config_overrides=config,
        )
        logger.info(f"SQLAlchemy instrumentation setup complete for {len(engines)} engines")

        # Log configuration
        logger.info("Instrumentation configuration:")
        for key, value in get_instrumentation_config().items():
            logger.info(f"  {key}: {value}")

    except Exception as e:
        logger.error(f"Failed to setup SQLAlchemy instrumentation: {e}")
        raise


def teardown_letta_db_instrumentation() -> None:
    """Tear down SQLAlchemy instrumentation for Letta application."""
    if not is_instrumentation_active():
        logger.info("SQLAlchemy instrumentation not active")
        return

    try:
        teardown_sqlalchemy_sync_instrumentation()
        logger.info("SQLAlchemy instrumentation teardown complete")
    except Exception as e:
        logger.error(f"Failed to teardown SQLAlchemy instrumentation: {e}")
        raise


def configure_letta_db_instrumentation(**kwargs) -> None:
    """
    Configure SQLAlchemy instrumentation for Letta application.

    Args:
        **kwargs: Configuration options to update
    """
    configure_instrumentation(**kwargs)
    logger.info(f"SQLAlchemy instrumentation configuration updated: {kwargs}")


# FastAPI integration
def setup_fastapi_db_instrumentation(app, **config_kwargs):
    """
    Set up SQLAlchemy instrumentation for FastAPI application.

    Args:
        app: FastAPI application instance
        **config_kwargs: Configuration options for instrumentation
    """

    @app.on_event("startup")
    async def startup_db_instrumentation():
        setup_letta_db_instrumentation(**config_kwargs)

    @app.on_event("shutdown")
    async def shutdown_db_instrumentation():
        teardown_letta_db_instrumentation()
