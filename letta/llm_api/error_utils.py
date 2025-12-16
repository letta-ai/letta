"""Shared helpers for provider error detection/mapping.

Keep these utilities free of heavy imports to avoid circular dependencies between
LLM clients (provider-specific) and streaming interfaces.
"""


def is_context_window_overflow_message(msg: str) -> bool:
    """Best-effort detection for context window overflow errors.

    Different providers (and even different API surfaces within the same provider)
    may phrase context-window errors differently. We centralize the heuristic so
    all layers (clients, streaming interfaces, agent loops) behave consistently.
    """

    return (
        "exceeds the context window" in msg
        or "This model's maximum context length is" in msg
        or "maximum context length" in msg
        or "context_length_exceeded" in msg
        or "Input tokens exceed the configured limit" in msg
    )
