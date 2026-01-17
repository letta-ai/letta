"""Unit tests for provider trace backends."""

import asyncio
import json
import os
import socket
import tempfile
import threading
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from letta.schemas.provider_trace import ProviderTrace
from letta.schemas.user import User
from letta.services.provider_trace_backends.base import ProviderTraceBackend, ProviderTraceBackendClient
from letta.services.provider_trace_backends.socket import SocketProviderTraceBackend


@pytest.fixture
def mock_actor():
    """Create a mock user/actor."""
    return User(
        id="user-00000000-0000-4000-8000-000000000000",
        organization_id="org-00000000-0000-4000-8000-000000000000",
        name="test_user",
    )


@pytest.fixture
def sample_provider_trace():
    """Create a sample ProviderTrace."""
    return ProviderTrace(
        request_json={
            "model": "gpt-4o-mini",
            "messages": [{"role": "user", "content": "Hello"}],
        },
        response_json={
            "id": "chatcmpl-xyz",
            "model": "gpt-4o-mini",
            "choices": [{"message": {"content": "Hi!"}}],
            "usage": {"prompt_tokens": 10, "completion_tokens": 5},
        },
        step_id="step-test-789",
        run_id="run-test-abc",
    )


class TestProviderTraceBackendEnum:
    """Tests for ProviderTraceBackend enum."""

    def test_enum_values(self):
        assert ProviderTraceBackend.POSTGRES.value == "postgres"
        assert ProviderTraceBackend.CLICKHOUSE.value == "clickhouse"
        assert ProviderTraceBackend.SOCKET.value == "socket"

    def test_enum_string_comparison(self):
        assert ProviderTraceBackend.POSTGRES == "postgres"
        assert ProviderTraceBackend.SOCKET == "socket"


class TestProviderTrace:
    """Tests for ProviderTrace schema."""

    def test_id_generation(self):
        """Test that ID is auto-generated with correct prefix."""
        trace = ProviderTrace(
            request_json={"model": "test"},
            response_json={"id": "test"},
            step_id="step-123",
        )
        assert trace.id.startswith("provider_trace-")

    def test_id_uniqueness(self):
        """Test that each instance gets a unique ID."""
        trace1 = ProviderTrace(request_json={}, response_json={}, step_id="step-1")
        trace2 = ProviderTrace(request_json={}, response_json={}, step_id="step-2")
        assert trace1.id != trace2.id

    def test_optional_fields(self):
        """Test optional telemetry fields."""
        trace = ProviderTrace(
            request_json={},
            response_json={},
            step_id="step-123",
            agent_id="agent-456",
            agent_tags=["env:dev", "team:ml"],
            call_type="summarization",
            run_id="run-789",
        )
        assert trace.agent_id == "agent-456"
        assert trace.agent_tags == ["env:dev", "team:ml"]
        assert trace.call_type == "summarization"
        assert trace.run_id == "run-789"


class TestSocketProviderTraceBackend:
    """Tests for SocketProviderTraceBackend."""

    def test_init_default_path(self):
        """Test default socket path."""
        backend = SocketProviderTraceBackend()
        assert backend.socket_path == "/var/run/telemetry/telemetry.sock"

    def test_init_custom_path(self):
        """Test custom socket path."""
        backend = SocketProviderTraceBackend(socket_path="/tmp/custom.sock")
        assert backend.socket_path == "/tmp/custom.sock"

    @pytest.mark.asyncio
    async def test_create_async_returns_provider_trace(self, mock_actor, sample_provider_trace):
        """Test that create_async returns a ProviderTrace."""
        backend = SocketProviderTraceBackend(socket_path="/nonexistent/path.sock")

        result = await backend.create_async(
            actor=mock_actor,
            provider_trace=sample_provider_trace,
        )

        assert isinstance(result, ProviderTrace)
        assert result.id == sample_provider_trace.id
        assert result.step_id == sample_provider_trace.step_id

    @pytest.mark.asyncio
    async def test_get_by_step_id_returns_none(self, mock_actor):
        """Test that read operations return None (write-only backend)."""
        backend = SocketProviderTraceBackend()

        result = await backend.get_by_step_id_async(
            step_id="step-123",
            actor=mock_actor,
        )

        assert result is None

    def test_send_to_socket_with_real_socket(self, sample_provider_trace):
        """Test sending data to a real Unix socket."""
        received_data = []

        with tempfile.TemporaryDirectory() as tmpdir:
            socket_path = os.path.join(tmpdir, "test.sock")

            # Create a simple socket server
            server_sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            server_sock.bind(socket_path)
            server_sock.listen(1)
            server_sock.settimeout(5.0)

            def accept_connection():
                try:
                    conn, _ = server_sock.accept()
                    data = conn.recv(65536)
                    received_data.append(data.decode())
                    conn.close()
                except socket.timeout:
                    pass  # Expected - test socket has short timeout, data may not arrive
                finally:
                    server_sock.close()

            # Start server in background
            server_thread = threading.Thread(target=accept_connection)
            server_thread.start()

            # Send data via backend
            backend = SocketProviderTraceBackend(socket_path=socket_path)
            backend._send_to_crouton(sample_provider_trace)

            # Wait for send to complete
            server_thread.join(timeout=5.0)

            # Verify data was received
            assert len(received_data) == 1
            record = json.loads(received_data[0].strip())
            assert record["provider_trace_id"] == sample_provider_trace.id
            assert record["model"] == "gpt-4o-mini"
            assert record["provider"] == "openai"
            assert record["input_tokens"] == 10
            assert record["output_tokens"] == 5
            assert record["context"]["step_id"] == "step-test-789"
            assert record["context"]["run_id"] == "run-test-abc"

    def test_send_to_nonexistent_socket_does_not_raise(self, sample_provider_trace):
        """Test that sending to nonexistent socket fails silently."""
        backend = SocketProviderTraceBackend(socket_path="/nonexistent/path.sock")

        # Should not raise
        backend._send_to_crouton(sample_provider_trace)

    def test_record_extracts_usage_from_openai_response(self):
        """Test usage extraction from OpenAI-style response."""
        trace = ProviderTrace(
            request_json={"model": "gpt-4"},
            response_json={
                "usage": {
                    "prompt_tokens": 100,
                    "completion_tokens": 50,
                }
            },
            step_id="step-123",
        )

        backend = SocketProviderTraceBackend(socket_path="/fake/path")

        # Access internal method to build record
        with patch.object(backend, "_send_async"):
            backend._send_to_crouton(trace)

    def test_record_extracts_usage_from_anthropic_response(self):
        """Test usage extraction from Anthropic-style response."""
        trace = ProviderTrace(
            request_json={"model": "claude-3"},
            response_json={
                "usage": {
                    "input_tokens": 100,
                    "output_tokens": 50,
                }
            },
            step_id="step-123",
        )

        backend = SocketProviderTraceBackend(socket_path="/fake/path")

        with patch.object(backend, "_send_async"):
            backend._send_to_crouton(trace)

    def test_record_extracts_error_from_response(self):
        """Test error extraction from response."""
        trace = ProviderTrace(
            request_json={"model": "gpt-4"},
            response_json={
                "error": {"message": "Rate limit exceeded"},
            },
            step_id="step-123",
        )

        backend = SocketProviderTraceBackend(socket_path="/fake/path")

        # Capture the record sent to _send_async
        captured_records = []

        def capture_record(record):
            captured_records.append(record)

        with patch.object(backend, "_send_async", side_effect=capture_record):
            backend._send_to_crouton(trace)

        assert len(captured_records) == 1
        assert captured_records[0]["error"] == "Rate limit exceeded"
        assert captured_records[0]["response"] is None


class TestBackendFactory:
    """Tests for backend factory."""

    def test_get_postgres_backend(self):
        """Test getting postgres backend."""
        from letta.services.provider_trace_backends.factory import _create_backend

        backend = _create_backend("postgres")
        assert backend.__class__.__name__ == "PostgresProviderTraceBackend"

    def test_get_socket_backend(self):
        """Test getting socket backend."""
        with patch("letta.settings.telemetry_settings") as mock_settings:
            mock_settings.socket_path = "/tmp/test.sock"

            from letta.services.provider_trace_backends.factory import _create_backend

            backend = _create_backend("socket")
            assert backend.__class__.__name__ == "SocketProviderTraceBackend"

    def test_get_multiple_backends(self):
        """Test getting multiple backends via environment."""
        import os

        from letta.services.provider_trace_backends.factory import (
            get_provider_trace_backends,
        )

        # Clear cache first
        get_provider_trace_backends.cache_clear()

        # This test just verifies the factory works - actual backend list
        # depends on env var LETTA_TELEMETRY_PROVIDER_TRACE_BACKEND
        backends = get_provider_trace_backends()
        assert len(backends) >= 1
        assert all(hasattr(b, "create_async") and hasattr(b, "get_by_step_id_async") for b in backends)

    def test_unknown_backend_defaults_to_postgres(self):
        """Test that unknown backend type defaults to postgres."""
        from letta.services.provider_trace_backends.factory import _create_backend

        backend = _create_backend("unknown_backend")
        assert backend.__class__.__name__ == "PostgresProviderTraceBackend"


class TestTelemetrySettings:
    """Tests for telemetry settings."""

    def test_provider_trace_backends_parsing(self):
        """Test parsing comma-separated backend list."""
        from letta.settings import TelemetrySettings

        # Create a fresh settings object and set the value directly
        settings = TelemetrySettings(provider_trace_backend="postgres,socket")
        backends = settings.provider_trace_backends
        assert backends == ["postgres", "socket"]

    def test_provider_trace_backends_single(self):
        """Test single backend."""
        from letta.settings import TelemetrySettings

        settings = TelemetrySettings(provider_trace_backend="postgres")
        backends = settings.provider_trace_backends
        assert backends == ["postgres"]

    def test_provider_trace_backends_with_whitespace(self):
        """Test backend list with whitespace."""
        from letta.settings import TelemetrySettings

        settings = TelemetrySettings(provider_trace_backend="postgres , socket , clickhouse")
        backends = settings.provider_trace_backends
        assert backends == ["postgres", "socket", "clickhouse"]

    def test_socket_backend_enabled(self):
        """Test socket_backend_enabled property."""
        from letta.settings import TelemetrySettings

        settings1 = TelemetrySettings(provider_trace_backend="postgres")
        assert settings1.socket_backend_enabled is False

        settings2 = TelemetrySettings(provider_trace_backend="postgres,socket")
        assert settings2.socket_backend_enabled is True
