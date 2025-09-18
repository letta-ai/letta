from typing import List

from letta.schemas.enums import MessageRole
from letta.schemas.letta_message_content import TextContent
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message


def is_reasoning_completely_disabled(llm_config: LLMConfig) -> bool:
    """
    Check if reasoning is completely disabled by verifying all three conditions:
    - put_inner_thoughts_in_kwargs is False
    - enable_reasoner is False
    - max_reasoning_tokens is 0

    Args:
        llm_config: The LLM configuration to check

    Returns:
        True if reasoning is completely disabled, False otherwise
    """
    return llm_config.put_inner_thoughts_in_kwargs is False and llm_config.enable_reasoner is False and llm_config.max_reasoning_tokens == 0


def scrub_inner_thoughts_from_messages(messages: List[Message], llm_config: LLMConfig) -> List[Message]:
    """
    Remove inner thoughts (reasoning text) from assistant messages when reasoning is completely disabled.
    This makes the LLM think reasoning was never enabled by presenting clean message history.

    Args:
        messages: List of messages to potentially scrub
        llm_config: The LLM configuration to check

    Returns:
        The message list with inner thoughts removed if reasoning is disabled, otherwise unchanged
    """
    # early return if reasoning is not completely disabled
    if not is_reasoning_completely_disabled(llm_config):
        return messages

    # process messages to remove inner thoughts from assistant messages
    for message in messages:
        if message.role == MessageRole.assistant and message.content and message.tool_calls:
            # remove text content from assistant messages that also have tool calls
            # keep only non-text content (if any)
            message.content = [content for content in message.content if not isinstance(content, TextContent)]

    return messages
