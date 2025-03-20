import asyncio
import json
import traceback
from json import JSONDecodeError
from typing import List, Tuple

from letta.agents.base_agent import BaseAgent
from letta.log import get_logger
from letta.schemas.enums import MessageRole
from letta.schemas.message import Message
from letta.schemas.openai.chat_completion_request import UserMessage
from letta.services.summarizer.enums import SummarizationMode

logger = get_logger(__name__)


class Summarizer:
    """
    Handles summarization or trimming of conversation messages based on
    the specified SummarizationMode. For now, we demonstrate a simple
    static buffer approach but leave room for more advanced strategies.
    """

    def __init__(self, mode: SummarizationMode, summarizer_agent: BaseAgent, message_buffer_limit: int = 10, message_buffer_min: int = 3):
        self.mode = mode

        # Need to do validation on this
        self.message_buffer_limit = message_buffer_limit
        self.message_buffer_min = message_buffer_min
        self.summarizer_agent = summarizer_agent
        # TODO: Move this to config

    async def summarize(self, in_context_messages: List[Message], new_letta_messages: List[Message]) -> Tuple[List[Message], bool]:
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
            return await self._static_buffer_summarization(in_context_messages, new_letta_messages)
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

    async def _static_buffer_summarization(
        self, in_context_messages: List[Message], new_letta_messages: List[Message]
    ) -> Tuple[List[Message], bool]:
        all_in_context_messages = in_context_messages + new_letta_messages

        if len(all_in_context_messages) <= self.message_buffer_limit:
            return all_in_context_messages, False

        target_trim_index = len(all_in_context_messages) - self.message_buffer_min + 1

        while target_trim_index < len(all_in_context_messages) and all_in_context_messages[target_trim_index].role != MessageRole.user:
            target_trim_index += 1

        updated_in_context_messages = [all_in_context_messages[0]] + all_in_context_messages[target_trim_index:]

        formatted_messages = []
        for m in all_in_context_messages[1:]:
            if m.content:
                try:
                    message = json.loads(m.content[0].text).get("message")
                except JSONDecodeError:
                    continue
                if message:
                    formatted_messages.append(f"{m.role.value}: {message}")

        if not formatted_messages:
            return all_in_context_messages, False

        summary_request_text = f"""
        You are a specialized memory recall agent assisting another AI agent by asynchronously reorganizing its memory storage. The LLM agent you are helping maintains a limited context window that retains only the most recent {self.message_buffer_min} messages from its conversations. The provided conversation history includes messages that are about to exit its context window, as well as some additional recent messages for extra clarity and context.

        Your task is to carefully review the provided conversation history and proactively generate detailed, relevant memory notes about the human participant, specifically targeting information contained in messages that are about to leave the context window. Your notes will help preserve critical insights, events, or facts that would otherwise be forgotten.

        You have access to specialized memory storage tools enabling you to:
        1. Store episodic memories (specific events or conversations).
        2. Store semantic memories (general facts or information about the human).
        3. Summarize the stored memories into metadata. This will be useful to the other AI agent to know generally what information is in its memory storage.

        Guidelines for creating memory entries:
        - Write from the perspective of an observer noting important details about the human participant.
        - Provide concise yet informative details directly relevant to the current interactions and the human's queries.
        - When helpful, include direct quotes from the conversation history.

        Your required workflow is as follows:
        1. Store one or more relevant episodic or semantic memories as necessary by invoking your available memory tools. If nothing is worth storing, don't invoke any tools.
        2. After storing memories, always summarize them clearly to create an organized narrative.
        3. Once you have completed storing and summarizing the essential memories, stop invoking memory tools to conclude your task.

        Current In-Context Messages:
        {formatted_messages}

        Use the available memory tools as needed to ensure important details are preserved before they leave the LLM agent's context window.
        """

        # Fire-and-forget the summarization task
        self.fire_and_forget(self.summarizer_agent.step(UserMessage(content=summary_request_text)))

        return updated_in_context_messages, True
