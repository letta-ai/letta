from typing import List

from letta.log import get_logger
from letta.otel.tracing import trace_method
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message
from letta.schemas.user import User
from letta.services.summarizer.summarizer import simple_summary
from letta.services.summarizer.summarizer_config import SummarizerConfig

logger = get_logger(__name__)


@trace_method
async def summarize_all(
    # Required to tag LLM calls
    actor: User,
    # LLM config for the summarizer model
    llm_config: LLMConfig,
    # Actual summarization configuration
    summarizer_config: SummarizerConfig,
    in_context_messages: List[Message],
    # new_messages: List[Message],
) -> str:
    """
    Summarize the entire conversation history into a single summary.

    Returns:
    - The summary string
    """
    messages_to_summarize = in_context_messages[1:]

    # TODO: add fallback in case this has a context window error
    summary_message_str = await simple_summary(
        messages=messages_to_summarize,
        llm_config=llm_config,
        actor=actor,
        include_ack=bool(summarizer_config.prompt_acknowledgement),
        prompt=summarizer_config.prompt,
    )

    if summarizer_config.clip_chars is not None and len(summary_message_str) > summarizer_config.clip_chars:
        logger.warning(f"Summary length {len(summary_message_str)} exceeds clip length {summarizer_config.clip_chars}. Truncating.")
        summary_message_str = summary_message_str[: summarizer_config.clip_chars] + "... [summary truncated to fit]"

    return summary_message_str, [in_context_messages[0]]
