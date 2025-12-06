from typing import List, Tuple

from letta.helpers.message_helper import convert_message_creates_to_messages
from letta.log import get_logger
from letta.otel.tracing import trace_method
from letta.schemas.agent import AgentState
from letta.schemas.enums import MessageRole
from letta.schemas.letta_message_content import TextContent
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message, MessageCreate
from letta.schemas.user import User
from letta.services.context_window_calculator.token_counter import create_token_counter
from letta.services.message_manager import MessageManager
from letta.services.summarizer.summarizer import simple_summary
from letta.services.summarizer.summarizer_config import SummarizerConfig
from letta.system import package_summarize_message_no_counts

logger = get_logger(__name__)


# Safety margin for approximate token counting.
# The bytes/4 heuristic underestimates by ~25-35% for JSON-serialized messages
# due to structural overhead (brackets, quotes, colons) each becoming tokens.
APPROX_TOKEN_SAFETY_MARGIN = 1.3


async def count_tokens(actor: User, llm_config: LLMConfig, messages: List[Message]) -> int:
    """Count tokens in messages using the appropriate token counter for the model configuration."""
    token_counter = create_token_counter(
        model_endpoint_type=llm_config.model_endpoint_type,
        model=llm_config.model,
        actor=actor,
    )
    converted_messages = token_counter.convert_messages(messages)
    tokens = await token_counter.count_message_tokens(converted_messages)

    # Apply safety margin for approximate counting to avoid underestimating
    from letta.services.context_window_calculator.token_counter import ApproxTokenCounter

    if isinstance(token_counter, ApproxTokenCounter):
        return int(tokens * APPROX_TOKEN_SAFETY_MARGIN)
    return tokens


@trace_method
async def summarize_via_sliding_window(
    # Required to tag LLM calls
    actor: User,
    # Actual summarization configuration
    llm_config: LLMConfig,
    summarizer_config: SummarizerConfig,
    in_context_messages: List[Message],
    new_messages: List[Message],
) -> Tuple[str, List[Message]]:
    """
    If the total tokens is greater than the context window limit (or force=True),
    then summarize and rearrange the in-context messages (with the summary in front).

    Finding the summarization cutoff point (target of final post-summarize count is N% of configured context window):
    1. Start at a message index cutoff (1-N%)
    2. Count tokens with system prompt, prior summary (if it exists), and messages past cutoff point (messages[0] + messages[cutoff:])
    3. Is count(post_sum_messages) <= N% of configured context window?
      3a. Yes -> create new summary with [prior summary, cutoff:], and safety truncate summary with char count
      3b. No -> increment cutoff by 10%, and repeat

    Returns:
    - The summary string
    - The list of message IDs to keep in-context
    """
    system_prompt = in_context_messages[0]
    all_in_context_messages = in_context_messages + new_messages
    total_message_count = len(all_in_context_messages)

    # Starts at N% (eg 70%), and increments up until 100%
    message_count_cutoff_percent = max(
        1 - summarizer_config.sliding_window_percentage, 0.10
    )  # Some arbitrary minimum value (10%) to avoid negatives from badly configured summarizer percentage
    found_cutoff = False

    # Count tokens with system prompt, and message past cutoff point
    while not found_cutoff:
        # Mark the approximate cutoff
        message_cutoff_index = round(message_count_cutoff_percent * len(all_in_context_messages))

        # we've reached the maximum message cutoff
        if message_cutoff_index >= total_message_count:
            break

        # Walk up the list until we find the first assistant message
        for i in range(message_cutoff_index, total_message_count):
            if all_in_context_messages[i].role == MessageRole.assistant:
                assistant_message_index = i
                break
        else:
            raise ValueError(f"No assistant message found from indices {message_cutoff_index} to {total_message_count}")

        # Count tokens of the hypothetical post-summarization buffer
        post_summarization_buffer = [system_prompt] + all_in_context_messages[assistant_message_index:]
        post_summarization_buffer_tokens = await count_tokens(actor, llm_config, post_summarization_buffer)

        # If hypothetical post-summarization count lower than the target remaining percentage?
        if post_summarization_buffer_tokens <= summarizer_config.sliding_window_percentage * llm_config.context_window:
            found_cutoff = True
        else:
            message_count_cutoff_percent += 0.10
            if message_count_cutoff_percent >= 1.0:
                message_cutoff_index = total_message_count
                break

    # If we found the cutoff, summarize and return
    # If we didn't find the cutoff and we hit 100%, this is equivalent to complete summarization

    messages_to_summarize = all_in_context_messages[1:message_cutoff_index]

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

    updated_in_context_messages = all_in_context_messages[assistant_message_index:]
    return summary_message_str, updated_in_context_messages
