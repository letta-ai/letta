import os
from pathlib import Path
from typing import Optional

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from letta.local_llm.constants import DEFAULT_WRAPPER_NAME


class ToolSettings(BaseSettings):
    composio_api_key: Optional[str] = None

    # E2B Sandbox configurations
    e2b_api_key: Optional[str] = None
    e2b_sandbox_template_id: Optional[str] = None  # Updated manually

    # Tavily search
    tavily_api_key: Optional[str] = None

    # Local Sandbox configurations
    tool_exec_dir: Optional[str] = None
    tool_sandbox_timeout: float = 180
    tool_exec_venv_name: Optional[str] = None
    tool_exec_autoreload_venv: bool = True

    # MCP settings
    mcp_connect_to_server_timeout: float = 30.0
    mcp_list_tools_timeout: float = 30.0
    mcp_execute_tool_timeout: float = 60.0
    mcp_read_from_config: bool = True  # if False, will throw if attempting to read/write from file


class SummarizerSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="letta_summarizer_", extra="ignore")

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

    # deepseek
    deepseek_api_key: Optional[str] = None

    # xAI / Grok
    xai_api_key: Optional[str] = None

    # groq
    groq_api_key: Optional[str] = None

    # Bedrock
    aws_access_key: Optional[str] = None
    aws_secret_access_key: Optional[str] = None
    aws_region: Optional[str] = None
    bedrock_anthropic_version: Optional[str] = "bedrock-2023-05-31"

    # anthropic
    anthropic_api_key: Optional[str] = None
    anthropic_max_retries: int = 3

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

    # google vertex
    google_cloud_project: Optional[str] = None
    google_cloud_location: Optional[str] = None

    # together
    together_api_key: Optional[str] = None

    # vLLM
    vllm_api_base: Optional[str] = None

    # lmstudio
    lmstudio_base_url: Optional[str] = None

    # openllm
    openllm_auth_type: Optional[str] = None
    openllm_api_key: Optional[str] = None

    # disable openapi schema generation
    disable_schema_generation: bool = False


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


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="letta_", extra="ignore")

    letta_dir: Optional[Path] = Field(Path.home() / ".letta", env="LETTA_DIR")
    debug: Optional[bool] = False
    cors_origins: Optional[list] = cors_origins

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
    disable_sqlalchemy_pooling: bool = False

    # multi agent settings
    multi_agent_send_message_max_retries: int = 3
    multi_agent_send_message_timeout: int = 20 * 60
    multi_agent_concurrent_sends: int = 50

    # telemetry logging
    verbose_telemetry_logging: bool = False
    otel_exporter_otlp_endpoint: Optional[str] = None  # otel default: "http://localhost:4317"
    disable_tracing: bool = False
    llm_api_logging: bool = True

    # uvicorn settings
    uvicorn_workers: int = 1
    uvicorn_reload: bool = False
    uvicorn_timeout_keep_alive: int = 5

    # event loop parallelism
    event_loop_threadpool_max_workers: int = 43

    # experimental toggle
    use_experimental: bool = False
    use_vertex_structured_outputs_experimental: bool = False
    use_vertex_async_loop_experimental: bool = False
    experimental_enable_async_db_engine: bool = False
    experimental_skip_rebuild_memory: bool = False

    # LLM provider client settings
    httpx_max_retries: int = 5
    httpx_timeout_connect: float = 10.0
    httpx_timeout_read: float = 60.0
    httpx_timeout_write: float = 30.0
    httpx_timeout_pool: float = 10.0
    httpx_max_connections: int = 500
    httpx_max_keepalive_connections: int = 500
    httpx_keepalive_expiry: float = 120.0

    # cron job parameters
    enable_batch_job_polling: bool = False
    poll_running_llm_batches_interval_seconds: int = 5 * 60
    poll_lock_retry_interval_seconds: int = 5 * 60
    batch_job_polling_lookback_weeks: int = 2
    batch_job_polling_batch_size: Optional[int] = None

    @property
    def letta_pg_uri(self) -> str:
        if self.pg_uri:
            return self.pg_uri
        elif self.pg_db and self.pg_user and self.pg_password and self.pg_host and self.pg_port:
            return f"postgresql+pg8000://{self.pg_user}:{self.pg_password}@{self.pg_host}:{self.pg_port}/{self.pg_db}"
        else:
            return f"postgresql+pg8000://letta:letta@localhost:5432/letta"

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


class TestSettings(Settings):
    model_config = SettingsConfigDict(env_prefix="letta_test_", extra="ignore")

    letta_dir: Optional[Path] = Field(Path.home() / ".letta/test", env="LETTA_TEST_DIR")


# singleton
settings = Settings(_env_parse_none_str="None")
test_settings = TestSettings()
model_settings = ModelSettings()
tool_settings = ToolSettings()
summarizer_settings = SummarizerSettings()
