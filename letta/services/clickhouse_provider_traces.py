import asyncio
import json
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse

from letta.helpers.singleton import singleton
from letta.schemas.provider_trace import ProviderTrace
from letta.settings import settings


def _parse_json_maybe(value: str | None) -> dict[str, Any]:
    if not value:
        return {}
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, dict) else {"_value": parsed}
    except Exception:
        # Preserve the raw payload if parsing fails (e.g. non-JSON string)
        return {"_raw": value}


def _parse_clickhouse_endpoint(endpoint: str) -> tuple[str, int, bool]:
    """Return (host, port, secure) for clickhouse_connect.get_client."""
    parsed = urlparse(endpoint)

    if parsed.scheme in ("http", "https"):
        host = parsed.hostname or ""
        port = parsed.port or (8443 if parsed.scheme == "https" else 8123)
        secure = parsed.scheme == "https"
        return host, port, secure

    # Fallback: accept raw hostname (possibly with :port)
    if ":" in endpoint:
        host, port_str = endpoint.rsplit(":", 1)
        return host, int(port_str), True

    return endpoint, 8443, True


@dataclass(frozen=True)
class ClickhouseProviderTraceRow:
    created_at: Any
    trace_id: str
    step_id: str
    request_data: str | None
    response_data: str | None


@singleton
class ClickhouseProviderTraceReader:
    def __init__(self):
        self._client = None

    def _get_client(self):
        if self._client is not None:
            return self._client

        # Import lazily so OSS users who never enable this flag don't pay import cost.
        import clickhouse_connect

        if not settings.clickhouse_endpoint:
            raise ValueError("CLICKHOUSE_ENDPOINT is required")

        host, port, secure = _parse_clickhouse_endpoint(settings.clickhouse_endpoint)
        if not host:
            raise ValueError("Invalid CLICKHOUSE_ENDPOINT")

        database = settings.clickhouse_database or "otel"
        username = settings.clickhouse_username or "default"
        password = settings.clickhouse_password
        if not password:
            raise ValueError("CLICKHOUSE_PASSWORD is required")

        self._client = clickhouse_connect.get_client(
            host=host,
            port=port,
            username=username,
            password=password,
            database=database,
            secure=secure,
            verify=True,
        )
        return self._client

    def _query_latest_row_for_step_id_sync(self, step_id: str, organization_id: str) -> ClickhouseProviderTraceRow | None:
        client = self._get_client()
        query = """
        SELECT
            Timestamp AS created_at,
            TraceId AS trace_id,
            SpanAttributes['parameter.step_id'] AS step_id,
            SpanAttributes['request_data'] AS request_data,
            SpanAttributes['response_data'] AS response_data
        FROM llm_provider_traces
        WHERE SpanAttributes['parameter.step_id'] = %(step_id)s
          AND position(SpanAttributes['parameter.actor'], %(org_match)s) > 0
        ORDER BY Timestamp DESC
        LIMIT 1
        """

        result = client.query(
            query,
            parameters={
                "step_id": step_id,
                "org_match": f"organization_id='{organization_id}'",
            },
        )

        if not result or not result.result_rows:
            return None

        row = result.result_rows[0]
        # Order matches SELECT above
        return ClickhouseProviderTraceRow(
            created_at=row[0],
            trace_id=row[1],
            step_id=row[2],
            request_data=row[3],
            response_data=row[4],
        )

    async def get_provider_trace_by_step_id_async(self, *, step_id: str, organization_id: str) -> ProviderTrace | None:
        row = await asyncio.to_thread(self._query_latest_row_for_step_id_sync, step_id, organization_id)
        if row is None:
            return None

        return ProviderTrace(
            id=f"provider_trace-{row.trace_id}",
            step_id=row.step_id,
            request_json=_parse_json_maybe(row.request_data),
            response_json=_parse_json_maybe(row.response_data),
            created_at=row.created_at,
        )
