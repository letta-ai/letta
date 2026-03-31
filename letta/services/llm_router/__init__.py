"""LLM routing client with circuit breaker and fallback support.

Conditionally imports Redis-backed implementation or falls back to noop base.
"""

try:
    from .llm_router_client import LLMRoutingClient, get_llm_routing_client
except ImportError:
    from .llm_router_client_base import LLMRoutingClient

    async def get_llm_routing_client():
        return LLMRoutingClient()


__all__ = [
    "LLMRoutingClient",
    "get_llm_routing_client",
]
