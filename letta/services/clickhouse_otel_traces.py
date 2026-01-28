import asyncio
from typing import Any
from urllib.parse import urlparse

from letta.helpers.singleton import singleton
from letta.settings import settings


def _parse_clickhouse_endpoint(endpoint: str) -> tuple[str, int, bool]:
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


@singleton
class ClickhouseOtelTracesReader:
    def __init__(self):
        pass

    def _get_client(self):
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

        return clickhouse_connect.get_client(
            host=host,
            port=port,
            username=username,
            password=password,
            database=database,
            secure=secure,
            verify=True,
        )

    def _get_traces_by_trace_id_sync(self, trace_id: str, limit: int, filter_ui_spans: bool = False) -> list[dict[str, Any]]:
        client = self._get_client()

        if filter_ui_spans:
            # Only return spans used by the trace viewer UI:
            # - agent_step: step events
            # - *._execute_tool: tool execution details
            # - root spans (no parent): request info
            # - time_to_first_token: TTFT measurement
            query = """
            SELECT *
            FROM otel_traces
            WHERE TraceId = %(trace_id)s
              AND (
                SpanName = 'agent_step'
                OR SpanName LIKE '%%._execute_tool'
                OR ParentSpanId = ''
                OR SpanName = 'time_to_first_token'
              )
            ORDER BY Timestamp ASC
            LIMIT %(limit)s
            """
        else:
            query = """
            SELECT *
            FROM otel_traces
            WHERE TraceId = %(trace_id)s
            ORDER BY Timestamp ASC
            LIMIT %(limit)s
            """

        result = client.query(query, parameters={"trace_id": trace_id, "limit": limit})
        if not result or not result.result_rows:
            return []

        cols = list(result.column_names)
        return [dict(zip(cols, row)) for row in result.result_rows]

    async def get_traces_by_trace_id_async(
        self, *, trace_id: str, limit: int = 1000, filter_ui_spans: bool = False
    ) -> list[dict[str, Any]]:
        return await asyncio.to_thread(self._get_traces_by_trace_id_sync, trace_id, limit, filter_ui_spans)
