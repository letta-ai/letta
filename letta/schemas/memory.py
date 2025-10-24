import asyncio
import logging
from datetime import datetime
from io import StringIO
from typing import TYPE_CHECKING, List, Optional, Union

from letta.log import get_logger

logger = get_logger(__name__)

from openai.types.beta.function_tool import FunctionTool as OpenAITool
from pydantic import BaseModel, Field, field_validator

from letta.constants import CORE_MEMORY_BLOCK_CHAR_LIMIT, CORE_MEMORY_LINE_NUMBER_WARNING
from letta.otel.tracing import trace_method
from letta.schemas.block import Block, FileBlock
from letta.schemas.enums import AgentType
from letta.schemas.file import FileStatus
from letta.schemas.message import Message


class ContextWindowOverview(BaseModel):
    """
    Overview of the context window, including the number of messages and tokens.
    """

    context_window_size_max: int = Field(..., description="The maximum amount of tokens the context window can hold.")
    context_window_size_current: int = Field(..., description="The current number of tokens in the context window.")

    num_messages: int = Field(..., description="The number of messages in the context window.")
    num_archival_memory: int = Field(..., description="The number of messages in the archival memory.")
    num_recall_memory: int = Field(..., description="The number of messages in the recall memory.")
    num_tokens_external_memory_summary: int = Field(
        ..., description="The number of tokens in the external memory summary (archival + recall metadata)."
    )
    external_memory_summary: str = Field(
        ..., description="The metadata summary of the external memory sources (archival + recall metadata)."
    )

    num_tokens_system: int = Field(..., description="The number of tokens in the system prompt.")
    system_prompt: str = Field(..., description="The content of the system prompt.")

    num_tokens_core_memory: int = Field(..., description="The number of tokens in the core memory.")
    core_memory: str = Field(..., description="The content of the core memory.")

    num_tokens_summary_memory: int = Field(..., description="The number of tokens in the summary memory.")
    summary_memory: Optional[str] = Field(None, description="The content of the summary memory.")

    num_tokens_functions_definitions: int = Field(..., description="The number of tokens in the functions definitions.")
    functions_definitions: Optional[List[OpenAITool]] = Field(..., description="The content of the functions definitions.")

    num_tokens_messages: int = Field(..., description="The number of tokens in the messages list.")
    messages: List[Message] = Field(..., description="The messages in the context window.")


class Memory(BaseModel, validate_assignment=True):
    """

    Represents the in-context memory (i.e. Core memory) of the agent. This includes both the `Block` objects (labelled by sections), as well as tools to edit the blocks.

    """

    agent_type: Optional[Union["AgentType", str]] = Field(None, description="Agent type controlling prompt rendering.")
    blocks: List[Block] = Field(..., description="Memory blocks contained in the agent's in-context memory")
    file_blocks: List[FileBlock] = Field(
        default_factory=list, description="Special blocks representing the agent's in-context memory of an attached file"
    )

    @field_validator("file_blocks")
    @classmethod
    def validate_file_blocks_no_duplicates(cls, v: List[Block]) -> List[Block]:
        """Validate that file_blocks don't contain duplicate labels, log warnings and remove duplicates."""
        if not v:
            return v

        seen_labels = set()
        unique_blocks = []
        duplicate_labels = []

        for block in v:
            if block.label in seen_labels:
                duplicate_labels.append(block.label)
            else:
                seen_labels.add(block.label)
                unique_blocks.append(block)

        if duplicate_labels:
            logger = logging.getLogger(__name__)
            logger.warning(f"Duplicate block labels found in file_blocks: {duplicate_labels}. Removing duplicates.")

        return unique_blocks

    prompt_template: str = Field(default="", description="Deprecated. Ignored for performance.")

    def get_prompt_template(self) -> str:
        """Return the stored (deprecated) prompt template string."""
        return str(self.prompt_template)

    @trace_method
    def set_prompt_template(self, prompt_template: str):
        """Deprecated. Stores the provided string but is not used for rendering."""
        self.prompt_template = prompt_template

    @trace_method
    async def set_prompt_template_async(self, prompt_template: str):
        """Deprecated. Async setter that stores the string but does not validate or use it."""
        self.prompt_template = prompt_template

    @trace_method
    def _render_memory_blocks_standard(self, s: StringIO):
        if len(self.blocks) == 0:
            # s.write("<memory_blocks></memory_blocks>") # TODO: consider empty tags
            s.write("")
            return

        s.write("<memory_blocks>\nThe following memory blocks are currently engaged in your core memory unit:\n\n")
        for idx, block in enumerate(self.blocks):
            label = block.label or "block"
            value = block.value or ""
            desc = block.description or ""
            chars_current = len(value)
            limit = block.limit if block.limit is not None else 0

            s.write(f"<{label}>\n")
            s.write("<description>\n")
            s.write(f"{desc}\n")
            s.write("</description>\n")
            s.write("<metadata>")
            if getattr(block, "read_only", False):
                s.write("\n- read_only=true")
            s.write(f"\n- chars_current={chars_current}")
            s.write(f"\n- chars_limit={limit}\n")
            s.write("</metadata>\n")
            s.write("<value>\n")
            s.write(f"{value}\n")
            s.write("</value>\n")
            s.write(f"</{label}>\n")
            if idx != len(self.blocks) - 1:
                s.write("\n")
        s.write("\n</memory_blocks>")

    def _render_memory_blocks_line_numbered(self, s: StringIO):
        s.write("<memory_blocks>\nThe following memory blocks are currently engaged in your core memory unit:\n\n")
        for idx, block in enumerate(self.blocks):
            label = block.label or "block"
            value = block.value or ""
            desc = block.description or ""
            limit = block.limit if block.limit is not None else 0

            s.write(f"<{label}>\n")
            s.write("<description>\n")
            s.write(f"{desc}\n")
            s.write("</description>\n")
            s.write("<metadata>")
            if getattr(block, "read_only", False):
                s.write("\n- read_only=true")
            s.write(f"\n- chars_current={len(value)}")
            s.write(f"\n- chars_limit={limit}\n")
            s.write("</metadata>\n")
            s.write(f"<warning>\n{CORE_MEMORY_LINE_NUMBER_WARNING}\n</warning>\n")
            s.write("<value>\n")
            if value:
                for i, line in enumerate(value.split("\n"), start=1):
                    s.write(f"{i}→ {line}\n")
            s.write("</value>\n")
            s.write(f"</{label}>\n")
            if idx != len(self.blocks) - 1:
                s.write("\n")
        s.write("\n</memory_blocks>")

    def _render_directories_common(self, s: StringIO, sources, max_files_open):
        s.write("\n\n<directories>\n")
        if max_files_open is not None:
            current_open = sum(1 for b in self.file_blocks if getattr(b, "value", None))
            s.write("<file_limits>\n")
            s.write(f"- current_files_open={current_open}\n")
            s.write(f"- max_files_open={max_files_open}\n")
            s.write("</file_limits>\n")

        for source in sources:
            source_name = getattr(source, "name", "")
            source_desc = getattr(source, "description", None)
            source_instr = getattr(source, "instructions", None)
            source_id = getattr(source, "id", None)

            s.write(f'<directory name="{source_name}">\n')
            if source_desc:
                s.write(f"<description>{source_desc}</description>\n")
            if source_instr:
                s.write(f"<instructions>{source_instr}</instructions>\n")

            if self.file_blocks:
                for fb in self.file_blocks:
                    if source_id is not None and getattr(fb, "source_id", None) == source_id:
                        status = FileStatus.open.value if getattr(fb, "value", None) else FileStatus.closed.value
                        label = fb.label or "file"
                        desc = fb.description or ""
                        chars_current = len(fb.value or "")
                        limit = fb.limit if fb.limit is not None else 0

                        s.write(f'<file status="{status}" name="{label}">\n')
                        if desc:
                            s.write("<description>\n")
                            s.write(f"{desc}\n")
                            s.write("</description>\n")
                        s.write("<metadata>")
                        if getattr(fb, "read_only", False):
                            s.write("\n- read_only=true")
                        s.write(f"\n- chars_current={chars_current}\n")
                        s.write(f"- chars_limit={limit}\n")
                        s.write("</metadata>\n")
                        if getattr(fb, "value", None):
                            s.write("<value>\n")
                            s.write(f"{fb.value}\n")
                            s.write("</value>\n")
                        s.write("</file>\n")

            s.write("</directory>\n")
        s.write("</directories>")

    def _render_directories_react(self, s: StringIO, sources, max_files_open):
        s.write("\n\n<directories>\n")
        if max_files_open is not None:
            current_open = sum(1 for b in self.file_blocks if getattr(b, "value", None))
            s.write("<file_limits>\n")
            s.write(f"- current_files_open={current_open}\n")
            s.write(f"- max_files_open={max_files_open}\n")
            s.write("</file_limits>\n")

        for source in sources:
            source_name = getattr(source, "name", "")
            source_desc = getattr(source, "description", None)
            source_instr = getattr(source, "instructions", None)
            source_id = getattr(source, "id", None)

            s.write(f'<directory name="{source_name}">\n')
            if source_desc:
                s.write(f"<description>{source_desc}</description>\n")
            if source_instr:
                s.write(f"<instructions>{source_instr}</instructions>\n")

            if self.file_blocks:
                for fb in self.file_blocks:
                    if source_id is not None and getattr(fb, "source_id", None) == source_id:
                        status = FileStatus.open.value if getattr(fb, "value", None) else FileStatus.closed.value
                        label = fb.label or "file"
                        desc = fb.description or ""
                        chars_current = len(fb.value or "")
                        limit = fb.limit if fb.limit is not None else 0

                        s.write(f'<file status="{status}">\n')
                        s.write(f"<{label}>\n")
                        s.write("<description>\n")
                        s.write(f"{desc}\n")
                        s.write("</description>\n")
                        s.write("<metadata>")
                        if getattr(fb, "read_only", False):
                            s.write("\n- read_only=true")
                        s.write(f"\n- chars_current={chars_current}\n")
                        s.write(f"- chars_limit={limit}\n")
                        s.write("</metadata>\n")
                        s.write("<value>\n")
                        s.write(f"{fb.value or ''}\n")
                        s.write("</value>\n")
                        s.write(f"</{label}>\n")
                        s.write("</file>\n")

            s.write("</directory>\n")
        s.write("</directories>")

    def compile(self, tool_usage_rules=None, sources=None, max_files_open=None, llm_config=None) -> str:
        """Efficiently render memory, tool rules, and sources into a prompt string."""
        s = StringIO()

        raw_type = self.agent_type.value if hasattr(self.agent_type, "value") else (self.agent_type or "")
        norm_type = raw_type.lower()
        is_react = norm_type in ("react_agent", "workflow_agent")

        # Check if we should use line numbers based on both agent type and model provider
        is_line_numbered = False  # Default to no line numbers
        if llm_config and hasattr(llm_config, "model_endpoint_type"):
            is_anthropic = llm_config.model_endpoint_type == "anthropic"
            is_line_numbered_agent_type = norm_type in ("sleeptime_agent", "memgpt_v2_agent", "letta_v1_agent")
            # Only use line numbers for specific agent types AND Anthropic models
            is_line_numbered = is_line_numbered_agent_type and is_anthropic

        # Memory blocks (not for react/workflow). Always include wrapper for preview/tests.
        if not is_react:
            if is_line_numbered:
                self._render_memory_blocks_line_numbered(s)
            else:
                self._render_memory_blocks_standard(s)

        if tool_usage_rules is not None:
            desc = getattr(tool_usage_rules, "description", None) or ""
            val = getattr(tool_usage_rules, "value", None) or ""
            s.write("\n\n<tool_usage_rules>\n")
            s.write(f"{desc}\n\n")
            s.write(f"{val}\n")
            s.write("</tool_usage_rules>")

        if sources:
            if is_react:
                self._render_directories_react(s, sources, max_files_open)
            else:
                self._render_directories_common(s, sources, max_files_open)

        return s.getvalue()

    @trace_method
    async def compile_async(self, tool_usage_rules=None, sources=None, max_files_open=None, llm_config=None) -> str:
        """Async version that offloads to a thread for CPU-bound string building."""
        return await asyncio.to_thread(
            self.compile,
            tool_usage_rules=tool_usage_rules,
            sources=sources,
            max_files_open=max_files_open,
            llm_config=llm_config,
        )

    @trace_method
    async def compile_in_thread_async(self, tool_usage_rules=None, sources=None, max_files_open=None, llm_config=None) -> str:
        """Deprecated: use compile() instead."""
        import warnings

        logger.warning("compile_in_thread_async is deprecated; use compile()", stacklevel=2)
        return self.compile(tool_usage_rules=tool_usage_rules, sources=sources, max_files_open=max_files_open, llm_config=llm_config)

    def list_block_labels(self) -> List[str]:
        """Return a list of the block names held inside the memory object"""
        return [block.label for block in self.blocks]

    def get_block(self, label: str) -> Block:
        """Correct way to index into the memory.memory field, returns a Block"""
        keys = []
        for block in self.blocks:
            if block.label == label:
                return block
            keys.append(block.label)
        raise KeyError(f"Block field {label} does not exist (available sections = {', '.join(keys)})")

    def get_blocks(self) -> List[Block]:
        """Return a list of the blocks held inside the memory object"""
        return self.blocks

    def set_block(self, block: Block):
        """Set a block in the memory object"""
        for i, b in enumerate(self.blocks):
            if b.label == block.label:
                self.blocks[i] = block
                return
        self.blocks.append(block)

    def update_block_value(self, label: str, value: str):
        """Update the value of a block"""
        if not isinstance(value, str):
            raise ValueError("Provided value must be a string")

        for block in self.blocks:
            if block.label == label:
                block.value = value
                return
        raise ValueError(f"Block with label {label} does not exist")


class BasicBlockMemory(Memory):
    """
    BasicBlockMemory is a basic implemention of the Memory class, which takes in a list of blocks and links them to the memory object. These are editable by the agent via the core memory functions.

    Attributes:
        memory (Dict[str, Block]): Mapping from memory block section to memory block.

    Methods:
        core_memory_append: Append to the contents of core memory.
        core_memory_replace: Replace the contents of core memory.
    """

    def __init__(self, blocks: List[Block] = []):
        """
        Initialize the BasicBlockMemory object with a list of pre-defined blocks.

        Args:
            blocks (List[Block]): List of blocks to be linked to the memory object.
        """
        super().__init__(blocks=blocks)

    def core_memory_append(agent_state: "AgentState", label: str, content: str) -> Optional[str]:  # type: ignore
        """
        Append to the contents of core memory.

        Args:
            label (str): Section of the memory to be edited.
            content (str): Content to write to the memory. All unicode (including emojis) are supported.

        Returns:
            Optional[str]: None is always returned as this function does not produce a response.
        """
        current_value = str(agent_state.memory.get_block(label).value)
        new_value = current_value + "\n" + str(content)
        agent_state.memory.update_block_value(label=label, value=new_value)
        return None

    def core_memory_replace(agent_state: "AgentState", label: str, old_content: str, new_content: str) -> Optional[str]:  # type: ignore
        """
        Replace the contents of core memory. To delete memories, use an empty string for new_content.

        Args:
            label (str): Section of the memory to be edited.
            old_content (str): String to replace. Must be an exact match.
            new_content (str): Content to write to the memory. All unicode (including emojis) are supported.

        Returns:
            Optional[str]: None is always returned as this function does not produce a response.
        """
        current_value = str(agent_state.memory.get_block(label).value)
        if old_content not in current_value:
            raise ValueError(f"Old content '{old_content}' not found in memory block '{label}'")
        new_value = current_value.replace(str(old_content), str(new_content))
        agent_state.memory.update_block_value(label=label, value=new_value)
        return None


class ChatMemory(BasicBlockMemory):
    """
    ChatMemory initializes a BaseChatMemory with two default blocks, `human` and `persona`.
    """

    def __init__(self, persona: str, human: str, limit: int = CORE_MEMORY_BLOCK_CHAR_LIMIT):
        """
        Initialize the ChatMemory object with a persona and human string.

        Args:
            persona (str): The starter value for the persona block.
            human (str): The starter value for the human block.
            limit (int): The character limit for each block.
        """
        super().__init__(blocks=[Block(value=persona, limit=limit, label="persona"), Block(value=human, limit=limit, label="human")])


class UpdateMemory(BaseModel):
    """Update the memory of the agent"""


class ArchivalMemorySummary(BaseModel):
    size: int = Field(..., description="Number of rows in archival memory")


class RecallMemorySummary(BaseModel):
    size: int = Field(..., description="Number of rows in recall memory")


class CreateArchivalMemory(BaseModel):
    text: str = Field(..., description="Text to write to archival memory.")
    tags: Optional[List[str]] = Field(None, description="Optional list of tags to attach to the memory.")
    created_at: Optional[datetime] = Field(None, description="Optional timestamp for the memory (defaults to current UTC time).")


class ArchivalMemorySearchResult(BaseModel):
    timestamp: str = Field(..., description="Timestamp of when the memory was created, formatted in agent's timezone")
    content: str = Field(..., description="Text content of the archival memory passage")
    tags: List[str] = Field(default_factory=list, description="List of tags associated with this memory")


class ArchivalMemorySearchResponse(BaseModel):
    results: List[ArchivalMemorySearchResult] = Field(..., description="List of search results matching the query")
    count: int = Field(..., description="Total number of results returned")
