from enum import Enum


class ToolType(str, Enum):
    CUSTOM = "custom"
    LETTA_CORE = "letta_core"
    LETTA_MEMORY_CORE = "letta_memory_core"
    LETTA_MULTI_AGENT_CORE = "letta_multi_agent_core"
    EXTERNAL_COMPOSIO = "external_composio"
    EXTERNAL_LANGCHAIN = "external_langchain"


class JobType(str, Enum):
    JOB = "job"
    RUN = "run"


class ToolSourceType(str, Enum):
    """Defines what a tool was derived from"""

    python = "python"
    json = "json"
