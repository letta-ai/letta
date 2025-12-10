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
    # new_messages: List[Message],
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
    total_message_count = len(in_context_messages)

    # Starts at N% (eg 70%), and increments up until 100%
    message_count_cutoff_percent = max(
        1 - summarizer_config.sliding_window_percentage, 0.10
    )  # Some arbitrary minimum value (10%) to avoid negatives from badly configured summarizer percentage
    assert summarizer_config.sliding_window_percentage <= 1.0, "Sliding window percentage must be less than or equal to 1.0"
    assistant_message_index = None
    approx_token_count = llm_config.context_window

    while (
        approx_token_count >= summarizer_config.sliding_window_percentage * llm_config.context_window and message_count_cutoff_percent < 1.0
    ):
        # calculate message_cutoff_index
        message_cutoff_index = round(message_count_cutoff_percent * total_message_count)

        # get index of first assistant message in range
        assistant_message_index = next(
            (i for i in range(message_cutoff_index, total_message_count) if in_context_messages[i].role == MessageRole.assistant), None
        )

        # if no assistant message in tail, break out of loop (since future iterations will continue hitting this case)
        if assistant_message_index is None:
            break

        # update token count
        post_summarization_buffer = [system_prompt] + in_context_messages[assistant_message_index:]
        approx_token_count = await count_tokens(actor, llm_config, post_summarization_buffer)

        # increment cutoff
        message_count_cutoff_percent += 0.10

    if assistant_message_index is None:
        raise ValueError("No assistant message found for sliding window summarization")  # fall back to complete summarization

    messages_to_summarize = in_context_messages[1:assistant_message_index]

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

    updated_in_context_messages = in_context_messages[assistant_message_index:]
    return summary_message_str, [system_prompt] + updated_in_context_messages
