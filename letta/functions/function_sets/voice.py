## Voice chat + sleeptime tools
from typing import List, Optional

from pydantic import BaseModel, Field


def rethink_user_memory(agent_state: "AgentState", new_memory: str) -> None:
    """
    Rewrite memory block for the main agent, new_memory should contain all current information from the block that is not outdated or inconsistent, integrating any new information, resulting in a new memory block that is organized, readable, and comprehensive.

    Args:
        new_memory (str): The new memory with information integrated from the memory block. If there is no new information, then this should be the same as the content in the source block.

    Returns:
        None: None is always returned as this function does not produce a response.
    """
    # This is implemented directly in the agent loop
    return None


def finish_rethinking_memory(agent_state: "AgentState") -> None:  # type: ignore
    """
    This function is called when the agent is done rethinking the memory.

    Returns:
        Optional[str]: None is always returned as this function does not produce a response.
    """
    return None


class MemoryChunk(BaseModel):
    start_index: int = Field(
        ...,
        description="Zero-based index of the first evicted line in this chunk.",
    )
    end_index: int = Field(
        ...,
        description="Zero-based index of the last evicted line (inclusive).",
    )
    context: str = Field(
        ...,
        description="1-3 sentence paraphrase capturing key facts/details, user preferences, or goals that this chunk reveals—written for future retrieval.",
    )


def store_memories(agent_state: "AgentState", chunks: List[MemoryChunk]) -> None:
    """
    Persist dialogue that is about to fall out of the agent’s context window.

    Args:
        chunks (List[MemoryChunk]):
            Each chunk pinpoints a contiguous block of **evicted** lines and provides a short, forward-looking synopsis (`context`) that will be embedded for future semantic lookup.

    Returns:
        None
    """
    # This is implemented directly in the agent loop
    return None


def search_memory(
    agent_state: "AgentState",
    convo_keyword_queries: Optional[List[str]],
    start_minutes_ago: Optional[int],
    end_minutes_ago: Optional[int],
) -> Optional[str]:
    """
    Look in long-term or earlier-conversation memory only when the user asks about something missing from the visible context. The user’s latest utterance is sent automatically as the main query.

    Args:
        convo_keyword_queries (Optional[List[str]]): Extra keywords (e.g., order ID, place name). Use *null* if not appropriate for the latest user message.
        start_minutes_ago (Optional[int]): Newer bound of the time window for results, specified in minutes ago. Use *null* if no lower time bound is needed.
        end_minutes_ago (Optional[int]): Older bound of the time window, in minutes ago. Use *null* if no upper bound is needed.

    Returns:
        Optional[str]: A formatted string of matching memory entries, or None if no
            relevant memories are found.
    """
    # This is implemented directly in the agent loop
    return None
