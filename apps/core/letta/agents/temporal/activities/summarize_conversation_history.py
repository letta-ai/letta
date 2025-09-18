from typing import List

from temporalio import activity

from letta.agents.temporal.types import SummarizeParams
from letta.schemas.message import Message


@activity.defn(name="summarize_conversation_history")
async def summarize_conversation_history(params: SummarizeParams) -> List[Message]:
    """Summarize/evict history to fit context window and update agent message ids.

    TODO: Implement mirroring LettaAgentV2.summarize_conversation_history:
      - If force or tokens exceed window, call Summarizer.summarize(..., force=True, clear=True)
      - Else call Summarizer.summarize(...) without force to perform partial evictions as needed
      - Update AgentManager.update_message_ids_async with new in-context message IDs
      - Return the updated in_context_messages

    Notes:
      - This activity performs DB updates and should remain an activity for determinism.
      - Summarizer instance should be created/configured inside the activity using agent_state and managers.
    """
    # Stub: no-op summarization; return input messages unchanged.
    return params.in_context_messages
