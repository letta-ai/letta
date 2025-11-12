import os
from enum import Enum
from pathlib import Path
from typing import Optional

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from letta.schemas.enums import SandboxType
from letta.services.summarizer.enums import SummarizationMode

# Define constants here to avoid circular import with letta.log
DEFAULT_WRAPPER_NAME = "chatml"
INNER_THOUGHTS_KWARG = "thinking"


class ToolSettings(BaseSettings):
    # Sandbox Configurations
    e2b_api_key: str | None = Field(default=None, description="API key for using E2B as a tool sandbox")
    e2b_sandbox_template_id: str | None = Field(default=None, description="Template ID for E2B Sandbox. Updated Manually.")

    modal_token_id: str | None = Field(default=None, description="Token id for using Modal as a tool sandbox")
    modal_token_secret: str | None = Field(default=None, description="Token secret for using Modal as a tool sandbox")

    # Search Providers
    tavily_api_key: str | None = Field(default=None, description="API key for using Tavily as a search provider.")
    exa_api_key: str | None = Field(default=None, description="API key for using Exa as a search provider.")

    # Local Sandbox configurations
    tool_exec_dir: Optional[str] = None
    tool_sandbox_timeout: float = 180
    tool_exec_venv_name: Optional[str] = None
    tool_exec_autoreload_venv: bool = True

    # MCP settings
    mcp_connect_to_server_timeout: float = 30.0
    mcp_list_tools_timeout: float = 30.0
    mcp_execute_tool_timeout: float = 60.0
    mcp_read_from_config: bool = False  # if False, will throw if attempting to read/write from file
    mcp_disable_stdio: bool = False

    @property
    def modal_sandbox_enabled(self) -> bool:
        """Check if Modal credentials are configured."""
        return bool(self.modal_token_id and self.modal_token_secret)

    @property
    def sandbox_type(self) -> SandboxType:
        """Default sandbox type based on available credentials.

        Note: Modal is checked separately via modal_sandbox_enabled property.
        This property determines the fallback behavior (E2B or LOCAL).
        """
        if self.e2b_api_key:
            return SandboxType.E2B
        else:
            return SandboxType.LOCAL


class SummarizerSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="letta_summarizer_", extra="ignore")

    # mode: SummarizationMode = SummarizationMode.STATIC_MESSAGE_BUFFER
    mode: SummarizationMode = SummarizationMode.PARTIAL_EVICT_MESSAGE_BUFFER
    message_buffer_limit: int = 60
    message_buffer_min: int = 15
    enable_summarization: bool = True
    max_summarization_retries: int = 3

    # partial evict summarizer percentage
    # eviction based on percentage of message count, not token count
    partial_evict_summarizer_percentage: float = 0.30

    # TODO(cliandy): the below settings are tied to old summarization and should be deprecated or moved
    # Controls if we should evict all messages
    # TODO: Can refactor this into an enum if we have a bunch of different kinds of summarizers
    evict_all_messages: bool = False

    # The maximum number of retries for the summarizer
    # If we reach this cutoff, it probably means that the summarizer is not compressing down the in-context messages any further
    # And we throw a fatal error
    max_summarizer_retries: int = 3

    # When to warn the model that a summarize command will happen soon
    # The amount of tokens before a system warning about upcoming truncation is sent to Letta
    memory_warning_threshold: float = 0.75

    # Whether to send the system memory warning message
    send_memory_warning_message: bool = False

    # The desired memory pressure to summarize down to
    desired_memory_token_pressure: float = 0.3

    # The number of messages at the end to keep
    # Even when summarizing, we may want to keep a handful of recent messages
    # These serve as in-context examples of how to use functions / what user messages look like
    keep_last_n_messages: int = 0


class ModelSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    global_max_context_window_limit: int = 32000

    inner_thoughts_kwarg: str | None = Field(default=INNER_THOUGHTS_KWARG, description="Key used for passing in inner thoughts.")

    # env_prefix='my_prefix_'

    # when we use /completions APIs (instead of /chat/completions), we need to specify a model wrapper
    # the "model wrapper" is responsible for prompt formatting and function calling parsing
    default_prompt_formatter: str = DEFAULT_WRAPPER_NAME

    # openai
    openai_api_key: Optional[str] = None
    openai_api_base: str = Field(
        default="https://api.openai.com/v1",
        # NOTE: We previously used OPENAI_API_BASE, but this was deprecated in favor of OPENAI_BASE_URL
        # preferred first, fallback second
        # env=["OPENAI_BASE_URL", "OPENAI_API_BASE"],  # pydantic-settings v2
        validation_alias=AliasChoices("OPENAI_BASE_URL", "OPENAI_API_BASE"),  # pydantic-settings v1
    )

    # openrouter
    openrouter_api_key: Optional[str] = None
    # Optional additional headers recommended by OpenRouter
    # See https://openrouter.ai/docs/quick-start for details
    openrouter_referer: Optional[str] = None  # e.g., your site URL
    openrouter_title: Optional[str] = None  # e.g., your app name
    openrouter_handle_base: Optional[str] = None

    # deepseek
    deepseek_api_key: Optional[str] = None

    # xAI / Grok
    xai_api_key: Optional[str] = None

    # groq
    groq_api_key: Optional[str] = None

    # Bedrock
    aws_access_key_id: Optional[str] = None
    aws_secret_access_key: Optional[str] = None
    aws_default_region: Optional[str] = None
    bedrock_anthropic_version: Optional[str] = "bedrock-2023-05-31"

    # anthropic
    anthropic_api_key: Optional[str] = None
    anthropic_max_retries: int = 3
    anthropic_sonnet_1m: bool = Field(
        default=False,
        description=(
            "Enable 1M-token context window for Claude Sonnet 4/4.5. When true, adds the"
            " 'context-1m-2025-08-07' beta to Anthropic requests and sets model context_window"
            " to 1,000,000 instead of 200,000. Note: This feature is in beta and not available"
            " to all orgs; once GA, this flag can be removed and behavior can default to on."
        ),
        alias="ANTHROPIC_SONNET_1M",
    )

    # ollama
    ollama_base_url: Optional[str] = None

    # azure
    azure_api_key: Optional[str] = None
    azure_base_url: Optional[str] = None
    # We provide a default here, since usually people will want to be on the latest API version.
    azure_api_version: Optional[str] = (
        "2024-09-01-preview"  # https://learn.microsoft.com/en-us/azure/ai-services/openai/api-version-deprecation
    )

    # google ai
    gemini_api_key: Optional[str] = None
    gemini_base_url: str = "https://generativelanguage.googleapis.com/"
    gemini_force_minimum_thinking_budget: bool = False
    gemini_max_retries: int = 5

    # google vertex
    google_cloud_project: Optional[str] = None
    google_cloud_location: Optional[str] = None

    # together
    together_api_key: Optional[str] = None

    # vLLM
    vllm_api_base: Optional[str] = None
    vllm_handle_base: Optional[str] = None

    # lmstudio
    lmstudio_base_url: Optional[str] = None

    # openllm
    openllm_auth_type: Optional[str] = None
    openllm_api_key: Optional[str] = None


env_cors_origins = os.getenv("ACCEPTABLE_ORIGINS")

cors_origins = [
    "http://letta.localhost",
    "http://localhost:8283",
    "http://localhost:8083",
    "http://localhost:3000",
    "http://localhost:4200",
]

# attach the env_cors_origins to the cors_origins if it exists
if env_cors_origins:
    cors_origins.extend(env_cors_origins.split(","))

# read pg_uri from ~/.letta/pg_uri or set to none, this is to support Letta Desktop
default_pg_uri = None

## check if --use-file-pg-uri is passed
import sys

if "--use-file-pg-uri" in sys.argv:
    try:
        with open(Path.home() / ".letta/pg_uri", "r") as f:
            default_pg_uri = f.read()
            print(f"Read pg_uri from ~/.letta/pg_uri: {default_pg_uri}")
    except FileNotFoundError:
        pass


class DatabaseChoice(str, Enum):
    POSTGRES = "postgres"
    SQLITE = "sqlite"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="letta_", extra="ignore")

    letta_dir: Optional[Path] = Field(Path.home() / ".letta", alias="LETTA_DIR")
    debug: Optional[bool] = False
    cors_origins: Optional[list] = cors_origins
    environment: Optional[str] = Field(default=None, description="Application environment (PRODUCTION, DEV, etc.)")

    # SSE Streaming keepalive settings
    enable_keepalive: bool = Field(True, description="Enable keepalive messages in SSE streams to prevent timeouts")
    keepalive_interval: float = Field(50.0, description="Seconds between keepalive messages (default: 50)")

    # SSE Streaming cancellation settings
    enable_cancellation_aware_streaming: bool = Field(True, description="Enable cancellation aware streaming")

    # default handles
    default_llm_handle: Optional[str] = None
    default_embedding_handle: Optional[str] = None

    # database configuration
    pg_db: Optional[str] = None
    pg_user: Optional[str] = None
    pg_password: Optional[str] = None
    pg_host: Optional[str] = None
    pg_port: Optional[int] = None
    pg_uri: Optional[str] = default_pg_uri  # option to specify full uri
    pg_pool_size: int = 25  # Concurrent connections
    pg_max_overflow: int = 10  # Overflow limit
    pg_pool_timeout: int = 30  # Seconds to wait for a connection
    pg_pool_recycle: int = 1800  # When to recycle connections
    pg_echo: bool = False  # Logging
    pool_pre_ping: bool = True  # Pre ping to check for dead connections
    pool_use_lifo: bool = True
    disable_sqlalchemy_pooling: bool = True
    db_max_concurrent_sessions: Optional[int] = None

    redis_host: Optional[str] = Field(default=None, description="Host for Redis instance")
    redis_port: Optional[int] = Field(default=6379, description="Port for Redis instance")

    plugin_register: Optional[str] = None

    # multi agent settings
    multi_agent_send_message_max_retries: int = 3
    multi_agent_send_message_timeout: int = 20 * 60
    multi_agent_concurrent_sends: int = 50

    # telemetry logging
    otel_exporter_otlp_endpoint: str | None = None  # otel default: "http://localhost:4317"
    otel_preferred_temporality: int | None = Field(
        default=1, ge=0, le=2, description="Exported metric temporality. {0: UNSPECIFIED, 1: DELTA, 2: CUMULATIVE}"
    )
    disable_tracing: bool = Field(default=False, description="Disable OTEL Tracing")
    llm_api_logging: bool = Field(default=True, description="Enable LLM API logging at each step")
    track_last_agent_run: bool = Field(default=False, description="Update last agent run metrics")
    track_errored_messages: bool = Field(default=True, description="Enable tracking for errored messages")
    track_stop_reason: bool = Field(default=True, description="Enable tracking stop reason on steps.")
    track_agent_run: bool = Field(default=True, description="Enable tracking agent run with cancellation support")
    track_provider_trace: bool = Field(default=True, description="Enable tracking raw llm request and response at each step")

    # FastAPI Application Settings
    uvicorn_workers: int = 1
    uvicorn_reload: bool = False
    uvicorn_timeout_keep_alive: int = 5

    use_uvloop: bool = Field(default=False, description="Enable uvloop as asyncio event loop.")
    use_granian: bool = Field(default=False, description="Use Granian for workers")
    sqlalchemy_tracing: bool = False

    # event loop parallelism
    event_loop_threadpool_max_workers: int = 43

    # experimental toggle
    use_vertex_structured_outputs_experimental: bool = False
    use_asyncio_shield: bool = True
    # Gate using Temporal (Lettuce) for file uploads via folders endpoint
    use_lettuce_for_file_uploads: bool = False

    # Database pool monitoring
    enable_db_pool_monitoring: bool = True  # Enable connection pool monitoring
    db_pool_monitoring_interval: int = 30  # Seconds between pool stats collection

    # cron job parameters
    enable_batch_job_polling: bool = False
    poll_running_llm_batches_interval_seconds: int = 5 * 60
    poll_lock_retry_interval_seconds: int = 8 * 60
    batch_job_polling_lookback_weeks: int = 2
    batch_job_polling_batch_size: Optional[int] = None

    # for OCR
    mistral_api_key: Optional[str] = None

    # LLM request timeout settings (model + embedding model)
    llm_request_timeout_seconds: float = Field(default=60.0, ge=10.0, le=1800.0, description="Timeout for LLM requests in seconds")
    llm_stream_timeout_seconds: float = Field(default=60.0, ge=10.0, le=1800.0, description="Timeout for LLM streaming requests in seconds")

    # For embeddings
    enable_pinecone: bool = False
    pinecone_api_key: Optional[str] = None
    pinecone_source_index: Optional[str] = "sources"
    pinecone_agent_index: Optional[str] = "recall"
    upsert_pinecone_indices: bool = False

    # For tpuf - currently only for archival memories
    use_tpuf: bool = False
    tpuf_api_key: Optional[str] = None
    tpuf_region: str = "gcp-us-central1"
    embed_all_messages: bool = False

    # For encryption
    encryption_key: Optional[str] = None

    # File processing timeout settings
    file_processing_timeout_minutes: int = 30
    file_processing_timeout_error_message: str = "File processing timed out after {} minutes. Please try again."

    # Letta client settings for tool execution
    default_base_url: str = Field(default="http://localhost:8283", description="Default base URL for Letta client in tool execution")
    default_token: Optional[str] = Field(default=None, description="Default token for Letta client in tool execution")

    # enabling letta_agent_v1 architecture
    use_letta_v1_agent: bool = False

    # Archival memory token limit
    archival_memory_token_limit: int = 8192

    @property
    def letta_pg_uri(self) -> str:
        if self.pg_uri:
            return self.pg_uri
        elif self.pg_db and self.pg_user and self.pg_password and self.pg_host and self.pg_port:
            return f"postgresql+pg8000://{self.pg_user}:{self.pg_password}@{self.pg_host}:{self.pg_port}/{self.pg_db}"
        else:
            return "postgresql+pg8000://letta:letta@localhost:5432/letta"

    # add this property to avoid being returned the default
    # reference: https://github.com/letta-ai/letta/issues/1362
    @property
    def letta_pg_uri_no_default(self) -> str:
        if self.pg_uri:
            return self.pg_uri
        elif self.pg_db and self.pg_user and self.pg_password and self.pg_host and self.pg_port:
            return f"postgresql+pg8000://{self.pg_user}:{self.pg_password}@{self.pg_host}:{self.pg_port}/{self.pg_db}"
        else:
            return None

    @property
    def database_engine(self) -> DatabaseChoice:
        return DatabaseChoice.POSTGRES if self.letta_pg_uri_no_default else DatabaseChoice.SQLITE

    @property
    def plugin_register_dict(self) -> dict:
        plugins = {}
        if self.plugin_register:
            for plugin in self.plugin_register.split(";"):
                name, target = plugin.split("=")
                plugins[name] = {"target": target}
        return plugins


class TestSettings(Settings):
    model_config = SettingsConfigDict(env_prefix="letta_test_", extra="ignore")

    letta_dir: Path | None = Field(Path.home() / ".letta/test", alias="LETTA_TEST_DIR")


class LogSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="letta_logging_", extra="ignore")
    debug: bool = Field(default=False, description="Enable debugging for logging")
    json_logging: bool = Field(
        default=False,
        description="Enable structured JSON logging (recommended).",
    )
    log_level: str | None = Field("WARNING", description="Logging level")
    letta_log_path: Path | None = Field(Path.home() / ".letta" / "logs" / "Letta.log")
    verbose_telemetry_logging: bool = Field(default=False)


class TelemetrySettings(BaseSettings):
    """Configuration for telemetry and observability integrations."""

    model_config = SettingsConfigDict(env_prefix="letta_telemetry_", extra="ignore")

    # Google Cloud Profiler
    profiler: bool = Field(default=False, description="Enable Google Cloud Profiler.")

    # Datadog APM and Profiling
    enable_datadog: bool = Field(default=False, description="Enable Datadog profiling. Environment is pulled from settings.environment.")
    datadog_agent_host: str = Field(
        default="localhost",
        description="Datadog agent hostname or IP address. Use service name for Kubernetes (e.g., 'datadog-cluster-agent').",
    )
    datadog_agent_port: int = Field(default=8126, ge=1, le=65535, description="Datadog trace agent port (typically 8126 for traces).")
    datadog_service_name: str = Field(default="letta-server", description="Service name for Datadog profiling.")
    datadog_profiling_memory_enabled: bool = Field(default=False, description="Enable memory profiling in Datadog.")
    datadog_profiling_heap_enabled: bool = Field(default=False, description="Enable heap profiling in Datadog.")

    # Datadog Source Code Integration (optional, tightly coupled with profiling)
    # These settings link profiling data and traces to specific Git commits,
    # enabling code navigation directly from Datadog UI to GitHub/GitLab.
    datadog_git_repository_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices("DD_GIT_REPOSITORY_URL", "datadog_git_repository_url"),
        description="Git repository URL (e.g., 'https://github.com/org/repo'). Set at build time.",
    )
    datadog_git_commit_sha: str | None = Field(
        default=None,
        validation_alias=AliasChoices("DD_GIT_COMMIT_SHA", "datadog_git_commit_sha"),
        description="Git commit SHA for the deployed code. Set at build time with 'git rev-parse HEAD'.",
    )
    datadog_main_package: str = Field(
        default="letta",
        validation_alias=AliasChoices("DD_MAIN_PACKAGE", "datadog_main_package"),
        description="Primary Python package name for source code linking. Datadog uses this setting to determine which code is 'yours' vs. third-party dependencies.",
    )


# singleton
settings = Settings(_env_parse_none_str="None")
test_settings = TestSettings()
model_settings = ModelSettings()
tool_settings = ToolSettings()
summarizer_settings = SummarizerSettings()
log_settings = LogSettings()
telemetry_settings = TelemetrySettings()
