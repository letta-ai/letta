from enum import Enum


class ToolType(str, Enum):
    CUSTOM = "custom"
    LETTA_CORE = "letta_core"
    LETTA_MEMORY_CORE = "letta_memory_core"


class ToolSourceType(str, Enum):
    """Defines what a tool was derived from"""

    python = "python"
    json = "json"
