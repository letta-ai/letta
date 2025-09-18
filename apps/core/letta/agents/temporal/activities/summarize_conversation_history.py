from typing import List

from temporalio import activity

from letta.agents.temporal.types import SummarizeParams
from letta.schemas.agent import AgentType
from letta.schemas.message import Message
from letta.services.agent_manager import AgentManager
from letta.services.message_manager import MessageManager
from letta.services.summarizer.enums import SummarizationMode
from letta.services.summarizer.summarizer import Summarizer
from letta.settings import summarizer_settings


@activity.defn(name="summarize_conversation_history")
async def summarize_conversation_history(params: SummarizeParams) -> List[Message]:
    """Summarize/evict history to fit context window and update agent message ids.

    This activity mirrors LettaAgentV2.summarize_conversation_history:
      - If force or tokens exceed window, call Summarizer.summarize(..., force=True, clear=True)
      - Else call Summarizer.summarize(...) without force to perform partial evictions as needed
      - Update AgentManager.update_message_ids_async with new in-context message IDs
      - Return the updated in_context_messages

    Notes:
      - This activity performs DB updates and should remain an activity for determinism.
      - Summarizer instance is created/configured inside the activity using agent_state and managers.
    """
    # instantiate managers
    agent_manager = AgentManager()
    message_manager = MessageManager()

    # determine summarization mode based on agent type
    mode = (
        SummarizationMode.STATIC_MESSAGE_BUFFER
        if params.agent_state.agent_type == AgentType.voice_convo_agent
        else summarizer_settings.mode
    )

    # create summarizer instance with configuration from settings
    summarizer = Summarizer(
        mode=mode,
        summarizer_agent=None,  # temporal doesn't use summarization agents yet
        message_buffer_limit=summarizer_settings.message_buffer_limit,
        message_buffer_min=summarizer_settings.message_buffer_min,
        partial_evict_summarizer_percentage=summarizer_settings.partial_evict_summarizer_percentage,
        agent_manager=agent_manager,
        message_manager=message_manager,
        actor=params.actor,
        agent_id=params.agent_state.id,
    )

    # perform summarization
    if params.force:
        # force summarization with clear flag when context window exceeded
        new_in_context_messages, updated = await summarizer.summarize(
            in_context_messages=params.in_context_messages,
            new_letta_messages=params.new_letta_messages,
            force=True,
            clear=True,
        )
    else:
        # regular summarization without force
        new_in_context_messages, updated = await summarizer.summarize(
            in_context_messages=params.in_context_messages,
            new_letta_messages=params.new_letta_messages,
        )

    # update agent message ids in database
    message_ids = [m.id for m in new_in_context_messages]
    await agent_manager.update_message_ids_async(
        agent_id=params.agent_state.id,
        message_ids=message_ids,
        actor=params.actor,
    )

    return new_in_context_messages
