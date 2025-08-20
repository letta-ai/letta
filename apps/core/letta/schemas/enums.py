from enum import Enum, StrEnum


class ProviderType(str, Enum):
    anthropic = "anthropic"
    google_ai = "google_ai"
    google_vertex = "google_vertex"
    openai = "openai"
    letta = "letta"
    deepseek = "deepseek"
    cerebras = "cerebras"
    lmstudio_openai = "lmstudio_openai"
    xai = "xai"
    mistral = "mistral"
    ollama = "ollama"
    groq = "groq"
    together = "together"
    azure = "azure"
    vllm = "vllm"
    bedrock = "bedrock"


class ProviderCategory(str, Enum):
    base = "base"
    byok = "byok"


class MessageRole(str, Enum):
    assistant = "assistant"
    user = "user"
    tool = "tool"
    function = "function"
    system = "system"


class OptionState(str, Enum):
    """Useful for kwargs that are bool + default option"""

    YES = "yes"
    NO = "no"
    DEFAULT = "default"


class JobStatus(StrEnum):
    """
    Status of the job.
    """

    #  TODO (cliandy): removed `not_started`, but what does `pending` or `expired` here mean and where do we use them?
    created = "created"
    running = "running"
    completed = "completed"
    failed = "failed"
    pending = "pending"
    cancelled = "cancelled"
    expired = "expired"

    @property
    def is_terminal(self):
        return self in (JobStatus.completed, JobStatus.failed, JobStatus.cancelled, JobStatus.expired)


class AgentStepStatus(str, Enum):
    """
    Status of agent step.
    TODO (cliandy): consolidate this with job status
    """

    paused = "paused"
    resumed = "resumed"
    completed = "completed"


class MessageStreamStatus(str, Enum):
    done = "[DONE]"

    def model_dump_json(self):
        return "[DONE]"


class ToolRuleType(str, Enum):
    """
    Type of tool rule.
    """

    # note: some of these should be renamed when we do the data migration

    run_first = "run_first"
    exit_loop = "exit_loop"  # reasoning loop should exit
    continue_loop = "continue_loop"
    conditional = "conditional"
    constrain_child_tools = "constrain_child_tools"
    max_count_per_step = "max_count_per_step"
    parent_last_tool = "parent_last_tool"
    required_before_exit = "required_before_exit"  # tool must be called before loop can exit


class FileProcessingStatus(str, Enum):
    PENDING = "pending"
    PARSING = "parsing"
    EMBEDDING = "embedding"
    COMPLETED = "completed"
    ERROR = "error"

    def is_terminal_state(self) -> bool:
        """Check if the processing status is in a terminal state (completed or error)."""
        return self in (FileProcessingStatus.COMPLETED, FileProcessingStatus.ERROR)


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


class JobType(str, Enum):
    JOB = "job"
    RUN = "run"
    BATCH = "batch"


class ToolSourceType(str, Enum):
    """Defines what a tool was derived from"""

    python = "python"
    typescript = "typescript"
    json = "json"  # TODO (cliandy): is this still valid?


class ActorType(str, Enum):
    LETTA_USER = "letta_user"
    LETTA_AGENT = "letta_agent"
    LETTA_SYSTEM = "letta_system"


class MCPServerType(str, Enum):
    SSE = "sse"
    STDIO = "stdio"
    STREAMABLE_HTTP = "streamable_http"


class DuplicateFileHandling(str, Enum):
    """How to handle duplicate filenames when uploading files"""

    SKIP = "skip"  # skip files with duplicate names
    ERROR = "error"  # error when duplicate names are encountered
    SUFFIX = "suffix"  # add numeric suffix to make names unique (default behavior)
    REPLACE = "replace"  # replace the file with the duplicate name


class SandboxType(str, Enum):
    E2B = "e2b"
    MODAL = "modal"
    LOCAL = "local"


class StepStatus(str, Enum):
    """Status of a step execution"""

    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"
