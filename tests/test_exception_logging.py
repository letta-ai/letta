"""
Tests for global exception logging system.
"""

import asyncio
import logging
from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from starlette.middleware.base import BaseHTTPMiddleware

from letta.exceptions.logging import add_exception_context, log_and_raise, log_exception
from letta.server.rest_api.middleware.logging import LoggingMiddleware


@pytest.fixture
def app_with_exception_middleware():
    """Create a test FastAPI app with logging middleware."""
    app = FastAPI()
    app.add_middleware(LoggingMiddleware)

    @app.get("/test-error")
    def test_error():
        raise ValueError("Test error message")

    @app.get("/test-error-with-context")
    def test_error_with_context():
        exc = ValueError("Test error with context")
        exc = add_exception_context(
            exc,
            user_id="test-user-123",
            operation="test_operation",
        )
        raise exc

    @app.get("/test-success")
    def test_success():
        return {"status": "ok"}

    return app


def test_exception_middleware_logs_basic_exception(app_with_exception_middleware):
    """Test that the middleware logs exceptions with basic context."""
    client = TestClient(app_with_exception_middleware, raise_server_exceptions=False)

    with patch("letta.server.rest_api.middleware.logging.logger") as mock_logger:
        response = client.get("/test-error")

        # Should return 500
        assert response.status_code == 500

        # Should log the error
        assert mock_logger.error.called
        call_args = mock_logger.error.call_args

        # Check the message
        assert "ValueError" in call_args[0][0]
        assert "Test error message" in call_args[0][0]

        # Check the extra context
        extra = call_args[1]["extra"]
        assert extra["exception_type"] == "ValueError"
        assert extra["exception_message"] == "Test error message"
        assert "request" in extra
        assert extra["request"]["method"] == "GET"
        assert "/test-error" in extra["request"]["path"]


def test_exception_middleware_logs_custom_context(app_with_exception_middleware):
    """Test that the middleware logs custom context attached to exceptions."""
    client = TestClient(app_with_exception_middleware, raise_server_exceptions=False)

    with patch("letta.server.rest_api.middleware.logging.logger") as mock_logger:
        response = client.get("/test-error-with-context")

        # Should return 500
        assert response.status_code == 500

        # Should log the error with custom context
        assert mock_logger.error.called
        call_args = mock_logger.error.call_args
        extra = call_args[1]["extra"]

        # Check custom context
        assert "custom_context" in extra
        assert extra["custom_context"]["user_id"] == "test-user-123"
        assert extra["custom_context"]["operation"] == "test_operation"


def test_exception_middleware_does_not_interfere_with_success(app_with_exception_middleware):
    """Test that the middleware doesn't interfere with successful requests."""
    client = TestClient(app_with_exception_middleware)

    response = client.get("/test-success")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_add_exception_context():
    """Test that add_exception_context properly attaches context to exceptions."""
    exc = ValueError("Test error")

    # Add context
    exc_with_context = add_exception_context(
        exc,
        user_id="user-123",
        agent_id="agent-456",
        operation="test_op",
    )

    # Should be the same exception object
    assert exc_with_context is exc

    # Should have context attached
    assert hasattr(exc, "__letta_context__")
    assert exc.__letta_context__["user_id"] == "user-123"
    assert exc.__letta_context__["agent_id"] == "agent-456"
    assert exc.__letta_context__["operation"] == "test_op"


def test_add_exception_context_multiple_times():
    """Test that add_exception_context can be called multiple times."""
    exc = ValueError("Test error")

    # Add context in multiple calls
    add_exception_context(exc, user_id="user-123")
    add_exception_context(exc, agent_id="agent-456")

    # Both should be present
    assert exc.__letta_context__["user_id"] == "user-123"
    assert exc.__letta_context__["agent_id"] == "agent-456"


def test_log_and_raise():
    """Test that log_and_raise logs and then raises the exception."""
    exc = ValueError("Test error")

    with patch("letta.exceptions.logging.logger") as mock_logger:
        with pytest.raises(ValueError, match="Test error"):
            log_and_raise(
                exc,
                "Operation failed",
                context={"user_id": "user-123"},
            )

        # Should have logged
        assert mock_logger.error.called
        call_args = mock_logger.error.call_args

        # Check message
        assert "Operation failed" in call_args[0][0]
        assert "ValueError" in call_args[0][0]
        assert "Test error" in call_args[0][0]

        # Check extra context
        extra = call_args[1]["extra"]
        assert extra["exception_type"] == "ValueError"
        assert extra["user_id"] == "user-123"


def test_log_exception():
    """Test that log_exception logs without raising."""
    exc = ValueError("Test error")

    with patch("letta.exceptions.logging.logger") as mock_logger:
        # Should not raise
        log_exception(
            exc,
            "Operation failed, using fallback",
            context={"user_id": "user-123"},
        )

        # Should have logged
        assert mock_logger.error.called
        call_args = mock_logger.error.call_args

        # Check message
        assert "Operation failed, using fallback" in call_args[0][0]
        assert "ValueError" in call_args[0][0]

        # Check extra context
        extra = call_args[1]["extra"]
        assert extra["exception_type"] == "ValueError"
        assert extra["user_id"] == "user-123"


def test_log_exception_with_different_levels():
    """Test that log_exception respects different log levels."""
    exc = ValueError("Test error")

    with patch("letta.exceptions.logging.logger") as mock_logger:
        # Test warning level
        log_exception(exc, "Warning message", level="warning")
        assert mock_logger.warning.called

        # Test info level
        log_exception(exc, "Info message", level="info")
        assert mock_logger.info.called


@pytest.mark.asyncio
async def test_global_exception_handler_setup():
    """Test that global exception handlers can be set up without errors."""
    from letta.server.global_exception_handler import setup_global_exception_handlers

    # Should not raise
    setup_global_exception_handlers()

    # Verify sys.excepthook was modified
    import sys

    assert sys.excepthook != sys.__excepthook__


@pytest.mark.asyncio
async def test_asyncio_exception_handler():
    """Test that asyncio exception handler can be set up."""
    from letta.server.global_exception_handler import setup_asyncio_exception_handler

    loop = asyncio.get_event_loop()

    # Should not raise
    setup_asyncio_exception_handler(loop)


def test_exception_middleware_preserves_traceback(app_with_exception_middleware):
    """Test that the middleware preserves traceback information."""
    client = TestClient(app_with_exception_middleware, raise_server_exceptions=False)

    with patch("letta.server.rest_api.middleware.logging.logger") as mock_logger:
        response = client.get("/test-error")

        assert response.status_code == 500
        call_args = mock_logger.error.call_args

        # Check that exc_info was passed (enables traceback)
        assert call_args[1]["exc_info"] is True

        # Check that traceback is in extra
        extra = call_args[1]["extra"]
        assert "traceback" in extra
        assert "ValueError" in extra["traceback"]
        assert "test_error" in extra["traceback"]
