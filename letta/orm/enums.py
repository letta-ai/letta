"""Compatibility module for enums that were moved to address circular imports.

This module maintains the old enum definitions for backwards compatibility,
especially for pickled objects that reference the old import paths.
"""

from enum import Enum


class ToolType(str, Enum):
    CUSTOM = "custom"
    LETTA_CORE = "letta_core"
    LETTA_MEMORY_CORE = "letta_memory_core"
    LETTA_MULTI_AGENT_CORE = "letta_multi_agent_core"
    LETTA_SLEEPTIME_CORE = "letta_sleeptime_core"
    LETTA_VOICE_SLEEPTIME_CORE = "letta_voice_sleeptime_core"
    LETTA_BUILTIN = "letta_builtin"
    LETTA_FILES_CORE = "letta_files_core"
    EXTERNAL_COMPOSIO = "external_composio"
    EXTERNAL_LANGCHAIN = "external_langchain"
    # TODO is "external" the right name here? Since as of now, MCP is local / doesn't support remote?
    EXTERNAL_MCP = "external_mcp"
