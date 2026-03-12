"""Claude Code-style summarization where agent self-summarizes using its own LLM."""

from typing import List, Optional, Tuple

from letta.llm_api.llm_client import LLMClient
from letta.log import get_logger
from letta.otel.tracing import trace_method
from letta.schemas.agent import AgentType
from letta.schemas.enums import MessageRole, ProviderType
from letta.schemas.letta_message_content import TextContent
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message
from letta.schemas.user import User
from letta.services.summarizer.summarizer_config import CompactionSettings, get_default_prompt_for_mode
from letta.services.summarizer.summarizer_sliding_window import count_tokens
from letta.services.telemetry_manager import TelemetryManager

logger = get_logger(__name__)


@trace_method
async def self_summarize_all(
    actor: User,
    agent_id: str,
    agent_llm_config: LLMConfig,
    telemetry_manager: TelemetryManager,
    llm_client: LLMClient,
    agent_type: AgentType,
    messages: List[Message],
    compaction_settings: CompactionSettings,
    timezone: str,
    run_id: Optional[str] = None,
    step_id: Optional[str] = None,
    agent_tags: Optional[List[str]] = None,
    # For cache compatibility with regular agent requests
    tools: Optional[List[dict]] = None,
) -> Tuple[str, List[Message], str]:
    """Summary request is added as a user message, then the agent's LLM is called with the messages + request.
    The agent's summary response is parsed and returned.
    """
    logger.info(f"Starting self-summarization for {len(messages)} messages")

    # Protect system message and handle last message
    if len(messages) < 2:
        logger.warning("Too few messages to summarize")
        return "No conversation to summarize.", messages

    system_message = messages[0]

    # Cutoff rules for what you can/can't separate
    messages_to_summarize, protected_messages = _get_protected_messages(messages)

    # Create the summary request message
    if compaction_settings.prompt is None:
        compaction_settings.prompt = get_default_prompt_for_mode(compaction_settings.mode)

    logger.info(f"Summarizing {len(messages)} messages with prompt: {compaction_settings.prompt[:100]}...")
    summary_request_message = Message(
        role=MessageRole.user,
        content=[TextContent(text=compaction_settings.prompt)],
        agent_id=agent_id,
    )

    # If the last message is not an assistant message, add a dummy assistant message to prevent LLM from continuing the conversation
    if messages_to_summarize[-1].role != MessageRole.assistant:
        messages_with_request = [
            *messages_to_summarize,
            Message(role=MessageRole.assistant, content=[TextContent(text="I understand. Let me summarize.")], agent_id=agent_id),
            summary_request_message,
        ]
        logger.info(
            f"Calling agent's LLM for self-summarization with {len(messages_with_request)} messages ({len(messages_to_summarize)} in-context + 1 dummy assistant message + 1 summary request)"
        )
    else:
        # Last message is already assistant, safe to append user directly
        messages_with_request = [*messages_to_summarize, summary_request_message]
        logger.info(
            f"Calling agent's LLM for self-summarization with {len(messages_with_request)} messages ({len(messages_to_summarize)} in-context + 1 summary request)"
        )

    # Set telemetry context
    llm_client.set_telemetry_context(
        telemetry_manager=telemetry_manager,
        agent_id=agent_id,
        agent_tags=agent_tags,
        run_id=run_id,
        step_id=step_id,
        call_type="summarization",
        org_id=actor.organization_id if actor.organization_id else None,
        user_id=actor.id if actor.id else None,
        compaction_settings=compaction_settings.model_dump() if compaction_settings else None,
        actor=actor,
    )

    # Build request data using agent's llm_client
    # Match params used by agent_v3 for cache compatibility
    request_data = llm_client.build_request_data(
        agent_type,
        messages_with_request,
        agent_llm_config,
        tools=tools,
        force_tool_call=None,  # Don't force tool calls during summarization
        requires_subsequent_tool_call=False,
        # tool_return_truncation_chars=TOOL_RETURN_TRUNCATION_CHARS,
    )

    # Match parallel_tool_calls setting from agent's llm_config for cache compatibility
    # This mirrors the logic in letta_agent_v3.py step processing
    if agent_llm_config.model_endpoint_type in [ProviderType.anthropic, ProviderType.bedrock]:
        if isinstance(request_data.get("tool_choice"), dict) and "disable_parallel_tool_use" in request_data["tool_choice"]:
            if agent_llm_config.parallel_tool_calls:
                request_data["tool_choice"]["disable_parallel_tool_use"] = False
            else:
                request_data["tool_choice"]["disable_parallel_tool_use"] = True

    # Call LLM by sending a message
    from letta.services.summarizer.summarizer import _run_summarizer_request

    try:
        summary_text = await _run_summarizer_request(request_data, messages_with_request, agent_llm_config, llm_client)
    except Exception as e:
        logger.error(f"Self-summarization request failed: {e}")

        # handle LLM error (likely a context window exceeded error)
        try:
            raise llm_client.handle_llm_error(e, llm_config=agent_llm_config)
        except Exception as e:
            logger.error(f"Self-summarization request failed: {e}")
            raise e

    # Clip if needed
    if compaction_settings.clip_chars is not None and len(summary_text) > compaction_settings.clip_chars:
        logger.warning(f"CC summary length {len(summary_text)} exceeds clip length {compaction_settings.clip_chars}. Truncating.")
        summary_text = summary_text[: compaction_settings.clip_chars] + "... [summary truncated to fit]"

    # Build final messages: [system] + protected messages
    # Summary message handling is done in compact parent function
    final_messages = [system_message]
    if protected_messages:
        final_messages += protected_messages

    logger.info(
        f"Self-summarization complete. Summary length: {len(summary_text)} chars. Keeping {len(protected_messages)} protected messages."
    )

    return summary_text, final_messages


@trace_method
async def self_summarize_sliding_window(
    actor: User,
    agent_id: str,
    agent_llm_config: LLMConfig,
    telemetry_manager: TelemetryManager,
    llm_client: LLMClient,
    agent_type: AgentType,
    messages: List[Message],
    compaction_settings: CompactionSettings,
    timezone: str,
    run_id: Optional[str] = None,
    step_id: Optional[str] = None,
    agent_tags: Optional[List[str]] = None,
    # For cache compatibility with regular agent requests
    tools: Optional[List[dict]] = None,
) -> Tuple[Message, List[Message], str]:
    """Summary request is added as a user message, then the agent's LLM is called with the messages + request.
    The agent's summary response is parsed and returned.
    """
    logger.info("Starting self-summarization with sliding window mode")
    # Protect system message and handle last message
    if len(messages) < 2:
        logger.warning("Too few messages to summarize")
        return "No conversation to summarize.", messages

    system_prompt = messages[0]

    # cannot evict a pending approval request (will cause client-side errors)
    total_message_count = len(messages)
    if messages[-1].role == MessageRole.approval:
        maximum_message_index = total_message_count - 2
    else:
        maximum_message_index = total_message_count - 1

    eviction_percentage = compaction_settings.sliding_window_percentage
    assert compaction_settings.sliding_window_percentage <= 1.0, "Sliding window percentage must be less than or equal to 1.0"
    assistant_message_index = None

    goal_tokens = (1 - compaction_settings.sliding_window_percentage) * agent_llm_config.context_window
    approx_token_count = agent_llm_config.context_window

    # allow approvals to be cutoffs (for headless agents) but ensure proper grouping with tool calls
    def is_valid_cutoff(message: Message):
        if message.role == MessageRole.assistant:
            return True
        if message.role == MessageRole.approval:
            return message.tool_calls is not None and len(message.tool_calls) > 0
        return False

    post_summarization_buffer = []
    while approx_token_count >= goal_tokens and eviction_percentage < 1.0:
        # more eviction percentage
        eviction_percentage += 0.10

        # calculate message_cutoff_index
        message_cutoff_index = round(eviction_percentage * total_message_count)

        # get index of first assistant message after the cutoff point ()
        assistant_message_index = next(
            (i for i in reversed(range(1, message_cutoff_index + 1)) if i < len(messages) and is_valid_cutoff(messages[i])),
            None,
        )
        if assistant_message_index is None:
            logger.warning(
                f"No assistant/approval message found for evicting up to index {message_cutoff_index}, incrementing eviction percentage"
            )
            continue

        # update token count
        logger.info(f"Attempting to compact messages to index {assistant_message_index} messages")
        post_summarization_buffer = list(messages[assistant_message_index:])
        approx_token_count = await count_tokens(actor, agent_llm_config, [system_prompt, *post_summarization_buffer])
        logger.info(
            f"Compacting messages index 1:{assistant_message_index} messages resulted in {approx_token_count} tokens, goal is {goal_tokens}"
        )

    if assistant_message_index is None or eviction_percentage >= 1.0:
        raise ValueError("No assistant message found for sliding window summarization")  # fall back to complete summarization

    if assistant_message_index >= maximum_message_index:
        # need to keep the last message (might contain an approval request)
        raise ValueError(f"Assistant message index {assistant_message_index} is at the end of the message buffer, skipping summarization")

    messages_to_summarize = messages[:assistant_message_index]
    logger.info(
        f"Summarizing {len(messages_to_summarize)} messages with self summarization sliding window, from index 1 to {assistant_message_index} (out of {total_message_count})"
    )

    # pass in messages_to_summarize instead of messages
    summary_text, final_messages = await self_summarize_all(
        actor=actor,
        agent_id=agent_id,
        agent_llm_config=agent_llm_config,
        telemetry_manager=telemetry_manager,
        llm_client=llm_client,
        agent_type=agent_type,
        messages=messages_to_summarize,
        compaction_settings=compaction_settings,
        timezone=timezone,
        run_id=run_id,
        step_id=step_id,
        agent_tags=agent_tags,
        tools=tools,
    )

    # final_messages should just be the system prompt
    return summary_text, final_messages + post_summarization_buffer


def _get_protected_messages(in_context_messages: List[Message]) -> Tuple[List[Message], List[Message]]:
    """Determine which messages to keep in context window."""
    if in_context_messages[-1].role == MessageRole.approval:
        # cannot evict a pending approval request (will cause client-side errors)
        # Also protect the assistant message before it if they share the same step_id
        # (both are part of the same LLM response - assistant has thinking/tool_calls, approval has approval-required subset)
        protected_messages = [in_context_messages[-1]]

        # Check if the message before approval is also from the same step (has reasoning/tool_calls)
        if len(in_context_messages) >= 2:
            potential_assistant = in_context_messages[-2]
            approval_request = in_context_messages[-1]
            if potential_assistant.role == MessageRole.assistant and potential_assistant.step_id == approval_request.step_id:
                # They're part of the same LLM response - protect both
                protected_messages = [potential_assistant, approval_request]
                messages_to_summarize = in_context_messages[:-2]
            else:
                messages_to_summarize = in_context_messages[:-1]
        else:
            messages_to_summarize = in_context_messages[:-1]
    else:
        messages_to_summarize = in_context_messages
        protected_messages = []

    return messages_to_summarize, protected_messages
