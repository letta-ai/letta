"""Unix socket provider trace backend."""

import json
import os
import socket as socket_module
import threading
from datetime import datetime, timezone
from typing import Any

from letta.log import get_logger
from letta.schemas.provider_trace import ProviderTrace
from letta.schemas.user import User
from letta.services.provider_trace_backends.base import ProviderTraceBackendClient

logger = get_logger(__name__)

# Protocol version for crouton communication.
# Bump this when making breaking changes to the record schema.
# Must match ProtocolVersion in apps/crouton/main.go.
PROTOCOL_VERSION = 1


class SocketProviderTraceBackend(ProviderTraceBackendClient):
    """
    Store provider traces via Unix socket.

    Sends NDJSON telemetry records to a Unix socket. The receiving service
    (sidecar) is responsible for storage (e.g., GCS, S3, local filesystem).

    This is a write-only backend - reads are not supported.
    """

    def __init__(self, socket_path: str = "/var/run/telemetry/telemetry.sock"):
        self.socket_path = socket_path

    async def create_async(
        self,
        actor: User,
        provider_trace: ProviderTrace,
    ) -> ProviderTrace | None:
        self._send_to_crouton(provider_trace)

        # Return a ProviderTrace with the same ID for consistency across backends
        return ProviderTrace(
            id=provider_trace.id,
            step_id=provider_trace.step_id,
            request_json=provider_trace.request_json or {},
            response_json=provider_trace.response_json or {},
        )

    def create_sync(
        self,
        actor: User,
        provider_trace: ProviderTrace,
    ) -> ProviderTrace | None:
        self._send_to_crouton(provider_trace)
        return None

    async def get_by_step_id_async(
        self,
        step_id: str,
        actor: User,
    ) -> ProviderTrace | None:
        # Socket backend is write-only - reads should go through the storage backend directly.
        logger.warning("Socket backend does not support reads")
        return None

    def _send_to_crouton(self, provider_trace: ProviderTrace) -> None:
        """Build telemetry record and send to Crouton sidecar (fire-and-forget)."""
        response = provider_trace.response_json or {}
        request = provider_trace.request_json or {}

        # Extract error if present - handles both {"error": "msg"} and {"error": {"message": "msg"}}
        raw_error = response.get("error")
        if isinstance(raw_error, dict):
            error = raw_error.get("message")
        elif isinstance(raw_error, str):
            error = raw_error
        else:
            error = None
        error_type = response.get("error_type")

        record = {
            "protocol_version": PROTOCOL_VERSION,
            "provider_trace_id": provider_trace.id,
            "agent_id": provider_trace.agent_id,
            "run_id": provider_trace.run_id,
            "step_id": provider_trace.step_id,
            "tags": provider_trace.agent_tags or [],
            "type": provider_trace.call_type or "agent_step",
            "source": provider_trace.source,
            "request": request,
            "response": response if not error else None,
            "error": error,
            "error_type": error_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        # Fire-and-forget in background thread
        thread = threading.Thread(target=self._send_async, args=(record,), daemon=True)
        thread.start()

    def _send_async(self, record: dict[str, Any]) -> None:
        """Send record to Unix socket (runs in background thread)."""
        try:
            if not os.path.exists(self.socket_path):
                logger.warning(f"Crouton socket not found at {self.socket_path}")
                return

            with socket_module.socket(socket_module.AF_UNIX, socket_module.SOCK_STREAM) as sock:
                sock.settimeout(5.0)
                sock.connect(self.socket_path)
                payload = json.dumps(record, default=str) + "\n"
                sock.sendall(payload.encode())
        except Exception as e:
            logger.warning(f"Failed to send telemetry to Crouton: {e}")
