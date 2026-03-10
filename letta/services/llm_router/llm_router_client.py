"""Redis-backed LLM routing client for model health tracking and auto mode resolution.

Tracks overload errors per model handle using Redis sorted sets for
sliding window error counting. Works across multiple pods.

The noop base class lives in client_base.py.
"""

import time
from enum import Enum
from typing import TYPE_CHECKING, Optional

from letta.data_sources.redis_client import AsyncRedisClient
from letta.log import get_logger

from .llm_router_client_base import LLMRoutingClient as LLMRoutingClientBase

if TYPE_CHECKING:
    from letta.schemas.llm_config import LLMConfig
    from letta.schemas.user import User

logger = get_logger(__name__)

# Auto mode model routing
AUTO_MODE_PRIMARY = "baseten/glm-5"
AUTO_MODE_FALLBACK = "zai/glm-5"

# Fallback routes: primary handle -> fallback handle
# When a model returns 429/5xx and the circuit breaker trips, route to the fallback.
# Bedrock handles are dynamic (depend on AWS inference profiles), so anthropic->bedrock
# routes should be added once we have a stable handle resolution mechanism.
FALLBACK_ROUTES: dict[str, str] = {
    AUTO_MODE_PRIMARY: AUTO_MODE_FALLBACK,
}

# Circuit breaker configuration
ERROR_WINDOW_SECONDS = 60  # Sliding window for error counting
ERROR_THRESHOLD = 1  # Errors needed to trip circuit
OPEN_DURATION_SECONDS = 30  # How long circuit stays open

# Redis key prefixes
CIRCUIT_ERRORS_KEY = "circuit:errors:"
CIRCUIT_STATE_KEY = "circuit:state:"
CIRCUIT_OPENED_AT_KEY = "circuit:opened:"


def _build_baseten_config() -> "LLMConfig":
    """Build a hardcoded LLMConfig for Baseten GLM-5 (not discoverable via provider sync)."""
    from letta.schemas.enums import ProviderCategory
    from letta.schemas.llm_config import LLMConfig

    return LLMConfig(
        model="zai-org/GLM-5",
        model_endpoint_type="baseten",
        model_endpoint="3m5zok9w",
        context_window=180000,
        max_tokens=16384,
        handle="baseten/glm-5",
        provider_name="baseten",
        provider_category=ProviderCategory.base,
        strict=True,
        parallel_tool_calls=True,
    )


def _build_fireworks_config() -> "LLMConfig":
    """Build a hardcoded LLMConfig for Fireworks GLM-5 (not discoverable via provider sync)."""
    from letta.schemas.enums import ProviderCategory
    from letta.schemas.llm_config import LLMConfig
    from letta.settings import model_settings

    return LLMConfig(
        model="accounts/fireworks/models/glm-5",
        model_endpoint_type="fireworks",
        model_endpoint=model_settings.fireworks_api_base,
        context_window=180000,
        max_tokens=16384,
        handle="fireworks/glm-5",
        provider_name="fireworks",
        provider_category=ProviderCategory.base,
    )


class CircuitState(str, Enum):
    CLOSED = "CLOSED"
    OPEN = "OPEN"


class LLMRoutingClient(LLMRoutingClientBase):
    """Redis-backed LLM routing client for model health tracking and auto mode routing.

    Uses an internal circuit breaker (Redis sorted sets) for sliding window error
    counting across pods. The circuit breaker is an implementation detail.
    """

    def __init__(self, redis_client: AsyncRedisClient):
        self.redis = redis_client

    async def resolve_auto_mode_config(
        self,
        stored_llm_config: "LLMConfig",
        actor: "User",
    ) -> tuple["LLMConfig", bool, str]:
        """Resolve an auto mode handle to an actual model config.

        Uses the internal circuit breaker to decide between primary and fallback.
        Preserves user-configured context_window and max_tokens from the stored config.

        Args:
            stored_llm_config: The agent's stored LLM config (with auto mode handle).
            actor: The user actor for provider lookups.

        Returns:
            Tuple of (resolved_config, is_primary, primary_handle).
        """
        from letta.services.provider_manager import ProviderManager
        from letta.settings import model_settings

        provider_manager = ProviderManager()
        primary_handle = AUTO_MODE_PRIMARY

        if not model_settings.auto_mode_enabled:
            logger.info(f"[LLM ROUTER]: primary {primary_handle} disabled via kill switch, using {AUTO_MODE_FALLBACK}")
        elif await self._is_healthy(primary_handle):
            config = _build_baseten_config()
            config = config.model_copy(
                update={
                    "context_window": min(stored_llm_config.context_window, config.context_window),
                    "max_tokens": min(stored_llm_config.max_tokens, config.max_tokens),
                }
            )
            return config, True, primary_handle
        else:
            logger.warning(f"[LLM ROUTER]: primary {primary_handle} unhealthy, using {AUTO_MODE_FALLBACK}")

        config = await provider_manager.get_llm_config_from_handle(AUTO_MODE_FALLBACK, actor)
        config = config.model_copy(
            update={
                "context_window": min(stored_llm_config.context_window, config.context_window),
                "max_tokens": min(stored_llm_config.max_tokens, config.max_tokens),
            }
        )
        return config, False, primary_handle

    async def record_failure(self, handle: str) -> None:
        """Record a failure for a model handle. May trip the circuit.

        Args:
            handle: The model handle that failed.
        """
        client = await self.redis.get_client()
        now = time.time()
        errors_key = f"{CIRCUIT_ERRORS_KEY}{handle}"

        await client.zadd(errors_key, {str(now): now})
        await client.zremrangebyscore(errors_key, 0, now - ERROR_WINDOW_SECONDS)
        await client.expire(errors_key, ERROR_WINDOW_SECONDS * 2)

        error_count = await client.zcard(errors_key)
        if error_count >= ERROR_THRESHOLD:
            await self._open_circuit(client, handle)

    async def record_success(self, handle: str) -> None:
        """Record a success for a model handle. Closes circuit if open.

        Args:
            handle: The model handle that succeeded.
        """
        state = await self._get_state(handle)
        if state == CircuitState.OPEN:
            await self._close_circuit(handle)

    async def get_fallback_config(
        self,
        stored_llm_config: "LLMConfig",
        actor: "User",
    ) -> "LLMConfig":
        """Get the fallback config for auto mode.

        Args:
            stored_llm_config: The agent's stored LLM config (with auto mode handle).
            actor: The user actor for provider lookups.

        Returns:
            The fallback LLM config with preserved context_window and max_tokens.
        """
        return await self.get_fallback_config_for_handle(AUTO_MODE_FALLBACK, stored_llm_config, actor)

    async def get_fallback_config_for_handle(
        self,
        fallback_handle: str,
        stored_llm_config: "LLMConfig",
        actor: "User",
    ) -> "LLMConfig":
        """Get a fallback config for any handle.

        Args:
            fallback_handle: The fallback model handle to resolve.
            stored_llm_config: The agent's stored LLM config.
            actor: The user actor for provider lookups.

        Returns:
            The fallback LLM config with preserved context_window and max_tokens.
        """
        from letta.services.provider_manager import ProviderManager

        provider_manager = ProviderManager()
        fallback_config = await provider_manager.get_llm_config_from_handle(fallback_handle, actor)
        fallback_config = fallback_config.model_copy(
            update={
                "context_window": min(stored_llm_config.context_window, fallback_config.context_window),
                "max_tokens": min(stored_llm_config.max_tokens, fallback_config.max_tokens),
            }
        )
        return fallback_config

    def get_fallback_handle(self, handle: str) -> Optional[str]:
        """Get the fallback handle for a given primary handle, if one is configured.

        Args:
            handle: The primary model handle.

        Returns:
            The fallback handle, or None if no fallback is configured.
        """
        return FALLBACK_ROUTES.get(handle)

    async def _is_healthy(self, handle: str) -> bool:
        """Check if a model handle is healthy (internal circuit breaker).

        Returns True if the circuit is closed, or if the open duration has elapsed
        (allowing a retry probe).

        Args:
            handle: The model handle to check.

        Returns:
            True if the model should be tried, False if it should be skipped.
        """
        state = await self._get_state(handle)
        if state == CircuitState.CLOSED:
            return True

        opened_at = await self._get_opened_at(handle)
        if opened_at and time.time() - opened_at >= OPEN_DURATION_SECONDS:
            return True

        return False

    async def _get_state(self, handle: str) -> CircuitState:
        client = await self.redis.get_client()
        state = await client.get(f"{CIRCUIT_STATE_KEY}{handle}")
        return CircuitState.OPEN if state == CircuitState.OPEN.value else CircuitState.CLOSED

    async def _get_opened_at(self, handle: str) -> Optional[float]:
        client = await self.redis.get_client()
        val = await client.get(f"{CIRCUIT_OPENED_AT_KEY}{handle}")
        return float(val) if val else None

    async def _open_circuit(self, client, handle: str) -> None:
        now = time.time()
        await client.set(f"{CIRCUIT_STATE_KEY}{handle}", CircuitState.OPEN.value, ex=OPEN_DURATION_SECONDS * 2)
        await client.set(f"{CIRCUIT_OPENED_AT_KEY}{handle}", str(now), ex=OPEN_DURATION_SECONDS * 2)
        logger.warning(f"Circuit OPENED for model {handle}")

    async def _close_circuit(self, handle: str) -> None:
        client = await self.redis.get_client()
        await client.delete(f"{CIRCUIT_STATE_KEY}{handle}", f"{CIRCUIT_OPENED_AT_KEY}{handle}", f"{CIRCUIT_ERRORS_KEY}{handle}")
        logger.info(f"Circuit CLOSED for model {handle}")


async def get_llm_routing_client() -> LLMRoutingClientBase:
    """Factory that returns the appropriate LLM routing client instance.

    Returns the Redis-backed implementation if Redis is available,
    otherwise returns the noop base.

    Returns:
        An LLMRoutingClient instance.
    """
    from letta.data_sources.redis_client import NoopAsyncRedisClient, get_redis_client

    redis_client = await get_redis_client()
    if isinstance(redis_client, NoopAsyncRedisClient):
        return LLMRoutingClientBase()
    return LLMRoutingClient(redis_client)
