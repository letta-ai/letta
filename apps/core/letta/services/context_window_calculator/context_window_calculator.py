import asyncio
from typing import Any, List, Optional, Tuple

from openai.types.beta.function_tool import FunctionTool as OpenAITool

from letta.log import get_logger
from letta.schemas.agent import AgentState
from letta.schemas.enums import MessageRole
from letta.schemas.letta_message_content import TextContent
from letta.schemas.memory import ContextWindowOverview
from letta.schemas.message import Message
from letta.schemas.user import User as PydanticUser
from letta.services.context_window_calculator.token_counter import TokenCounter
from letta.services.message_manager import MessageManager

logger = get_logger(__name__)


class ContextWindowCalculator:
    """Handles context window calculations with different token counting strategies"""

    @staticmethod
    def extract_system_components(system_message: str) -> Tuple[str, str, str]:
        """
        Extract structured components from a formatted system message.

        Parses the system message to extract three distinct sections marked by XML-style tags:
        - base_instructions: The core system prompt and agent instructions
        - memory_blocks: The agent's core memory (persistent context)
        - memory_metadata: Metadata about external memory systems

        Args:
            system_message: A formatted system message containing XML-style section markers

        Returns:
            A tuple of (system_prompt, core_memory, external_memory_summary)
            Each component will be an empty string if its section is not found

        Note:
            This method assumes a specific format with sections delimited by:
            <base_instructions>, <memory_blocks>, and <memory_metadata> tags.
            The extraction is position-based and expects sections in this order.
        """
        base_start = system_message.find("<base_instructions>")
        memory_blocks_start = system_message.find("<memory_blocks>")
        metadata_start = system_message.find("<memory_metadata>")

        system_prompt = ""
        core_memory = ""
        external_memory_summary = ""

        if base_start != -1 and memory_blocks_start != -1:
            system_prompt = system_message[base_start:memory_blocks_start].strip()

        if memory_blocks_start != -1 and metadata_start != -1:
            core_memory = system_message[memory_blocks_start:metadata_start].strip()

        if metadata_start != -1:
            external_memory_summary = system_message[metadata_start:].strip()

        return system_prompt, core_memory, external_memory_summary

    @staticmethod
    def extract_summary_memory(messages: List[Any]) -> Tuple[Optional[str], int]:
        """
        Extract summary memory from the message list if present.

        Summary memory is a special message injected at position 1 (after system message)
        that contains a condensed summary of previous conversation history. This is used
        when the full conversation history doesn't fit in the context window.

        Args:
            messages: List of message objects to search for summary memory

        Returns:
            A tuple of (summary_text, start_index) where:
            - summary_text: The extracted summary content, or None if not found
            - start_index: Index where actual conversation messages begin (1 or 2)

        Detection Logic:
            Looks for a user message at index 1 containing the phrase
            "The following is a summary of the previous" which indicates
            it's a summarized conversation history rather than a real user message.
        """
        if (
            len(messages) > 1
            and messages[1].role == MessageRole.user
            and messages[1].content
            and len(messages[1].content) == 1
            and isinstance(messages[1].content[0], TextContent)
            and "The following is a summary of the previous " in messages[1].content[0].text
        ):
            summary_memory = messages[1].content[0].text
            start_index = 2
            return summary_memory, start_index

        return None, 1

    async def calculate_context_window(
        self,
        agent_state: AgentState,
        actor: PydanticUser,
        token_counter: TokenCounter,
        message_manager: MessageManager,
        system_message_compiled: Message,
        num_archival_memories: int,
        num_messages: int,
    ) -> ContextWindowOverview:
        """Calculate context window information using the provided token counter"""
        messages = await message_manager.get_messages_by_ids_async(message_ids=agent_state.message_ids[1:], actor=actor)
        in_context_messages = [system_message_compiled] + messages

        # Convert messages to appropriate format
        converted_messages = token_counter.convert_messages(in_context_messages)

        # Extract system components
        system_prompt = ""
        core_memory = ""
        external_memory_summary = ""

        if (
            in_context_messages
            and in_context_messages[0].role == MessageRole.system
            and in_context_messages[0].content
            and len(in_context_messages[0].content) == 1
            and isinstance(in_context_messages[0].content[0], TextContent)
        ):
            system_message = in_context_messages[0].content[0].text
            system_prompt, core_memory, external_memory_summary = self.extract_system_components(system_message)

        # System prompt
        system_prompt = system_prompt or agent_state.system

        # Extract summary memory
        summary_memory, message_start_index = self.extract_summary_memory(in_context_messages)

        # Prepare tool definitions
        available_functions_definitions = []
        if agent_state.tools:
            available_functions_definitions = [OpenAITool(type="function", function=f.json_schema) for f in agent_state.tools]

        # Count tokens concurrently
        token_counts = await asyncio.gather(
            token_counter.count_text_tokens(system_prompt),
            token_counter.count_text_tokens(core_memory),
            token_counter.count_text_tokens(external_memory_summary),
            token_counter.count_text_tokens(summary_memory) if summary_memory else asyncio.sleep(0, result=0),
            (
                token_counter.count_message_tokens(converted_messages[message_start_index:])
                if len(converted_messages) > message_start_index
                else asyncio.sleep(0, result=0)
            ),
            (
                token_counter.count_tool_tokens(available_functions_definitions)
                if available_functions_definitions
                else asyncio.sleep(0, result=0)
            ),
        )

        (
            num_tokens_system,
            num_tokens_core_memory,
            num_tokens_external_memory_summary,
            num_tokens_summary_memory,
            num_tokens_messages,
            num_tokens_available_functions_definitions,
        ) = token_counts

        num_tokens_used_total = sum(token_counts)

        return ContextWindowOverview(
            # context window breakdown (in messages)
            num_messages=len(in_context_messages),
            num_archival_memory=num_archival_memories,
            num_recall_memory=num_messages,
            num_tokens_external_memory_summary=num_tokens_external_memory_summary,
            external_memory_summary=external_memory_summary,
            # top-level information
            context_window_size_max=agent_state.llm_config.context_window,
            context_window_size_current=num_tokens_used_total,
            # context window breakdown (in tokens)
            num_tokens_system=num_tokens_system,
            system_prompt=system_prompt,
            num_tokens_core_memory=num_tokens_core_memory,
            core_memory=core_memory,
            num_tokens_summary_memory=num_tokens_summary_memory,
            summary_memory=summary_memory,
            num_tokens_messages=num_tokens_messages,
            messages=in_context_messages,
            # related to functions
            num_tokens_functions_definitions=num_tokens_available_functions_definitions,
            functions_definitions=available_functions_definitions,
        )
