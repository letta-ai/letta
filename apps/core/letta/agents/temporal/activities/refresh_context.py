from typing import List

from temporalio import activity

from letta.agents.temporal.types import RefreshContextParams
from letta.schemas.message import Message


@activity.defn(name="refresh_context_and_system_message")
async def refresh_context_and_system_message(params: RefreshContextParams) -> List[Message]:
    """Refresh context/system message and scrub inner thoughts.

    TODO: Implement using the same logic as LettaAgentV2._refresh_messages and _rebuild_memory:
      - Use AgentManager.refresh_memory_async to get latest memory/sources
      - Load archive + tags via ArchiveManager/PassageManager
      - Compare dynamic section of system prompt; update system message via MessageManager if changed
      - Scrub inner thoughts via scrub_inner_thoughts_from_messages using llm_config
      - Return the updated in_context_messages

    Notes:
      - This activity performs DB reads/writes and should remain an activity to keep the workflow deterministic.
      - Keep external manager instances within this activity to avoid non-deterministic state in workflow.
    """
    # Stub: return messages unchanged for now.
    return params.in_context_messages
