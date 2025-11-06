import json
import logging
import traceback
from datetime import datetime, timezone
from logging.config import dictConfig
from pathlib import Path
from sys import stdout
from typing import Any, Optional

from letta.log_context import get_log_context
from letta.settings import log_settings, settings, telemetry_settings

selected_log_level = logging.DEBUG if settings.debug else logging.INFO


class JSONFormatter(logging.Formatter):
    """
    Custom JSON formatter for structured logging with Datadog integration.

    Outputs logs in JSON format with fields compatible with Datadog log ingestion.
    Automatically includes trace correlation fields when Datadog tracing is enabled.

    Usage:
        Enable JSON logging by setting the environment variable:
            LETTA_LOGGING_JSON_LOGGING=true

        Add custom structured fields to logs using the 'extra' parameter:
            logger.info("User action", extra={"user_id": "123", "action": "login"})

        These fields will be automatically included in the JSON output and
        indexed by Datadog for filtering and analysis.

    Output format:
        {
            "timestamp": "2025-10-23T18:34:24.931739+00:00",
            "level": "INFO",
            "logger": "Letta.module",
            "message": "Log message",
            "module": "module_name",
            "function": "function_name",
            "line": 123,
            "dd.trace_id": "1234567890",  # Added when Datadog tracing is enabled
            "dd.span_id": "9876543210",   # Added when Datadog tracing is enabled
            "custom_field": "custom_value" # Any extra fields you provide
        }
    """

    def format(self, record: logging.LogRecord) -> str:
        """Format log record as JSON with Datadog-compatible fields."""
        # Base log structure
        log_data: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # Add Datadog trace correlation if available
        # ddtrace automatically injects these attributes when logging is patched
        if hasattr(record, "dd.trace_id"):
            log_data["dd.trace_id"] = getattr(record, "dd.trace_id")
        if hasattr(record, "dd.span_id"):
            log_data["dd.span_id"] = getattr(record, "dd.span_id")
        if hasattr(record, "dd.service"):
            log_data["dd.service"] = getattr(record, "dd.service")
        if hasattr(record, "dd.env"):
            log_data["dd.env"] = getattr(record, "dd.env")
        if hasattr(record, "dd.version"):
            log_data["dd.version"] = getattr(record, "dd.version")

        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = {
                "type": record.exc_info[0].__name__ if record.exc_info[0] else None,
                "message": str(record.exc_info[1]) if record.exc_info[1] else None,
                "stacktrace": "".join(traceback.format_exception(*record.exc_info)),
            }

        # Add any extra fields from the log record
        # These are custom fields passed via logging.info("msg", extra={...})
        for key, value in record.__dict__.items():
            if key not in [
                "name",
                "msg",
                "args",
                "created",
                "filename",
                "funcName",
                "levelname",
                "levelno",
                "lineno",
                "module",
                "msecs",
                "message",
                "pathname",
                "process",
                "processName",
                "relativeCreated",
                "thread",
                "threadName",
                "exc_info",
                "exc_text",
                "stack_info",
                "dd_env",
                "dd_service",
            ] and not key.startswith("dd."):
                log_data[key] = value

        return json.dumps(log_data, default=str)


class DatadogEnvFilter(logging.Filter):
    """
    Logging filter that adds Datadog-specific attributes to log records.

    This enables log-trace correlation by injecting environment and service metadata
    that Datadog can use to link logs with traces and other telemetry data.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        """Add Datadog attributes to log record if Datadog is enabled."""
        if telemetry_settings.enable_datadog:
            record.dd_env = telemetry_settings.datadog_env
            record.dd_service = "letta-server"
        else:
            # Provide defaults to prevent attribute errors if filter is applied incorrectly
            record.dd_env = ""
            record.dd_service = ""
        return True


class LogContextFilter(logging.Filter):
    """
    Logging filter that enriches log records with request context.

    Injects context-specific attributes like actor_id, agent_id, org_id, etc.
    into log records. These attributes are stored in a context variable
    and automatically included in all log messages within that context.

    This enables correlation of logs with specific requests, agents, and users
    in monitoring systems like Datadog.

    Usage:
        from letta.log_context import set_log_context, update_log_context

        # Set a single context value
        set_log_context("agent_id", "agent-123")

        # Set multiple context values
        update_log_context(agent_id="agent-123", actor_id="user-456")

        # All subsequent logs will include these attributes
        logger.info("Processing request")
        # Output: {"message": "Processing request", "agent_id": "agent-123", "actor_id": "user-456", ...}
    """

    def filter(self, record: logging.LogRecord) -> bool:
        """Add request context attributes to log record."""
        context = get_log_context()
        for key, value in context.items():
            if not hasattr(record, key):
                setattr(record, key, value)
        return True


def _setup_logfile() -> "Path":
    """ensure the logger filepath is in place

    Returns: the logfile Path
    """
    logfile = Path(settings.letta_dir / "logs" / "Letta.log")
    logfile.parent.mkdir(parents=True, exist_ok=True)
    logfile.touch(exist_ok=True)
    return logfile


# Determine which formatter to use based on configuration
def _get_console_formatter() -> str:
    """Determine the appropriate console formatter based on settings."""
    if log_settings.json_logging:
        return "json"
    elif telemetry_settings.enable_datadog:
        return "datadog"
    else:
        return "no_datetime"


def _get_file_formatter() -> str:
    """Determine the appropriate file formatter based on settings."""
    if log_settings.json_logging:
        return "json"
    elif telemetry_settings.enable_datadog:
        return "datadog"
    else:
        return "standard"


# Logging configuration with optional Datadog integration and JSON support
DEVELOPMENT_LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,  # Allow capturing from all loggers
    "formatters": {
        "standard": {"format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s"},
        "no_datetime": {"format": "%(name)s - %(levelname)s - %(message)s"},
        "datadog": {
            # Datadog-compatible format with key=value pairs for better parsing
            # ddtrace's log injection will add dd.trace_id, dd.span_id automatically when logging is patched
            "format": "%(asctime)s - %(name)s - %(levelname)s - [dd.env=%(dd_env)s dd.service=%(dd_service)s] - %(message)s"
        },
        "json": {
            # JSON formatter for structured logging with full Datadog integration
            "()": JSONFormatter,
        },
    },
    "filters": {
        "datadog_env": {
            "()": DatadogEnvFilter,
        },
        "log_context": {
            "()": LogContextFilter,
        },
    },
    "handlers": {
        "console": {
            "level": selected_log_level,
            "class": "logging.StreamHandler",
            "stream": stdout,
            "formatter": _get_console_formatter(),
            "filters": (["datadog_env"] if telemetry_settings.enable_datadog and not log_settings.json_logging else []) + ["log_context"],
        },
        "file": {
            "level": "DEBUG",
            "class": "logging.handlers.RotatingFileHandler",
            "filename": _setup_logfile(),
            "maxBytes": 1024**2 * 10,  # 10 MB per file
            "backupCount": 3,  # Keep 3 backup files
            "formatter": _get_file_formatter(),
            "filters": (["datadog_env"] if telemetry_settings.enable_datadog and not log_settings.json_logging else []) + ["log_context"],
        },
    },
    "root": {  # Root logger handles all logs
        "level": logging.DEBUG if settings.debug else logging.INFO,
        "handlers": ["console", "file"],
    },
    "loggers": {
        "Letta": {
            "level": logging.DEBUG if settings.debug else logging.INFO,
            "propagate": True,  # Let logs bubble up to root
        },
        "uvicorn": {
            "level": "CRITICAL",
            "handlers": ["console"],
            "propagate": True,
        },
        # Reduce noise from ddtrace internal logging
        "ddtrace": {
            "level": "WARNING",
            "propagate": True,
        },
    },
}

# Configure logging once at module initialization to avoid performance overhead
dictConfig(DEVELOPMENT_LOGGING)


def get_logger(name: Optional[str] = None) -> "logging.Logger":
    """returns the project logger, scoped to a child name if provided
    Args:
        name: will define a child logger
    """
    parent_logger = logging.getLogger("Letta")
    if name:
        return parent_logger.getChild(name)
    return parent_logger
