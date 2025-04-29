## Voice chat + sleeptime tools
from typing import List, Optional

from pydantic import BaseModel, Field


def rethink_user_memory(agent_state: "AgentState", new_memory: str) -> None:
    """
    Rewrite memory block for the main agent, new_memory should contain all current
    information from the block that is not outdated or inconsistent, integrating any
    new information, resulting in a new memory block that is organized, readable, and
    comprehensive.

    Args:
        new_memory (str): The new memory with information integrated from the memory block.
                          If there is no new information, then this should be the same as
                          the content in the source block.

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
    start_index: int = Field(..., description="Index of the first line in the original conversation history.")
    end_index: int = Field(..., description="Index of the last line in the original conversation history.")
    context: str = Field(..., description="A concise, high-level note explaining why this chunk matters.")


def store_memories(agent_state: "AgentState", chunks: List[MemoryChunk]) -> None:
    """
    Archive coherent chunks of dialogue that will be evicted, preserving raw lines
    and a brief contextual description.

    Args:
        agent_state (AgentState):
            The agent’s current memory state, exposing both its in-session history
            and the archival memory API.
        chunks (List[MemoryChunk]):
            A list of MemoryChunk models, each representing a segment to archive:
              • start_index (int): Index of the first line in the original history.
              • end_index   (int): Index of the last line in the original history.
              • context     (str): A concise, high-level description of why this chunk
                                 matters and what it contains.

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
    Look in long-term or earlier-conversation memory only when the user asks about
    something missing from the visible context. The user’s latest utterance is sent
    automatically as the main query.

    Args:
        agent_state (AgentState): The current state of the agent, including its
            memory stores and context.
        convo_keyword_queries (Optional[List[str]]): Extra keywords or identifiers
            (e.g., order ID, place name) to refine the search when the request is vague.
            Set to None if the user’s utterance is already specific.
        start_minutes_ago (Optional[int]): Newer bound of the time window for results,
            specified in minutes ago. Set to None if no lower time bound is needed.
        end_minutes_ago (Optional[int]): Older bound of the time window for results,
            specified in minutes ago. Set to None if no upper time bound is needed.

    Returns:
        Optional[str]: A formatted string of matching memory entries, or None if no
            relevant memories are found.
    """
    # This is implemented directly in the agent loop
    return None
