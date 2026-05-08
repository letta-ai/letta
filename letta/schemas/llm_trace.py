"""Schema for LLM request/response traces stored in ClickHouse for analytics."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import Field

from letta.helpers.datetime_helpers import get_utc_time
from letta.schemas.letta_base import LettaBase


class LLMTrace(LettaBase):
    """
    LLM request/response trace for ClickHouse analytics.

    Stores LLM request/response payloads with denormalized columns for
    fast cost analytics queries (token usage by org/agent/model).

    Attributes:
        id (str): Unique trace identifier (UUID).
        organization_id (str): The organization this trace belongs to.
        project_id (str): The project this trace belongs to.
        agent_id (str): ID of the agent that made the request.
        run_id (str): ID of the run this trace is associated with.
        step_id (str): ID of the step that generated this trace.
        trace_id (str): OTEL trace ID for correlation.

        call_type (str): Type of LLM call ('agent_step', 'summarization', 'embedding').
        provider (str): LLM provider name ('openai', 'anthropic', etc.).
        model (str): Model name/identifier used.

        request_size_bytes (int): Size of request_json in bytes.
        response_size_bytes (int): Size of response_json in bytes.
        prompt_tokens (int): Number of prompt tokens used.
        completion_tokens (int): Number of completion tokens generated.
        total_tokens (int): Total tokens (prompt + completion).
        latency_ms (int): Request latency in milliseconds.

        is_error (bool): Whether the request resulted in an error.
        error_type (str): Exception class name if error occurred.
        error_message (str): Error message if error occurred.

        request_json (str): Full request payload as JSON string.
        response_json (str): Full response payload as JSON string.

        created_at (datetime): Timestamp when the trace was created.
    """

    __id_prefix__ = "llm_trace"

    # Primary identifier (UUID portion of ProviderTrace.id, prefix stripped for ClickHouse)
    id: str = Field(..., description="Trace UUID (strip 'provider_trace-' prefix to correlate)")

    # Context identifiers
    organization_id: str = Field(..., description="Organization this trace belongs to")
    project_id: Optional[str] = Field(default=None, description="Project this trace belongs to")
    agent_id: Optional[str] = Field(default=None, description="Agent that made the request")
    agent_tags: list[str] = Field(default_factory=list, description="Tags associated with the agent")
    run_id: Optional[str] = Field(default=None, description="Run this trace is associated with")
    step_id: Optional[str] = Field(default=None, description="Step that generated this trace")
    trace_id: Optional[str] = Field(default=None, description="OTEL trace ID for correlation")

    # Request metadata (queryable)
    call_type: str = Field(..., description="Type of LLM call: 'agent_step', 'summarization', 'embedding'")
    provider: str = Field(..., description="LLM provider: 'openai', 'anthropic', 'google_ai', etc.")
    model: str = Field(..., description="Model name/identifier")
    is_byok: bool = Field(default=False, description="Whether this request used BYOK (Bring Your Own Key)")

    # Size metrics
    request_size_bytes: int = Field(default=0, description="Size of request_json in bytes")
    response_size_bytes: int = Field(default=0, description="Size of response_json in bytes")

    # Token usage
    prompt_tokens: int = Field(default=0, description="Number of prompt tokens")
    completion_tokens: int = Field(default=0, description="Number of completion tokens")
    total_tokens: int = Field(default=0, description="Total tokens (prompt + completion)")

    # Cache and reasoning tokens (from LettaUsageStatistics)
    cached_input_tokens: Optional[int] = Field(default=None, description="Number of input tokens served from cache")
    cache_write_tokens: Optional[int] = Field(default=None, description="Number of tokens written to cache (Anthropic)")
    reasoning_tokens: Optional[int] = Field(default=None, description="Number of reasoning/thinking tokens generated")

    # Latency
    latency_ms: int = Field(default=0, description="Request latency in milliseconds")

    # Error tracking
    is_error: bool = Field(default=False, description="Whether the request resulted in an error")
    error_type: Optional[str] = Field(default=None, description="Exception class name if error")
    error_message: Optional[str] = Field(default=None, description="Error message if error")

    # Raw payloads (JSON strings)
    request_json: str = Field(..., description="Full request payload as JSON string")
    response_json: str = Field(..., description="Full response payload as JSON string")
    llm_config_json: str = Field(default="", description="LLM config as JSON string")

    # Billing context
    billing_plan_type: Optional[str] = Field(default=None, description="Subscription tier (e.g., 'basic', 'standard', 'max', 'enterprise')")
    billing_cost_source: Optional[str] = Field(default=None, description="Cost source: 'quota' or 'credits'")
    billing_customer_id: Optional[str] = Field(default=None, description="Customer ID for cross-referencing billing records")

    # Timestamp
    created_at: datetime = Field(default_factory=get_utc_time, description="When the trace was created")

    def to_clickhouse_row(self) -> tuple:
        """Convert to a tuple for ClickHouse insertion."""
        return (
            self.id,
            self.organization_id,
            self.project_id or "",
            self.agent_id or "",
            self.agent_tags,
            self.run_id or "",
            self.step_id or "",
            self.trace_id or "",
            self.call_type,
            self.provider,
            self.model,
            1 if self.is_byok else 0,
            self.request_size_bytes,
            self.response_size_bytes,
            self.prompt_tokens,
            self.completion_tokens,
            self.total_tokens,
            self.cached_input_tokens,
            self.cache_write_tokens,
            self.reasoning_tokens,
            self.latency_ms,
            1 if self.is_error else 0,
            self.error_type or "",
            self.error_message or "",
            self.request_json,
            self.response_json,
            self.llm_config_json,
            self.billing_plan_type or "",
            self.billing_cost_source or "",
            self.billing_customer_id or "",
            self.created_at,
        )

    @classmethod
    def clickhouse_columns(cls) -> list[str]:
        """Return column names for ClickHouse insertion."""
        return [
            "id",
            "organization_id",
            "project_id",
            "agent_id",
            "agent_tags",
            "run_id",
            "step_id",
            "trace_id",
            "call_type",
            "provider",
            "model",
            "is_byok",
            "request_size_bytes",
            "response_size_bytes",
            "prompt_tokens",
            "completion_tokens",
            "total_tokens",
            "cached_input_tokens",
            "cache_write_tokens",
            "reasoning_tokens",
            "latency_ms",
            "is_error",
            "error_type",
            "error_message",
            "request_json",
            "response_json",
            "llm_config_json",
            "billing_plan_type",
            "billing_cost_source",
            "billing_customer_id",
            "created_at",
        ]
