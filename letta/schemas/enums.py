from enum import Enum


class ProviderType(str, Enum):
    anthropic = "anthropic"
    anthropic_bedrock = "bedrock"
    google_ai = "google_ai"
    google_vertex = "google_vertex"
    openai = "openai"
    letta = "letta"
    deepseek = "deepseek"
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


class JobStatus(str, Enum):
    """
    Status of the job.
    """

    not_started = "not_started"
    created = "created"
    running = "running"
    completed = "completed"
    failed = "failed"
    pending = "pending"
    cancelled = "cancelled"
    expired = "expired"


class AgentStepStatus(str, Enum):
    """
    Status of the job.
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
