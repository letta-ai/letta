import asyncio
import json
import traceback
from typing import List, Optional, Tuple, Union

from letta.agents.ephemeral_summary_agent import EphemeralSummaryAgent
from letta.constants import DEFAULT_MESSAGE_TOOL, DEFAULT_MESSAGE_TOOL_KWARG, MESSAGE_SUMMARY_REQUEST_ACK
from letta.helpers.message_helper import convert_message_creates_to_messages
from letta.llm_api.llm_client import LLMClient
from letta.log import get_logger
from letta.otel.tracing import trace_method
from letta.prompts import gpt_summarize
from letta.schemas.enums import MessageRole
from letta.schemas.letta_message_content import TextContent
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message, MessageCreate
from letta.schemas.user import User
from letta.services.summarizer.enums import SummarizationMode
from letta.system import package_summarize_message_no_counts
from letta.templates.template_helper import render_template

logger = get_logger(__name__)


class Summarizer:
    """
    Handles summarization or trimming of conversation messages based on
    the specified SummarizationMode. For now, we demonstrate a simple
    static buffer approach but leave room for more advanced strategies.
    """

    def __init__(
        self,
        mode: SummarizationMode,
        summarizer_agent: Optional[Union[EphemeralSummaryAgent, "VoiceSleeptimeAgent"]] = None,
        message_buffer_limit: int = 10,
        message_buffer_min: int = 3,
        partial_evict_summarizer_percentage: float = 0.30,
    ):
        self.mode = mode

        # Need to do validation on this
        # TODO: Move this to config
        self.message_buffer_limit = message_buffer_limit
        self.message_buffer_min = message_buffer_min
        self.summarizer_agent = summarizer_agent
        self.partial_evict_summarizer_percentage = partial_evict_summarizer_percentage

    @trace_method
    async def summarize(
        self,
        in_context_messages: List[Message],
        new_letta_messages: List[Message],
        force: bool = False,
        clear: bool = False,
    ) -> Tuple[List[Message], bool]:
        """
        Summarizes or trims in_context_messages according to the chosen mode,
        and returns the updated messages plus any optional "summary message".

        Args:
            in_context_messages: The existing messages in the conversation's context.
            new_letta_messages: The newly added Letta messages (just appended).
            force: Force summarize even if the criteria is not met

        Returns:
            (updated_messages, summary_message)
            updated_messages: The new context after trimming/summary
            summary_message: Optional summarization message that was created
                             (could be appended to the conversation if desired)
        """
        if self.mode == SummarizationMode.STATIC_MESSAGE_BUFFER:
            return self._static_buffer_summarization(
                in_context_messages,
                new_letta_messages,
                force=force,
                clear=clear,
            )
        elif self.mode == SummarizationMode.PARTIAL_EVICT_MESSAGE_BUFFER:
            return await self._partial_evict_buffer_summarization(
                in_context_messages,
                new_letta_messages,
                force=force,
                clear=clear,
            )
        else:
            # Fallback or future logic
            return in_context_messages, False

    def fire_and_forget(self, coro):
        task = asyncio.create_task(coro)

        def callback(t):
            try:
                t.result()  # This re-raises exceptions from the task
            except Exception:
                logger.error("Background task failed: %s", traceback.format_exc())

        task.add_done_callback(callback)
        return task

    async def _partial_evict_buffer_summarization(
        self,
        in_context_messages: List[Message],
        new_letta_messages: List[Message],
        force: bool = False,
        clear: bool = False,
    ) -> Tuple[List[Message], bool]:
        """Summarization as implemented in the original MemGPT loop, but using message count instead of token count.
        Evict a partial amount of messages, and replace message[1] with a recursive summary.

        Note that this can't be made sync, because we're waiting on the summary to inject it into the context window,
        unlike the version that writes it to a block.

        Unless force is True, don't summarize.
        Ignore clear, we don't use it.
        """
        all_in_context_messages = in_context_messages + new_letta_messages

        if not force:
            logger.debug("Not forcing summarization, returning in-context messages as is.")
            return all_in_context_messages, False

        # Very ugly code to pull LLMConfig etc from the SummarizerAgent if we're not using it for anything else
        assert self.summarizer_agent is not None

        # First step: determine how many messages to retain
        total_message_count = len(all_in_context_messages)
        assert self.partial_evict_summarizer_percentage >= 0.0 and self.partial_evict_summarizer_percentage <= 1.0
        target_message_start = round((1.0 - self.partial_evict_summarizer_percentage) * total_message_count)
        logger.info(f"Target message count: {total_message_count}->{(total_message_count-target_message_start)}")

        # The summary message we'll insert is role 'user' (vs 'assistant', 'tool', or 'system')
        # We are going to put it at index 1 (index 0 is the system message)
        # That means that index 2 needs to be role 'assistant', so walk up the list starting at
        # the target_message_count and find the first assistant message
        for i in range(target_message_start, total_message_count):
            if all_in_context_messages[i].role == MessageRole.assistant:
                assistant_message_index = i
                break
        else:
            raise ValueError(f"No assistant message found from indices {target_message_start} to {total_message_count}")

        # The sequence to summarize is index 1 -> assistant_message_index
        messages_to_summarize = all_in_context_messages[1:assistant_message_index]
        logger.info(f"Eviction indices: {1}->{assistant_message_index}(/{total_message_count})")

        # Dynamically get the LLMConfig from the summarizer agent
        # Pretty cringe code here that we need the agent for this but we don't use it
        agent_state = await self.summarizer_agent.agent_manager.get_agent_by_id_async(
            agent_id=self.summarizer_agent.agent_id, actor=self.summarizer_agent.actor
        )

        # TODO if we do this via the "agent", then we can more easily allow toggling on the memory block version
        summary_message_str = await simple_summary(
            messages=messages_to_summarize,
            llm_config=agent_state.llm_config,
            actor=self.summarizer_agent.actor,
            include_ack=True,
        )

        # TODO add counts back
        # Recall message count
        # num_recall_messages_current = await self.message_manager.size_async(actor=self.actor, agent_id=agent_state.id)
        # num_messages_evicted = len(messages_to_summarize)
        # num_recall_messages_hidden = num_recall_messages_total - len()

        # Create the summary message
        summary_message_str_packed = package_summarize_message_no_counts(
            summary=summary_message_str,
            timezone=agent_state.timezone,
        )
        summary_message_obj = convert_message_creates_to_messages(
            message_creates=[
                MessageCreate(
                    role=MessageRole.user,
                    content=[TextContent(text=summary_message_str_packed)],
                )
            ],
            agent_id=agent_state.id,
            timezone=agent_state.timezone,
            # We already packed, don't pack again
            wrap_user_message=False,
            wrap_system_message=False,
        )[0]

        # Create the message in the DB
        await self.summarizer_agent.message_manager.create_many_messages_async(
            pydantic_msgs=[summary_message_obj],
            actor=self.summarizer_agent.actor,
        )

        updated_in_context_messages = all_in_context_messages[assistant_message_index:]
        return [all_in_context_messages[0], summary_message_obj] + updated_in_context_messages, True

    def _static_buffer_summarization(
        self,
        in_context_messages: List[Message],
        new_letta_messages: List[Message],
        force: bool = False,
        clear: bool = False,
    ) -> Tuple[List[Message], bool]:
        """
        Implements static buffer summarization by maintaining a fixed-size message buffer (< N messages).

        Logic:
        1. Combine existing context messages with new messages
        2. If total messages <= buffer limit and not forced, return unchanged
        3. Calculate how many messages to retain (0 if clear=True, otherwise message_buffer_min)
        4. Find the trim index to keep the most recent messages while preserving user message boundaries
        5. Evict older messages (everything between system message and trim index)
        6. If summarizer agent is available, trigger background summarization of evicted messages
        7. Return updated context with system message + retained recent messages

        Args:
            in_context_messages: Existing conversation context messages
            new_letta_messages: Newly added messages to append
            force: Force summarization even if buffer limit not exceeded
            clear: Clear all messages except system message (retain_count = 0)

        Returns:
            Tuple of (updated_messages, was_summarized)
            - updated_messages: New context after trimming/summarization
            - was_summarized: True if messages were evicted and summarization triggered
        """

        all_in_context_messages = in_context_messages + new_letta_messages

        if len(all_in_context_messages) <= self.message_buffer_limit and not force:
            logger.info(
                f"Nothing to evict, returning in context messages as is. Current buffer length is {len(all_in_context_messages)}, limit is {self.message_buffer_limit}."
            )
            return all_in_context_messages, False

        retain_count = 0 if clear else self.message_buffer_min

        if not force:
            logger.info(f"Buffer length hit {self.message_buffer_limit}, evicting until we retain only {retain_count} messages.")
        else:
            logger.info(f"Requested force summarization, evicting until we retain only {retain_count} messages.")

        target_trim_index = max(1, len(all_in_context_messages) - retain_count)

        while target_trim_index < len(all_in_context_messages) and all_in_context_messages[target_trim_index].role != MessageRole.user:
            target_trim_index += 1

        evicted_messages = all_in_context_messages[1:target_trim_index]  # everything except sys msg
        updated_in_context_messages = all_in_context_messages[target_trim_index:]  # may be empty

        # If *no* messages were evicted we really have nothing to do
        if not evicted_messages:
            logger.info("Nothing to evict, returning in-context messages as-is.")
            return all_in_context_messages, False

        if self.summarizer_agent:
            # Only invoke if summarizer agent is passed in
            # Format
            formatted_evicted_messages = format_transcript(evicted_messages)
            formatted_in_context_messages = format_transcript(updated_in_context_messages)

            # TODO: This is hyperspecific to voice, generalize!
            # Update the message transcript of the memory agent
            if not isinstance(self.summarizer_agent, EphemeralSummaryAgent):
                self.summarizer_agent.update_message_transcript(
                    message_transcripts=formatted_evicted_messages + formatted_in_context_messages
                )

            # Add line numbers to the formatted messages
            offset = len(formatted_evicted_messages)
            formatted_evicted_messages = [f"{i}. {msg}" for (i, msg) in enumerate(formatted_evicted_messages)]
            formatted_in_context_messages = [f"{i + offset}. {msg}" for (i, msg) in enumerate(formatted_in_context_messages)]

            summary_request_text = render_template(
                "summary_request_text.j2",
                retain_count=retain_count,
                evicted_messages=formatted_evicted_messages,
                in_context_messages=formatted_in_context_messages,
            )

            # Fire-and-forget the summarization task
            self.fire_and_forget(
                self.summarizer_agent.step([MessageCreate(role=MessageRole.user, content=[TextContent(text=summary_request_text)])])
            )

        return [all_in_context_messages[0]] + updated_in_context_messages, True


def simple_formatter(messages: List[Message], include_system: bool = False) -> str:
    """Go from an OpenAI-style list of messages to a concatenated string"""

    parsed_messages = [message.to_openai_dict() for message in messages if message.role != MessageRole.system or include_system]
    return "\n".join(json.dumps(msg) for msg in parsed_messages)


def simple_message_wrapper(openai_msg: dict) -> Message:
    """Extremely simple way to map from role/content to Message object w/ throwaway dummy fields"""

    if "role" not in openai_msg:
        raise ValueError(f"Missing role in openai_msg: {openai_msg}")
    if "content" not in openai_msg:
        raise ValueError(f"Missing content in openai_msg: {openai_msg}")

    if openai_msg["role"] == "user":
        return Message(
            role=MessageRole.user,
            content=[TextContent(text=openai_msg["content"])],
        )
    elif openai_msg["role"] == "assistant":
        return Message(
            role=MessageRole.assistant,
            content=[TextContent(text=openai_msg["content"])],
        )
    elif openai_msg["role"] == "system":
        return Message(
            role=MessageRole.system,
            content=[TextContent(text=openai_msg["content"])],
        )
    else:
        raise ValueError(f"Unknown role: {openai_msg['role']}")


async def simple_summary(messages: List[Message], llm_config: LLMConfig, actor: User, include_ack: bool = True) -> str:
    """Generate a simple summary from a list of messages.

    Intentionally kept functional due to the simplicity of the prompt.
    """

    # Create an LLMClient from the config
    llm_client = LLMClient.create(
        provider_type=llm_config.model_endpoint_type,
        put_inner_thoughts_first=True,
        actor=actor,
    )
    assert llm_client is not None

    # Prepare the messages payload to send to the LLM
    system_prompt = gpt_summarize.SYSTEM
    summary_transcript = simple_formatter(messages)

    if include_ack:
        input_messages = [
            {"role": "system", "content": system_prompt},
            {"role": "assistant", "content": MESSAGE_SUMMARY_REQUEST_ACK},
            {"role": "user", "content": summary_transcript},
        ]
    else:
        input_messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": summary_transcript},
        ]
    print("messages going to summarizer:", input_messages)
    input_messages_obj = [simple_message_wrapper(msg) for msg in input_messages]
    print("messages going to summarizer (objs):", input_messages_obj)

    request_data = llm_client.build_request_data(input_messages_obj, llm_config, tools=[])
    print("request data:", request_data)
    # NOTE: we should disable the inner_thoughts_in_kwargs here, because we don't use it
    # I'm leaving it commented it out for now for safety but is fine assuming the var here is a copy not a reference
    # llm_config.put_inner_thoughts_in_kwargs = False
    response_data = await llm_client.request_async(request_data, llm_config)
    response = llm_client.convert_response_to_chat_completion(response_data, input_messages_obj, llm_config)
    if response.choices[0].message.content is None:
        logger.warning("No content returned from summarizer")
        # TODO raise an error error instead?
        # return "[Summary failed to generate]"
        raise Exception("Summary failed to generate")
    else:
        summary = response.choices[0].message.content.strip()

    return summary


def format_transcript(messages: List[Message], include_system: bool = False) -> List[str]:
    """
    Turn a list of Message objects into a human-readable transcript.

    Args:
        messages: List of Message instances, in chronological order.
        include_system: If True, include system-role messages. Defaults to False.

    Returns:
        A single string, e.g.:
          user: Hey, my name is Matt.
          assistant: Hi Matt! It's great to meet you...
          user: What's the weather like? ...
          assistant: The weather in Las Vegas is sunny...
    """
    lines = []
    for msg in messages:
        role = msg.role.value  # e.g. 'user', 'assistant', 'system', 'tool'
        # skip system messages by default
        if role == "system" and not include_system:
            continue

        # 1) Try plain content
        if msg.content:
            # Skip tool messages where the name is "send_message"
            if msg.role == MessageRole.tool and msg.name == DEFAULT_MESSAGE_TOOL:
                continue

            text = "".join(c.text for c in msg.content if isinstance(c, TextContent)).strip()

        # 2) Otherwise, try extracting from function calls
        elif msg.tool_calls:
            parts = []
            for call in msg.tool_calls:
                args_str = call.function.arguments
                if call.function.name == DEFAULT_MESSAGE_TOOL:
                    try:
                        args = json.loads(args_str)
                        # pull out a "message" field if present
                        parts.append(args.get(DEFAULT_MESSAGE_TOOL_KWARG, args_str))
                    except json.JSONDecodeError:
                        parts.append(args_str)
                else:
                    parts.append(args_str)
            text = " ".join(parts).strip()

        else:
            # nothing to show for this message
            continue

        lines.append(f"{role}: {text}")

    return lines
