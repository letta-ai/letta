from typing import List, Tuple

from letta.helpers.message_helper import convert_message_creates_to_messages
from letta.log import get_logger
from letta.schemas.agent import AgentState
from letta.schemas.enums import MessageRole
from letta.schemas.letta_message_content import TextContent
from letta.schemas.message import Message, MessageCreate
from letta.schemas.user import User
from letta.services.message_manager import MessageManager
from letta.services.summarizer.summarizer import simple_summary
from letta.services.summarizer.summarizer_config import SummarizerConfig
from letta.system import package_summarize_message_no_counts

logger = get_logger(__name__)


async def summarize_all(
    # Required to tag LLM calls
    actor: User,
    # Actual summarization configuration
    summarizer_config: SummarizerConfig,
    in_context_messages: List[Message],
    new_messages: List[Message],
) -> str:
    """
    Summarize the entire conversation history into a single summary.

    Returns:
    - The summary string
    """
    all_in_context_messages = in_context_messages + new_messages

    summary_message_str = await simple_summary(
        messages=all_in_context_messages,
        llm_config=summarizer_config.summarizer_model,
        actor=actor,
        include_ack=summarizer_config.prompt_acknowledgement,
        prompt=summarizer_config.prompt,
    )

    if summarizer_config.clip_chars is not None and len(summary_message_str) > summarizer_config.clip_chars:
        logger.warning(f"Summary length {len(summary_message_str)} exceeds clip length {summarizer_config.clip_chars}. Truncating.")
        summary_message_str = summary_message_str[: summarizer_config.clip_chars] + "... [summary truncated to fit]"

    return summary_message_str
