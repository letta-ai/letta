import asyncio
from typing import Any, Dict, List, Optional, Tuple

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
    def _extract_tag_content(text: str, tag_name: str) -> Optional[str]:
        """
        Extract content between XML-style opening and closing tags.

        Args:
            text: The text to search in
            tag_name: The name of the tag (without < >)

        Returns:
            The content between tags (inclusive of tags), or None if not found

        Note:
            If duplicate tags exist, only the first occurrence is extracted.
        """
        start_tag = f"<{tag_name}>"
        end_tag = f"</{tag_name}>"

        start_idx = text.find(start_tag)
        if start_idx == -1:
            return None

        end_idx = text.find(end_tag, start_idx)
        if end_idx == -1:
            return None

        return text[start_idx : end_idx + len(end_tag)]

    @staticmethod
    def _extract_system_prompt(system_message: str) -> Optional[str]:
        """
        Extract the system prompt / base instructions from a system message.

        First tries to find an explicit <base_instructions> tag. If not present
        (e.g. custom system prompts from Letta Code agents), falls back to
        extracting everything before the first known section tag.

        Returns:
            The system prompt text, or None if the message is empty.

        Note:
            The returned value is semantically different depending on agent type:
            - Standard agents: includes the <base_instructions>...</base_instructions> tags
            - Custom prompt agents (e.g. Letta Code): raw preamble text without any tags
        """
        _extract = ContextWindowCalculator._extract_tag_content

        # Preferred: explicit <base_instructions> wrapper
        tagged = _extract(system_message, "base_instructions")
        if tagged is not None:
            return tagged

        # Fallback: everything before the first known section tag
        section_tags = ["<memory_blocks>", "<memory_filesystem>", "<tool_usage_rules>", "<directories>", "<memory_metadata>"]
        first_section_pos = len(system_message)
        for tag in section_tags:
            pos = system_message.find(tag)
            if pos != -1 and pos < first_section_pos:
                first_section_pos = pos

        prompt = system_message[:first_section_pos].strip()
        return prompt if prompt else None

    @staticmethod
    def _extract_top_level_tag(system_message: str, tag_name: str, container_tag: str = "memory_blocks") -> Optional[str]:
        """
        Extract a tag only if it appears outside a container tag.

        This prevents extracting tags that are nested inside <memory_blocks> as
        memory block labels (e.g. a block named "memory_filesystem" rendered as
        <memory_filesystem> inside <memory_blocks>) from being confused with
        top-level sections.

        Handles the case where a tag appears both nested (inside the container)
        and at top-level — scans all occurrences to find one outside the container.

        Args:
            system_message: The full system message text
            tag_name: The tag to extract
            container_tag: The container tag to check nesting against

        Returns:
            The tag content if found at top level, None otherwise.
        """
        _extract = ContextWindowCalculator._extract_tag_content

        start_tag = f"<{tag_name}>"
        end_tag = f"</{tag_name}>"

        # Find the container boundaries
        container_start = system_message.find(f"<{container_tag}>")
        container_end = system_message.find(f"</{container_tag}>")
        has_container = container_start != -1 and container_end != -1

        # Scan all occurrences of the tag to find one outside the container
        search_start = 0
        while True:
            tag_start = system_message.find(start_tag, search_start)
            if tag_start == -1:
                return None

            # Check if this occurrence is nested inside the container
            if has_container and container_start < tag_start < container_end:
                # Skip past this nested occurrence
                search_start = tag_start + len(start_tag)
                continue

            # Found a top-level occurrence — extract it
            tag_end = system_message.find(end_tag, tag_start)
            if tag_end == -1:
                return None
            return system_message[tag_start : tag_end + len(end_tag)]

    @staticmethod
    def _extract_git_core_memory(system_message: str) -> Optional[str]:
        """
        Extract bare file blocks for git-enabled agents.

        Git-enabled agents render individual memory blocks as bare tags like
        <system/human.md>...</system/human.md> WITHOUT any container tag.
        These appear after </memory_filesystem> and before the next known
        section tag (<tool_usage_rules>, <directories>, or <memory_metadata>).

        Returns:
            The text containing all bare file blocks, or None if not found.
        """
        end_marker = "</memory_filesystem>"
        end_pos = system_message.find(end_marker)
        if end_pos == -1:
            return None

        start = end_pos + len(end_marker)

        # Find the next known section tag
        next_section_tags = ["<tool_usage_rules>", "<directories>", "<memory_metadata>"]
        next_section_pos = len(system_message)
        for tag in next_section_tags:
            pos = system_message.find(tag, start)
            if pos != -1 and pos < next_section_pos:
                next_section_pos = pos

        content = system_message[start:next_section_pos].strip()
        return content if content else None

    @staticmethod
    def extract_system_components(system_message: str) -> Dict[str, Optional[str]]:
        """
        Extract structured components from a formatted system message.

        Parses the system message to extract sections marked by XML-style tags using
        proper end-tag matching. Handles all agent types including:
        - Standard agents with <base_instructions> wrapper
        - Custom system prompts without <base_instructions> (e.g. Letta Code agents)
        - Git-enabled agents with top-level <memory_filesystem> and bare file blocks
        - React/workflow agents that don't render <memory_blocks>

        Args:
            system_message: A formatted system message containing XML-style section markers

        Returns:
            A dictionary with the following keys (value is None if section not found):
            - system_prompt: The base instructions section (or text before first section tag)
            - core_memory: The memory blocks section. For standard agents this is the
              <memory_blocks>...</memory_blocks> content. For git-enabled agents (no
              <memory_blocks> but top-level <memory_filesystem>), this captures the bare
              file blocks (e.g. <system/human.md>) that follow </memory_filesystem>.
            - memory_filesystem: Top-level memory filesystem (git-enabled agents only, NOT
              the memory_filesystem block nested inside <memory_blocks>)
            - tool_usage_rules: The tool usage rules section
            - directories: The directories section (when sources are attached)
            - external_memory_summary: The memory metadata section
        """
        _extract = ContextWindowCalculator._extract_tag_content
        _extract_top = ContextWindowCalculator._extract_top_level_tag

        core_memory = _extract(system_message, "memory_blocks")
        memory_filesystem = _extract_top(system_message, "memory_filesystem")

        # Git-enabled agents: no <memory_blocks>, but bare file blocks after </memory_filesystem>
        if core_memory is None and memory_filesystem is not None:
            core_memory = ContextWindowCalculator._extract_git_core_memory(system_message)

        return {
            "system_prompt": ContextWindowCalculator._extract_system_prompt(system_message),
            "core_memory": core_memory,
            "memory_filesystem": memory_filesystem,
            "tool_usage_rules": _extract_top(system_message, "tool_usage_rules"),
            "directories": _extract_top(system_message, "directories"),
            "external_memory_summary": _extract(system_message, "memory_metadata"),
        }

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
        message_ids: Optional[List[str]] = None,
    ) -> ContextWindowOverview:
        """Calculate context window information using the provided token counter

        Args:
            message_ids: Optional list of message IDs to use instead of agent_state.message_ids.
                         If provided, should NOT include the system message ID (index 0).
        """
        # Use provided message_ids or fall back to agent_state.message_ids[1:]
        effective_message_ids = message_ids if message_ids is not None else agent_state.message_ids[1:]
        messages = await message_manager.get_messages_by_ids_async(message_ids=effective_message_ids, actor=actor)
        in_context_messages = [system_message_compiled, *messages]

        # Filter out None messages (can occur when system message is missing)
        original_count = len(in_context_messages)
        in_context_messages = [m for m in in_context_messages if m is not None]
        if len(in_context_messages) < original_count:
            logger.warning(
                f"Filtered out {original_count - len(in_context_messages)} None messages for agent {agent_state.id}. "
                f"This typically indicates missing system message or corrupted message data."
            )

        # Convert messages to appropriate format
        converted_messages = token_counter.convert_messages(in_context_messages)

        # Extract system components
        components: Dict[str, Optional[str]] = {
            "system_prompt": None,
            "core_memory": None,
            "memory_filesystem": None,
            "tool_usage_rules": None,
            "directories": None,
            "external_memory_summary": None,
        }

        if (
            in_context_messages
            and in_context_messages[0].role == MessageRole.system
            and in_context_messages[0].content
            and len(in_context_messages[0].content) == 1
            and isinstance(in_context_messages[0].content[0], TextContent)
        ):
            system_message = in_context_messages[0].content[0].text
            components = self.extract_system_components(system_message)

        # Extract each component with fallbacks
        system_prompt = components.get("system_prompt") or agent_state.system or ""
        core_memory = components.get("core_memory") or ""
        memory_filesystem = components.get("memory_filesystem") or ""
        tool_usage_rules = components.get("tool_usage_rules") or ""
        directories = components.get("directories") or ""
        external_memory_summary = components.get("external_memory_summary") or ""

        # Extract summary memory
        summary_memory, message_start_index = self.extract_summary_memory(in_context_messages)

        # Prepare tool definitions
        available_functions_definitions = []
        if agent_state.tools:
            available_functions_definitions = [OpenAITool(type="function", function=f.json_schema) for f in agent_state.tools]

        # Count tokens concurrently for all sections, skipping empty ones
        token_counts = await asyncio.gather(
            token_counter.count_text_tokens(system_prompt),
            token_counter.count_text_tokens(core_memory) if core_memory else asyncio.sleep(0, result=0),
            token_counter.count_text_tokens(memory_filesystem) if memory_filesystem else asyncio.sleep(0, result=0),
            token_counter.count_text_tokens(tool_usage_rules) if tool_usage_rules else asyncio.sleep(0, result=0),
            token_counter.count_text_tokens(directories) if directories else asyncio.sleep(0, result=0),
            token_counter.count_text_tokens(external_memory_summary) if external_memory_summary else asyncio.sleep(0, result=0),
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
            num_tokens_memory_filesystem,
            num_tokens_tool_usage_rules,
            num_tokens_directories,
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
            # New sections
            num_tokens_memory_filesystem=num_tokens_memory_filesystem,
            memory_filesystem=memory_filesystem if memory_filesystem else None,
            num_tokens_tool_usage_rules=num_tokens_tool_usage_rules,
            tool_usage_rules=tool_usage_rules if tool_usage_rules else None,
            num_tokens_directories=num_tokens_directories,
            directories=directories if directories else None,
            # Summary and messages
            num_tokens_summary_memory=num_tokens_summary_memory,
            summary_memory=summary_memory,
            num_tokens_messages=num_tokens_messages,
            messages=in_context_messages,
            # related to functions
            num_tokens_functions_definitions=num_tokens_available_functions_definitions,
            functions_definitions=available_functions_definitions,
        )
