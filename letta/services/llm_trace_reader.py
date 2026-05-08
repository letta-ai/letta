"""ClickHouse reader for LLM analytics traces.

Reads LLM traces from ClickHouse for debugging, analytics, and auditing.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime
from typing import Any, List, Optional
from urllib.parse import urlparse

from letta.helpers.singleton import singleton
from letta.log import get_logger
from letta.schemas.llm_trace import LLMTrace
from letta.settings import settings

logger = get_logger(__name__)


def _parse_clickhouse_endpoint(endpoint: str) -> tuple[str, int, bool]:
    """Return (host, port, secure) for clickhouse_connect.get_client.

    Supports:
    - http://host:port -> (host, port, False)
    - https://host:port -> (host, port, True)
    - host:port -> (host, port, False)  # Default to insecure for local dev
    - host -> (host, 8123, False)  # Default HTTP port, insecure
    """
    parsed = urlparse(endpoint)

    if parsed.scheme in ("http", "https"):
        host = parsed.hostname or ""
        port = parsed.port or (8443 if parsed.scheme == "https" else 8123)
        secure = parsed.scheme == "https"
        return host, port, secure

    # Fallback: accept raw hostname (possibly with :port)
    # Default to insecure (HTTP) for local development
    if ":" in endpoint:
        host, port_str = endpoint.rsplit(":", 1)
        return host, int(port_str), False

    return endpoint, 8123, False


@dataclass(frozen=True)
class LLMTraceRow:
    """Raw row from ClickHouse query."""

    id: str
    organization_id: str
    project_id: str
    agent_id: str
    agent_tags: List[str]
    run_id: str
    step_id: str
    trace_id: str
    call_type: str
    provider: str
    model: str
    is_byok: bool
    request_size_bytes: int
    response_size_bytes: int
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    cached_input_tokens: Optional[int]
    cache_write_tokens: Optional[int]
    reasoning_tokens: Optional[int]
    latency_ms: int
    is_error: bool
    error_type: str
    error_message: str
    request_json: str
    response_json: str
    llm_config_json: str
    created_at: datetime


@singleton
class LLMTraceReader:
    """
    ClickHouse reader for raw LLM traces.

    Provides query methods for debugging, analytics, and auditing.

    Usage:
        reader = LLMTraceReader()
        trace = await reader.get_by_step_id_async(step_id="step-xxx", organization_id="org-xxx")
        traces = await reader.list_by_agent_async(agent_id="agent-xxx", organization_id="org-xxx")
    """

    def __init__(self):
        self._client = None

    def _get_client(self):
        """Initialize ClickHouse client on first use (lazy loading)."""
        if self._client is not None:
            return self._client

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

    def _row_to_trace(self, row: tuple) -> LLMTrace:
        """Convert a ClickHouse row tuple to LLMTrace."""
        return LLMTrace(
            id=row[0],
            organization_id=row[1],
            project_id=row[2] or None,
            agent_id=row[3] or None,
            agent_tags=list(row[4]) if row[4] else [],
            run_id=row[5] or None,
            step_id=row[6] or None,
            trace_id=row[7] or None,
            call_type=row[8],
            provider=row[9],
            model=row[10],
            is_byok=bool(row[11]),
            request_size_bytes=row[12],
            response_size_bytes=row[13],
            prompt_tokens=row[14],
            completion_tokens=row[15],
            total_tokens=row[16],
            cached_input_tokens=row[17],
            cache_write_tokens=row[18],
            reasoning_tokens=row[19],
            latency_ms=row[20],
            is_error=bool(row[21]),
            error_type=row[22] or None,
            error_message=row[23] or None,
            request_json=row[24],
            response_json=row[25],
            llm_config_json=row[26] or "",
            created_at=row[27],
        )

    def _query_sync(self, query: str, parameters: dict[str, Any]) -> List[tuple]:
        """Execute a query synchronously."""
        client = self._get_client()
        result = client.query(query, parameters=parameters)
        return result.result_rows if result else []

    # -------------------------------------------------------------------------
    # Query Methods
    # -------------------------------------------------------------------------

    async def get_by_step_id_async(
        self,
        step_id: str,
        organization_id: str,
    ) -> Optional[LLMTrace]:
        """
        Get the most recent trace for a step.

        Args:
            step_id: The step ID to look up
            organization_id: Organization ID for access control

        Returns:
            LLMTrace if found, None otherwise
        """
        query = """
        SELECT
            id, organization_id, project_id, agent_id, agent_tags, run_id, step_id, trace_id,
            call_type, provider, model, is_byok,
            request_size_bytes, response_size_bytes,
            prompt_tokens, completion_tokens, total_tokens,
            cached_input_tokens, cache_write_tokens, reasoning_tokens,
            latency_ms,
            is_error, error_type, error_message,
            request_json, response_json, llm_config_json,
            created_at
        FROM llm_traces
        WHERE step_id = %(step_id)s
          AND organization_id = %(organization_id)s
        ORDER BY created_at DESC
        LIMIT 1
        """

        rows = await asyncio.to_thread(
            self._query_sync,
            query,
            {"step_id": step_id, "organization_id": organization_id},
        )

        if not rows:
            return None

        return self._row_to_trace(rows[0])

    async def get_by_id_async(
        self,
        trace_id: str,
        organization_id: str,
    ) -> Optional[LLMTrace]:
        """
        Get a trace by its ID.

        Args:
            trace_id: The trace ID (UUID)
            organization_id: Organization ID for access control

        Returns:
            LLMTrace if found, None otherwise
        """
        query = """
        SELECT
            id, organization_id, project_id, agent_id, agent_tags, run_id, step_id, trace_id,
            call_type, provider, model, is_byok,
            request_size_bytes, response_size_bytes,
            prompt_tokens, completion_tokens, total_tokens,
            cached_input_tokens, cache_write_tokens, reasoning_tokens,
            latency_ms,
            is_error, error_type, error_message,
            request_json, response_json, llm_config_json,
            created_at
        FROM llm_traces
        WHERE id = %(trace_id)s
          AND organization_id = %(organization_id)s
        LIMIT 1
        """

        rows = await asyncio.to_thread(
            self._query_sync,
            query,
            {"trace_id": trace_id, "organization_id": organization_id},
        )

        if not rows:
            return None

        return self._row_to_trace(rows[0])

    async def list_by_agent_async(
        self,
        agent_id: str,
        organization_id: str,
        limit: int = 100,
        offset: int = 0,
        call_type: Optional[str] = None,
        is_error: Optional[bool] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> List[LLMTrace]:
        """
        List traces for an agent with optional filters.

        Args:
            agent_id: Agent ID to filter by
            organization_id: Organization ID for access control
            limit: Maximum number of results (default 100)
            offset: Offset for pagination
            call_type: Filter by call type ('agent_step', 'summarization')
            is_error: Filter by error status
            start_date: Filter by created_at >= start_date
            end_date: Filter by created_at <= end_date

        Returns:
            List of LLMTrace objects
        """
        conditions = [
            "agent_id = %(agent_id)s",
            "organization_id = %(organization_id)s",
        ]
        params: dict[str, Any] = {
            "agent_id": agent_id,
            "organization_id": organization_id,
            "limit": limit,
            "offset": offset,
        }

        if call_type:
            conditions.append("call_type = %(call_type)s")
            params["call_type"] = call_type

        if is_error is not None:
            conditions.append("is_error = %(is_error)s")
            params["is_error"] = 1 if is_error else 0

        if start_date:
            conditions.append("created_at >= %(start_date)s")
            params["start_date"] = start_date

        if end_date:
            conditions.append("created_at <= %(end_date)s")
            params["end_date"] = end_date

        where_clause = " AND ".join(conditions)

        query = f"""
        SELECT
            id, organization_id, project_id, agent_id, agent_tags, run_id, step_id, trace_id,
            call_type, provider, model, is_byok,
            request_size_bytes, response_size_bytes,
            prompt_tokens, completion_tokens, total_tokens,
            cached_input_tokens, cache_write_tokens, reasoning_tokens,
            latency_ms,
            is_error, error_type, error_message,
            request_json, response_json, llm_config_json,
            created_at
        FROM llm_traces
        WHERE {where_clause}
        ORDER BY created_at DESC
        LIMIT %(limit)s OFFSET %(offset)s
        """

        rows = await asyncio.to_thread(self._query_sync, query, params)
        return [self._row_to_trace(row) for row in rows]

    async def get_usage_stats_async(
        self,
        organization_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        group_by: str = "model",  # 'model', 'agent_id', 'call_type'
    ) -> List[dict[str, Any]]:
        """
        Get aggregated usage statistics.

        Args:
            organization_id: Organization ID for access control
            start_date: Filter by created_at >= start_date
            end_date: Filter by created_at <= end_date
            group_by: Field to group by ('model', 'agent_id', 'call_type')

        Returns:
            List of aggregated stats dicts
        """
        valid_group_by = {"model", "agent_id", "call_type", "provider"}
        if group_by not in valid_group_by:
            raise ValueError(f"group_by must be one of {valid_group_by}")

        conditions = ["organization_id = %(organization_id)s"]
        params: dict[str, Any] = {"organization_id": organization_id}

        if start_date:
            conditions.append("created_at >= %(start_date)s")
            params["start_date"] = start_date

        if end_date:
            conditions.append("created_at <= %(end_date)s")
            params["end_date"] = end_date

        where_clause = " AND ".join(conditions)

        query = f"""
        SELECT
            {group_by},
            count() as request_count,
            sum(total_tokens) as total_tokens,
            sum(prompt_tokens) as prompt_tokens,
            sum(completion_tokens) as completion_tokens,
            avg(latency_ms) as avg_latency_ms,
            sum(request_size_bytes) as total_request_bytes,
            sum(response_size_bytes) as total_response_bytes,
            countIf(is_error = 1) as error_count
        FROM llm_traces
        WHERE {where_clause}
        GROUP BY {group_by}
        ORDER BY total_tokens DESC
        """

        rows = await asyncio.to_thread(self._query_sync, query, params)

        return [
            {
                group_by: row[0],
                "request_count": row[1],
                "total_tokens": row[2],
                "prompt_tokens": row[3],
                "completion_tokens": row[4],
                "avg_latency_ms": row[5],
                "total_request_bytes": row[6],
                "total_response_bytes": row[7],
                "error_count": row[8],
            }
            for row in rows
        ]

    async def find_large_requests_async(
        self,
        organization_id: str,
        min_size_bytes: int = 1_000_000,  # 1MB default
        limit: int = 100,
    ) -> List[LLMTrace]:
        """
        Find traces with large request payloads (for debugging).

        Args:
            organization_id: Organization ID for access control
            min_size_bytes: Minimum request size in bytes (default 1MB)
            limit: Maximum number of results

        Returns:
            List of LLMTrace objects with large requests
        """
        query = """
        SELECT
            id, organization_id, project_id, agent_id, agent_tags, run_id, step_id, trace_id,
            call_type, provider, model, is_byok,
            request_size_bytes, response_size_bytes,
            prompt_tokens, completion_tokens, total_tokens,
            cached_input_tokens, cache_write_tokens, reasoning_tokens,
            latency_ms,
            is_error, error_type, error_message,
            request_json, response_json, llm_config_json,
            created_at
        FROM llm_traces
        WHERE organization_id = %(organization_id)s
          AND request_size_bytes >= %(min_size_bytes)s
        ORDER BY request_size_bytes DESC
        LIMIT %(limit)s
        """

        rows = await asyncio.to_thread(
            self._query_sync,
            query,
            {
                "organization_id": organization_id,
                "min_size_bytes": min_size_bytes,
                "limit": limit,
            },
        )

        return [self._row_to_trace(row) for row in rows]


# Module-level instance for easy access
_reader_instance: Optional[LLMTraceReader] = None


def get_llm_trace_reader() -> LLMTraceReader:
    """Get the singleton LLMTraceReader instance."""
    global _reader_instance
    if _reader_instance is None:
        _reader_instance = LLMTraceReader()
    return _reader_instance
