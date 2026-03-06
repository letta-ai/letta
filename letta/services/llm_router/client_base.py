"""Base LLM routing client.

This is the base (OSS/self-hosted) implementation without Redis support.
The Redis-backed implementation lives in client.py.
"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from letta.schemas.llm_config import LLMConfig
    from letta.schemas.user import User


class LLMRoutingClient:
    """Base LLM routing client.

    Used when Redis is not configured (OSS/self-hosted).
    Auto mode is not supported without Redis.
    """

    async def resolve_auto_mode_config(
        self,
        stored_llm_config: "LLMConfig",
        actor: "User",
    ) -> tuple["LLMConfig", bool, str]:
        """Resolve an auto mode handle to an actual model config.

        Args:
            stored_llm_config: The agent's stored LLM config (with auto mode handle).
            actor: The user actor for provider lookups.

        Returns:
            Tuple of (resolved_config, is_primary, primary_handle).

        Raises:
            RuntimeError: Auto mode requires Redis for circuit breaker support.
        """
        raise RuntimeError(
            "Auto mode requires Redis for circuit breaker support. Configure Redis or disable auto_mode_enabled in settings."
        )

    async def record_failure(self, handle: str) -> None:
        """Record a failure for a model handle (noop in base)."""

    async def record_success(self, handle: str) -> None:
        """Record a success for a model handle (noop in base)."""

    async def get_fallback_config(
        self,
        stored_llm_config: "LLMConfig",
        actor: "User",
    ) -> "LLMConfig":
        """Get the fallback config for auto mode.

        Args:
            stored_llm_config: The agent's stored LLM config.
            actor: The user actor for provider lookups.

        Returns:
            The fallback LLM config.

        Raises:
            RuntimeError: Auto mode requires Redis for circuit breaker support.
        """
        raise RuntimeError(
            "Auto mode requires Redis for circuit breaker support. Configure Redis or disable auto_mode_enabled in settings."
        )
