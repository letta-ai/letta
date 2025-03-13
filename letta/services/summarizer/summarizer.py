import json
from json import JSONDecodeError
from typing import List, Tuple

from letta.agents.base_agent import BaseAgent
from letta.schemas.enums import MessageRole
from letta.schemas.message import Message
from letta.schemas.openai.chat_completion_request import UserMessage
from letta.services.summarizer.enums import SummarizationMode


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
        self.summary_prefix = "Out of context message summarization:\n"

    async def summarize(
        self, in_context_messages: List[Message], new_letta_messages: List[Message], previous_summary: str
    ) -> Tuple[List[Message], str, bool]:
        """
        Summarizes or trims in_context_messages according to the chosen mode,
        and returns the updated messages plus any optional "summary message".

        Args:
            in_context_messages: The existing messages in the conversation's context.
            new_letta_messages: The newly added Letta messages (just appended).
            previous_summary: The previous summary string.

        Returns:
            (updated_messages, summary_message)
            updated_messages: The new context after trimming/summary
            summary_message: Optional summarization message that was created
                             (could be appended to the conversation if desired)
        """
        if self.mode == SummarizationMode.STATIC_MESSAGE_BUFFER:
            return await self._static_buffer_summarization(in_context_messages, new_letta_messages, previous_summary)
        else:
            # Fallback or future logic
            return in_context_messages, "", False

    async def _static_buffer_summarization(
        self, in_context_messages: List[Message], new_letta_messages: List[Message], previous_summary: str
    ) -> Tuple[List[Message], str, bool]:
        previous_summary = previous_summary[: len(self.summary_prefix)]
        all_in_context_messages = in_context_messages + new_letta_messages

        # Only summarize if we exceed `message_buffer_limit`
        if len(all_in_context_messages) <= self.message_buffer_limit:
            return all_in_context_messages, previous_summary, False

        # Aim to trim down to `message_buffer_min`
        target_trim_index = len(all_in_context_messages) - self.message_buffer_min + 1

        # Move the trim index forward until it's at a `MessageRole.user`
        while target_trim_index < len(all_in_context_messages) and all_in_context_messages[target_trim_index].role != MessageRole.user:
            target_trim_index += 1

        # TODO: Assuming system message is always at index 0
        updated_in_context_messages = [all_in_context_messages[0]] + all_in_context_messages[target_trim_index:]
        out_of_context_messages = all_in_context_messages[:target_trim_index]

        formatted_messages = []
        for m in out_of_context_messages:
            if m.content:
                try:
                    message = json.loads(m.content[0].text).get("message")
                except JSONDecodeError:
                    continue
                if message:
                    formatted_messages.append(f"{m.role.value}: {message}")

        # If we didn't trim any messages, return as-is
        if not formatted_messages:
            return all_in_context_messages, previous_summary, False

        # Generate summarization request
        summary_request_text = (
            "These are messages that are soon to be removed from the context window:\n"
            f"{formatted_messages}\n\n"
            "This is the current memory:\n"
            f"{previous_summary}\n\n"
            "Your task is to integrate any relevant updates from the messages into the memory."
            "It should be in note-taking format in natural English. You are to return the new, updated memory only."
        )

        messages = await self.summarizer_agent.step(UserMessage(content=summary_request_text))
        current_summary = "\n".join([m.content[0].text for m in messages])
        current_summary = f"{self.summary_prefix}{current_summary}"

        return updated_in_context_messages, current_summary, True
