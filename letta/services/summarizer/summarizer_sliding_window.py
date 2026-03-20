from typing import List, Optional, Tuple

from letta.log import get_logger
from letta.otel.tracing import trace_method
from letta.schemas.enums import MessageRole
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message
from letta.schemas.provider_trace import BillingContext
from letta.schemas.user import User
from letta.services.context_window_calculator.token_counter import create_token_counter
from letta.services.summarizer.constants import COMPACTION_TOKEN_HEURISTIC_SAFETY_MARGIN, SUMMARY_TRUNCATION_SUFFIX
from letta.services.summarizer.summarizer import simple_summary
from letta.services.summarizer.summarizer_config import CompactionSettings

logger = get_logger(__name__)


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
    billing_context: Optional[BillingContext] = None,
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
        token_counter = create_token_counter(
            model_endpoint_type=agent_llm_config.model_endpoint_type,
            model=agent_llm_config.model,
            actor=actor,
            safety_margin=COMPACTION_TOKEN_HEURISTIC_SAFETY_MARGIN,
        )
        converted = token_counter.convert_messages(post_summarization_buffer)
        approx_token_count = await token_counter.count_message_tokens(converted)
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
        billing_context=billing_context,
    )

    logger.info(f"\n==================\nSummary message string: {summary_message_str[:100]}...\n==================\n")

    if summarizer_config.clip_chars is not None and len(summary_message_str) > summarizer_config.clip_chars:
        logger.warning(f"Summary length {len(summary_message_str)} exceeds clip length {summarizer_config.clip_chars}. Truncating.")
        summary_message_str = summary_message_str[: summarizer_config.clip_chars] + SUMMARY_TRUNCATION_SUFFIX

    updated_in_context_messages = in_context_messages[assistant_message_index:]
    return summary_message_str, [system_prompt, *updated_in_context_messages]
