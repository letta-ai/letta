from enum import Enum


class ToolType(str, Enum):
    CUSTOM = "custom"
    LETTA_CORE = "letta_core"
    LETTA_MEMORY_CORE = "letta_memory_core"
    LETTA_MULTI_AGENT_CORE = "letta_multi_agent_core"
    LETTA_SLEEPTIME_CORE = "letta_sleeptime_core"
    LETTA_VOICE_SLEEPTIME_CORE = "letta_voice_sleeptime_core"
    LETTA_BUILTIN = "letta_builtin"
    EXTERNAL_COMPOSIO = "external_composio"
    EXTERNAL_LANGCHAIN = "external_langchain"
    # TODO is "external" the right name here? Since as of now, MCP is local / doesn't support remote?
    EXTERNAL_MCP = "external_mcp"


class JobType(str, Enum):
    JOB = "job"
    RUN = "run"
    BATCH = "batch"


class ToolSourceType(str, Enum):
    """Defines what a tool was derived from"""

    python = "python"
    json = "json"


class ActorType(str, Enum):
    LETTA_USER = "letta_user"
    LETTA_AGENT = "letta_agent"
    LETTA_SYSTEM = "letta_system"
