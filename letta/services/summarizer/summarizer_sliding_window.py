from typing import TYPE_CHECKING, List, Optional, Tuple

if TYPE_CHECKING:
    from letta.schemas.tool import Tool

from letta.log import get_logger
from letta.otel.tracing import trace_method
from letta.schemas.enums import MessageRole
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message
from letta.schemas.user import User
from letta.services.context_window_calculator.token_counter import create_token_counter
from letta.services.summarizer.summarizer import simple_summary
from letta.services.summarizer.summarizer_config import CompactionSettings

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


async def count_tokens_with_tools(
    actor: User,
    llm_config: LLMConfig,
    messages: List[Message],
    tools: Optional[List["Tool"]] = None,
) -> int:
    """Count tokens in messages AND tool definitions.

    This provides a more accurate context token count by including tool definitions,
    which are sent to the LLM but not included in the messages list.

    Args:
        actor: The user making the request.
        llm_config: The LLM configuration for selecting the appropriate tokenizer.
        messages: The in-context messages (including system message).
        tools: Optional list of Tool objects. If provided, their schemas are counted.

    Returns:
        Total token count for messages + tools.
    """
    # Delegate message counting to existing function
    message_tokens = await count_tokens(actor, llm_config, messages)

    if not tools:
        return message_tokens

    # Count tools
    from openai.types.beta.function_tool import FunctionTool as OpenAITool

    from letta.services.context_window_calculator.token_counter import ApproxTokenCounter

    token_counter = create_token_counter(
        model_endpoint_type=llm_config.model_endpoint_type,
        model=llm_config.model,
        actor=actor,
    )

    # Tools can be either Tool objects (with .json_schema) or dicts (json schemas directly)
    # For compatibility with how tools need to be passed in for self compaction
    tool_definitions = [
        OpenAITool(type="function", function=t.json_schema if hasattr(t, "json_schema") else t)
        for t in tools
        if (hasattr(t, "json_schema") and t.json_schema) or (isinstance(t, dict) and t)
    ]
    tool_tokens = await token_counter.count_tool_tokens(tool_definitions) if tool_definitions else 0

    # Apply safety margin for approximate counting (message_tokens already has margin applied)
    if isinstance(token_counter, ApproxTokenCounter):
        tool_tokens = int(tool_tokens * APPROX_TOKEN_SAFETY_MARGIN)

    return message_tokens + tool_tokens


@trace_method
async def summarize_via_sliding_window(
    # Required to tag LLM calls
    actor: User,
    # LLM config for the summarizer model (used to generate the summary)
    llm_config: LLMConfig,
    # LLM config for the agent model (used to determine context window cutoff for eviction)
    agent_llm_config: LLMConfig,
    summarizer_config: CompactionSettings,
    in_context_messages: List[Message],
    # Telemetry context
    agent_id: Optional[str] = None,
    agent_tags: Optional[List[str]] = None,
    run_id: Optional[str] = None,
    step_id: Optional[str] = None,
) -> Tuple[str, List[Message]]:
    """
    If the total tokens is greater than the context window limit (or force=True),
    then summarize and rearrange the in-context messages (with the summary in front).

    Finding the summarization cutoff point (target of final post-summarize count is N% of agent's context window):
    1. Start at a message index cutoff (1-N%)
    2. Count tokens with system prompt, prior summary (if it exists), and messages past cutoff point (messages[0] + messages[cutoff:])
    3. Is count(post_sum_messages) <= N% of agent's context window?
      3a. Yes -> create new summary with [prior summary, cutoff:], and safety truncate summary with char count
      3b. No -> increment cutoff by 10%, and repeat

    Returns:
    - The summary string
    - The list of message IDs to keep in-context
    """
    system_prompt = in_context_messages[0]
    total_message_count = len(in_context_messages)

    # cannot evict a pending approval request (will cause client-side errors)
    if in_context_messages[-1].role == MessageRole.approval:
        maximum_message_index = total_message_count - 2
    else:
        maximum_message_index = total_message_count - 1

    # simple version: summarize(in_context[1:round(summarizer_config.sliding_window_percentage * len(in_context_messages))])
    # this evicts 30% of the messages (via summarization) and keeps the remaining 70%
    # problem: we need the cutoff point to be an assistant message, so will grow the cutoff point until we find an assistant message
    # also need to grow the cutoff point until the token count is less than the target token count

    # Starts at N% (eg 70%), and increments up until 100%
    max(
        1 - summarizer_config.sliding_window_percentage, 0.10
    )  # Some arbitrary minimum value (10%) to avoid negatives from badly configured summarizer percentage
    eviction_percentage = summarizer_config.sliding_window_percentage
    assert summarizer_config.sliding_window_percentage <= 1.0, "Sliding window percentage must be less than or equal to 1.0"
    assistant_message_index = None

    goal_tokens = (1 - summarizer_config.sliding_window_percentage) * agent_llm_config.context_window
    approx_token_count = agent_llm_config.context_window

    # allow approvals to be cutoffs (for headless agents) but ensure proper grouping with tool calls
    def is_valid_cutoff(message: Message):
        if message.role == MessageRole.assistant:
            return True
        if message.role == MessageRole.approval:
            return message.tool_calls is not None and len(message.tool_calls) > 0
        return False

    while approx_token_count >= goal_tokens and eviction_percentage < 1.0:
        # more eviction percentage
        eviction_percentage += 0.10

        # calculate message_cutoff_index
        message_cutoff_index = round(eviction_percentage * total_message_count)

        # get index of first assistant message after the cutoff point ()
        assistant_message_index = next(
            (
                i
                for i in reversed(range(1, message_cutoff_index + 1))
                if i < len(in_context_messages) and is_valid_cutoff(in_context_messages[i])
            ),
            None,
        )
        if assistant_message_index is None:
            logger.warning(
                f"No assistant/approval message found for evicting up to index {message_cutoff_index}, incrementing eviction percentage"
            )
            continue

        # update token count
        logger.info(f"Attempting to compact messages index 1:{assistant_message_index} messages")
        post_summarization_buffer = [system_prompt, *in_context_messages[assistant_message_index:]]
        approx_token_count = await count_tokens(actor, agent_llm_config, post_summarization_buffer)
        logger.info(
            f"Compacting messages index 1:{assistant_message_index} messages resulted in {approx_token_count} tokens, goal is {goal_tokens}"
        )

    if assistant_message_index is None or eviction_percentage >= 1.0:
        raise ValueError("No assistant message found for sliding window summarization")  # fall back to complete summarization

    if assistant_message_index >= maximum_message_index:
        # need to keep the last message (might contain an approval request)
        raise ValueError(f"Assistant message index {assistant_message_index} is at the end of the message buffer, skipping summarization")

    messages_to_summarize = in_context_messages[1:assistant_message_index]
    logger.info(
        f"Summarizing {len(messages_to_summarize)} messages, from index 1 to {assistant_message_index} (out of {total_message_count})"
    )

    summary_message_str = await simple_summary(
        messages=messages_to_summarize,
        llm_config=llm_config,
        actor=actor,
        include_ack=bool(summarizer_config.prompt_acknowledgement),
        prompt=summarizer_config.prompt,
        agent_id=agent_id,
        agent_tags=agent_tags,
        run_id=run_id,
        step_id=step_id,
        compaction_settings={
            "mode": "sliding_window",
            "messages_summarized": len(messages_to_summarize),
            "messages_kept": total_message_count - assistant_message_index,
            "sliding_window_percentage": summarizer_config.sliding_window_percentage,
            "clip_chars": summarizer_config.clip_chars,
        },
    )

    logger.info(f"\n==================\nSummary message string: {summary_message_str[:100]}...\n==================\n")

    if summarizer_config.clip_chars is not None and len(summary_message_str) > summarizer_config.clip_chars:
        logger.warning(f"Summary length {len(summary_message_str)} exceeds clip length {summarizer_config.clip_chars}. Truncating.")
        summary_message_str = summary_message_str[: summarizer_config.clip_chars] + "... [summary truncated to fit]"

    updated_in_context_messages = in_context_messages[assistant_message_index:]
    return summary_message_str, [system_prompt, *updated_in_context_messages]
