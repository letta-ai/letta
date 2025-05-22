import asyncio
import json
import traceback
from typing import List, Optional, Tuple

from letta.constants import DEFAULT_MESSAGE_TOOL, DEFAULT_MESSAGE_TOOL_KWARG
from letta.log import get_logger
from letta.schemas.enums import MessageRole
from letta.schemas.letta_message_content import TextContent
from letta.schemas.message import Message, MessageCreate
from letta.services.summarizer.enums import SummarizationMode

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
        summarizer_agent: Optional["VoiceSleeptimeAgent"] = None,
        message_buffer_limit: int = 10,
        message_buffer_min: int = 3,
    ):
        self.mode = mode

        # Need to do validation on this
        self.message_buffer_limit = message_buffer_limit
        self.message_buffer_min = message_buffer_min
        self.summarizer_agent = summarizer_agent
        # TODO: Move this to config

    def summarize(self, in_context_messages: List[Message], new_letta_messages: List[Message]) -> Tuple[List[Message], bool]:
        """
        Summarizes or trims in_context_messages according to the chosen mode,
        and returns the updated messages plus any optional "summary message".

        Args:
            in_context_messages: The existing messages in the conversation's context.
            new_letta_messages: The newly added Letta messages (just appended).

        Returns:
            (updated_messages, summary_message)
            updated_messages: The new context after trimming/summary
            summary_message: Optional summarization message that was created
                             (could be appended to the conversation if desired)
        """
        if self.mode == SummarizationMode.STATIC_MESSAGE_BUFFER:
            return self._static_buffer_summarization(in_context_messages, new_letta_messages)
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

    def _static_buffer_summarization(
        self, in_context_messages: List[Message], new_letta_messages: List[Message]
    ) -> Tuple[List[Message], bool]:
        all_in_context_messages = in_context_messages + new_letta_messages

        if len(all_in_context_messages) <= self.message_buffer_limit:
            logger.info(
                f"Nothing to evict, returning in context messages as is. Current buffer length is {len(all_in_context_messages)}, limit is {self.message_buffer_limit}."
            )
            return all_in_context_messages, False

        logger.info("Buffer length hit, evicting messages.")

        target_trim_index = len(all_in_context_messages) - self.message_buffer_min

        while target_trim_index < len(all_in_context_messages) and all_in_context_messages[target_trim_index].role != MessageRole.user:
            target_trim_index += 1

        updated_in_context_messages = all_in_context_messages[target_trim_index:]

        # Target trim index went beyond end of all_in_context_messages
        if not updated_in_context_messages:
            logger.info("Nothing to evict, returning in context messages as is.")
            return all_in_context_messages, False

        if self.summarizer_agent:
            # Only invoke if summarizer agent is passed in

            evicted_messages = all_in_context_messages[1:target_trim_index]

            # Format
            formatted_evicted_messages = format_transcript(evicted_messages)
            formatted_in_context_messages = format_transcript(updated_in_context_messages)

            # TODO: This is hyperspecific to voice, generalize!
            # Update the message transcript of the memory agent
            self.summarizer_agent.update_message_transcript(message_transcripts=formatted_evicted_messages + formatted_in_context_messages)

            # Add line numbers to the formatted messages
            offset = len(formatted_evicted_messages)
            formatted_evicted_messages = [f"{i}. {msg}" for (i, msg) in enumerate(formatted_evicted_messages)]
            formatted_in_context_messages = [f"{i + offset}. {msg}" for (i, msg) in enumerate(formatted_in_context_messages)]

            evicted_messages_str = "\n".join(formatted_evicted_messages)
            in_context_messages_str = "\n".join(formatted_in_context_messages)
            summary_request_text = f"""You’re a memory-recall helper for an AI that can only keep the last {self.message_buffer_min} messages. Scan the conversation history, focusing on messages about to drop out of that window, and write crisp notes that capture any important facts or insights about the human so they aren’t lost.

    (Older) Evicted Messages:\n
    {evicted_messages_str}\n

    (Newer) In-Context Messages:\n
    {in_context_messages_str}
    """
            # Fire-and-forget the summarization task
            self.fire_and_forget(
                self.summarizer_agent.step([MessageCreate(role=MessageRole.user, content=[TextContent(text=summary_request_text)])])
            )

        return [all_in_context_messages[0]] + updated_in_context_messages, True


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
            text = "".join(c.text for c in msg.content).strip()

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
