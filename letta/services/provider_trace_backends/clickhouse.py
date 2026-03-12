"""ClickHouse provider trace backend.

Writes and reads from the llm_traces table with denormalized columns for cost analytics.
"""

import json
import uuid
from typing import TYPE_CHECKING, Optional

from letta.log import get_logger
from letta.schemas.provider_trace import ProviderTrace
from letta.schemas.user import User
from letta.services.clickhouse_provider_traces import ClickhouseProviderTraceReader
from letta.services.provider_trace_backends.base import ProviderTraceBackendClient
from letta.settings import settings

if TYPE_CHECKING:
    from letta.schemas.llm_trace import LLMTrace

logger = get_logger(__name__)


class ClickhouseProviderTraceBackend(ProviderTraceBackendClient):
    """ClickHouse backend for provider traces (reads and writes from llm_traces table)."""

    def __init__(self):
        self._reader = ClickhouseProviderTraceReader()

    async def create_async(
        self,
        actor: User,
        provider_trace: ProviderTrace,
    ) -> ProviderTrace | None:
        """Write provider trace to ClickHouse llm_traces table."""
        if not settings.store_llm_traces:
            # Return minimal trace for consistency if writes disabled
            return ProviderTrace(
                id=provider_trace.id,
                step_id=provider_trace.step_id,
                request_json=provider_trace.request_json or {},
                response_json=provider_trace.response_json or {},
            )

        try:
            from letta.services.llm_trace_writer import get_llm_trace_writer

            trace = self._convert_to_trace(actor, provider_trace)
            if trace:
                writer = get_llm_trace_writer()
                await writer.write_async(trace)

        except Exception as e:
            logger.debug(f"Failed to write trace to ClickHouse: {e}")

        return ProviderTrace(
            id=provider_trace.id,
            step_id=provider_trace.step_id,
            request_json=provider_trace.request_json or {},
            response_json=provider_trace.response_json or {},
        )

    async def get_by_step_id_async(
        self,
        step_id: str,
        actor: User,
    ) -> ProviderTrace | None:
        """Read provider trace from llm_traces table by step_id."""
        return await self._reader.get_provider_trace_by_step_id_async(
            step_id=step_id,
            organization_id=actor.organization_id,
        )

    def _convert_to_trace(
        self,
        actor: User,
        provider_trace: ProviderTrace,
    ) -> Optional["LLMTrace"]:
        """Convert ProviderTrace to LLMTrace for analytics storage."""
        from letta.schemas.llm_trace import LLMTrace

        # Serialize JSON fields
        request_json_str = json.dumps(provider_trace.request_json, default=str)
        response_json_str = json.dumps(provider_trace.response_json, default=str)
        llm_config_json_str = json.dumps(provider_trace.llm_config, default=str) if provider_trace.llm_config else "{}"

        # Extract provider and model from llm_config
        llm_config = provider_trace.llm_config or {}
        provider = llm_config.get("model_endpoint_type", "unknown")
        model = llm_config.get("model", "unknown")
        is_byok = llm_config.get("provider_category") == "byok"

        # Extract usage from response (generic parsing for common formats)
        usage = self._extract_usage(provider_trace.response_json, provider)

        # Check for error in response - must have actual error content, not just null
        # OpenAI Responses API returns {"error": null} on success
        error_data = provider_trace.response_json.get("error")
        error_type = provider_trace.response_json.get("error_type")
        error_message = None
        is_error = bool(error_data) or bool(error_type)
        if is_error:
            if isinstance(error_data, dict):
                error_type = error_type or error_data.get("type")
                error_message = error_data.get("message", str(error_data))[:1000]
            elif error_data:
                error_message = str(error_data)[:1000]

        # Extract UUID from provider_trace.id (strip "provider_trace-" prefix)
        trace_id = provider_trace.id
        if not trace_id:
            logger.warning("ProviderTrace missing id - trace correlation across backends will fail")
            trace_id = str(uuid.uuid4())
        elif trace_id.startswith("provider_trace-"):
            trace_id = trace_id[len("provider_trace-") :]

        return LLMTrace(
            id=trace_id,
            organization_id=provider_trace.org_id or actor.organization_id,
            project_id=None,
            agent_id=provider_trace.agent_id,
            agent_tags=provider_trace.agent_tags or [],
            run_id=provider_trace.run_id,
            step_id=provider_trace.step_id,
            trace_id=None,
            call_type=provider_trace.call_type or "unknown",
            provider=provider,
            model=model,
            is_byok=is_byok,
            request_size_bytes=len(request_json_str.encode("utf-8")),
            response_size_bytes=len(response_json_str.encode("utf-8")),
            prompt_tokens=usage.get("prompt_tokens", 0),
            completion_tokens=usage.get("completion_tokens", 0),
            total_tokens=usage.get("total_tokens", 0),
            cached_input_tokens=usage.get("cached_input_tokens"),
            cache_write_tokens=usage.get("cache_write_tokens"),
            reasoning_tokens=usage.get("reasoning_tokens"),
            latency_ms=0,  # Not available in ProviderTrace
            is_error=is_error,
            error_type=error_type,
            error_message=error_message,
            request_json=request_json_str,
            response_json=response_json_str,
            llm_config_json=llm_config_json_str,
            billing_plan_type=provider_trace.billing_context.plan_type if provider_trace.billing_context else None,
            billing_cost_source=provider_trace.billing_context.cost_source if provider_trace.billing_context else None,
            billing_customer_id=provider_trace.billing_context.customer_id if provider_trace.billing_context else None,
        )

    def _extract_usage(self, response_json: dict, provider: str) -> dict:
        """Extract usage statistics from response JSON.

        Handles common formats from OpenAI, Anthropic, and other providers.
        """
        usage = {}

        # OpenAI format: response.usage
        if "usage" in response_json:
            u = response_json["usage"]
            usage["prompt_tokens"] = u.get("prompt_tokens", 0)
            usage["completion_tokens"] = u.get("completion_tokens", 0)
            usage["total_tokens"] = u.get("total_tokens", 0)

            # OpenAI reasoning tokens
            if "completion_tokens_details" in u:
                details = u["completion_tokens_details"]
                usage["reasoning_tokens"] = details.get("reasoning_tokens")

            # OpenAI cached tokens
            if "prompt_tokens_details" in u:
                details = u["prompt_tokens_details"]
                usage["cached_input_tokens"] = details.get("cached_tokens")

        # Anthropic format: response.usage with cache fields
        if provider == "anthropic" and "usage" in response_json:
            u = response_json["usage"]
            # input_tokens can be 0 when all tokens come from cache
            input_tokens = u.get("input_tokens", 0)
            cache_read = u.get("cache_read_input_tokens", 0)
            cache_write = u.get("cache_creation_input_tokens", 0)
            # Total prompt = input + cached (for cost analytics)
            usage["prompt_tokens"] = input_tokens + cache_read + cache_write
            usage["completion_tokens"] = u.get("output_tokens", usage.get("completion_tokens", 0))
            usage["cached_input_tokens"] = cache_read if cache_read else None
            usage["cache_write_tokens"] = cache_write if cache_write else None

            # Recalculate total if not present
            if "total_tokens" not in usage or usage["total_tokens"] == 0:
                usage["total_tokens"] = usage.get("prompt_tokens", 0) + usage.get("completion_tokens", 0)

        return usage
