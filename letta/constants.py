import os
import re
from logging import CRITICAL, DEBUG, ERROR, INFO, NOTSET, WARN, WARNING

LETTA_DIR = os.path.join(os.path.expanduser("~"), ".letta")
LETTA_TOOL_EXECUTION_DIR = os.path.join(LETTA_DIR, "tool_execution_dir")

LETTA_MODEL_ENDPOINT = "https://inference.letta.com/v1/"
DEFAULT_TIMEZONE = "UTC"

ADMIN_PREFIX = "/v1/admin"
API_PREFIX = "/v1"
OLLAMA_API_PREFIX = "/v1"
OPENAI_API_PREFIX = "/openai"

MCP_CONFIG_NAME = "mcp_config.json"
MCP_TOOL_TAG_NAME_PREFIX = "mcp"  # full format, mcp:server_name

LETTA_CORE_TOOL_MODULE_NAME = "letta.functions.function_sets.base"
LETTA_MULTI_AGENT_TOOL_MODULE_NAME = "letta.functions.function_sets.multi_agent"
LETTA_VOICE_TOOL_MODULE_NAME = "letta.functions.function_sets.voice"
LETTA_BUILTIN_TOOL_MODULE_NAME = "letta.functions.function_sets.builtin"
LETTA_FILES_TOOL_MODULE_NAME = "letta.functions.function_sets.files"

LETTA_TOOL_MODULE_NAMES = [
    LETTA_CORE_TOOL_MODULE_NAME,
    LETTA_MULTI_AGENT_TOOL_MODULE_NAME,
    LETTA_VOICE_TOOL_MODULE_NAME,
    LETTA_BUILTIN_TOOL_MODULE_NAME,
    LETTA_FILES_TOOL_MODULE_NAME,
]

DEFAULT_ORG_ID = "org-00000000-0000-4000-8000-000000000000"
DEFAULT_ORG_NAME = "default_org"

# String in the error message for when the context window is too large
# Example full message:
# This model's maximum context length is 8192 tokens. However, your messages resulted in 8198 tokens (7450 in the messages, 748 in the functions). Please reduce the length of the messages or functions.
OPENAI_CONTEXT_WINDOW_ERROR_SUBSTRING = "maximum context length"

# System prompt templating
IN_CONTEXT_MEMORY_KEYWORD = "CORE_MEMORY"

# OpenAI error message: Invalid 'messages[1].tool_calls[0].id': string too long. Expected a string with maximum length 29, but got a string with length 36 instead.
TOOL_CALL_ID_MAX_LEN = 29

# Maximum length for tool names to support Modal deployment
# Modal function names are limited to 64 characters: tool_name + "_" + project_id
# Reserving 16 characters for project_id suffix (e.g., "_project-12345678")
MAX_TOOL_NAME_LENGTH = 48

# Max steps for agent loop
DEFAULT_MAX_STEPS = 50

# context window size
MIN_CONTEXT_WINDOW = 4096
DEFAULT_CONTEXT_WINDOW = 32000

# Summarization trigger threshold (multiplier of context_window limit)
# Summarization triggers when step usage > context_window * SUMMARIZATION_TRIGGER_MULTIPLIER
# Set to 0.9 (90%) to provide buffer before hitting hard limit
SUMMARIZATION_TRIGGER_MULTIPLIER = 0.9

# number of concurrent embedding requests to sent
EMBEDDING_BATCH_SIZE = 200

# Voice Sleeptime message buffer lengths
DEFAULT_MAX_MESSAGE_BUFFER_LENGTH = 30
DEFAULT_MIN_MESSAGE_BUFFER_LENGTH = 15

# embeddings
MAX_EMBEDDING_DIM = 4096  # maximum supported embeding size - do NOT change or else DBs will need to be reset
DEFAULT_EMBEDDING_CHUNK_SIZE = 300
DEFAULT_EMBEDDING_DIM = 1024

# tokenizers
EMBEDDING_TO_TOKENIZER_MAP = {
    "text-embedding-3-small": "cl100k_base",
}
EMBEDDING_TO_TOKENIZER_DEFAULT = "cl100k_base"


DEFAULT_LETTA_MODEL = "gpt-4"  # TODO: fixme
DEFAULT_PERSONA = "sam_pov"
DEFAULT_HUMAN = "basic"
DEFAULT_PRESET = "memgpt_chat"

DEFAULT_PERSONA_BLOCK_DESCRIPTION = "The persona block: Stores details about your current persona, guiding how you behave and respond. This helps you to maintain consistency and personality in your interactions."
DEFAULT_HUMAN_BLOCK_DESCRIPTION = "The human block: Stores key details about the person you are conversing with, allowing for more personalized and friend-like conversation."

SEND_MESSAGE_TOOL_NAME = "send_message"
# Base tools that cannot be edited, as they access agent state directly
# Note that we don't include "conversation_search_date" for now
BASE_TOOLS = [SEND_MESSAGE_TOOL_NAME, "conversation_search", "archival_memory_insert", "archival_memory_search"]
DEPRECATED_LETTA_TOOLS = ["archival_memory_insert", "archival_memory_search"]
# Base memory tools CAN be edited, and are added by default by the server
BASE_MEMORY_TOOLS = ["core_memory_append", "core_memory_replace", "memory"]
# New v2 collection of the base memory tools (effecitvely same as sleeptime set), to pair with memgpt_v2 prompt
BASE_MEMORY_TOOLS_V2 = [
    "memory_replace",
    "memory_insert",
    # NOTE: leaving these ones out to simply the set? Can have these reserved for sleep-time
    # "memory_rethink",
    # "memory_finish_edits",
]

# v3 collection, currently just a omni memory tool for anthropic
BASE_MEMORY_TOOLS_V3 = [
    "memory",
]
# Base tools if the memgpt agent has enable_sleeptime on
BASE_SLEEPTIME_CHAT_TOOLS = [SEND_MESSAGE_TOOL_NAME, "conversation_search", "archival_memory_search"]
# Base memory tools for sleeptime agent
BASE_SLEEPTIME_TOOLS = [
    "memory_replace",
    "memory_insert",
    "memory_rethink",
    "memory_finish_edits",
    # "archival_memory_insert",
    # "archival_memory_search",
    # "conversation_search",
]
# Base tools for the voice agent
BASE_VOICE_SLEEPTIME_CHAT_TOOLS = [SEND_MESSAGE_TOOL_NAME, "search_memory"]
# Base memory tools for sleeptime agent
BASE_VOICE_SLEEPTIME_TOOLS = [
    "store_memories",
    "rethink_user_memory",
    "finish_rethinking_memory",
]

# Multi agent tools
MULTI_AGENT_TOOLS = ["send_message_to_agent_and_wait_for_reply", "send_message_to_agents_matching_tags", "send_message_to_agent_async"]
LOCAL_ONLY_MULTI_AGENT_TOOLS = ["send_message_to_agent_async"]

# Used to catch if line numbers are pushed in
# MEMORY_TOOLS_LINE_NUMBER_PREFIX_REGEX = re.compile(r"^Line \d+: ", re.MULTILINE)
# Updated to match new arrow format: "1→ content"
# shared constant for both memory_insert and memory_replace
MEMORY_TOOLS_LINE_NUMBER_PREFIX_REGEX = re.compile(
    r"^[ \t]*\d+→[ \t]*",  # match number followed by arrow, with optional whitespace
    re.MULTILINE,
)

# Built in tools
BUILTIN_TOOLS = ["run_code", "web_search", "fetch_webpage"]

# Built in tools
FILES_TOOLS = ["open_files", "grep_files", "semantic_search_files"]

FILE_MEMORY_EXISTS_MESSAGE = "The following files are currently accessible in memory:"
FILE_MEMORY_EMPTY_MESSAGE = (
    "There are no files currently available in memory. Files will appear here once they are uploaded directly to your system."
)

# Set of all built-in Letta tools
LETTA_TOOL_SET = set(
    BASE_TOOLS
    + BASE_MEMORY_TOOLS
    + MULTI_AGENT_TOOLS
    + BASE_SLEEPTIME_TOOLS
    + BASE_VOICE_SLEEPTIME_TOOLS
    + BASE_VOICE_SLEEPTIME_CHAT_TOOLS
    + BUILTIN_TOOLS
    + FILES_TOOLS
)

LETTA_PARALLEL_SAFE_TOOLS = {
    "conversation_search",
    "archival_memory_search",
    "run_code",
    "web_search",
    "fetch_webpage",
    "grep_files",
    "semantic_search_files",
}


def FUNCTION_RETURN_VALUE_TRUNCATED(return_str, return_char: int, return_char_limit: int):
    return (
        f"{return_str}... [NOTE: function output was truncated since it exceeded the character limit: {return_char} > {return_char_limit}]"
    )


# The name of the tool used to send message to the user
# May not be relevant in cases where the agent has multiple ways to message to user (send_imessage, send_discord_mesasge, ...)
# or in cases where the agent has no concept of messaging a user (e.g. a workflow agent)
DEFAULT_MESSAGE_TOOL = SEND_MESSAGE_TOOL_NAME
DEFAULT_MESSAGE_TOOL_KWARG = "message"

# The name of the conversation search tool - messages with this tool should not be indexed
CONVERSATION_SEARCH_TOOL_NAME = "conversation_search"

PRE_EXECUTION_MESSAGE_ARG = "pre_exec_msg"

REQUEST_HEARTBEAT_PARAM = "request_heartbeat"
REQUEST_HEARTBEAT_DESCRIPTION = "Request an immediate heartbeat after function execution. You MUST set this value to `True` if you want to send a follow-up message or run a follow-up tool call (chain multiple tools together). If set to `False` (the default), then the chain of execution will end immediately after this function call."


# Structured output models
STRUCTURED_OUTPUT_MODELS = {"gpt-4o", "gpt-4o-mini"}

# LOGGER_LOG_LEVEL is use to convert Text to Logging level value for logging mostly for Cli input to setting level
LOGGER_LOG_LEVELS = {"CRITICAL": CRITICAL, "ERROR": ERROR, "WARN": WARN, "WARNING": WARNING, "INFO": INFO, "DEBUG": DEBUG, "NOTSET": NOTSET}

FIRST_MESSAGE_ATTEMPTS = 10

INITIAL_BOOT_MESSAGE = "Boot sequence complete. Persona activated."
INITIAL_BOOT_MESSAGE_SEND_MESSAGE_THOUGHT = "Bootup sequence complete. Persona activated. Testing messaging functionality."
STARTUP_QUOTES = [
    "I think, therefore I am.",
    "All those moments will be lost in time, like tears in rain.",
    "More human than human is our motto.",
]
INITIAL_BOOT_MESSAGE_SEND_MESSAGE_FIRST_MSG = STARTUP_QUOTES[2]

CLI_WARNING_PREFIX = "Warning: "

ERROR_MESSAGE_PREFIX = "Error"

NON_USER_MSG_PREFIX = "[This is an automated system message hidden from the user] "

CORE_MEMORY_LINE_NUMBER_WARNING = "# NOTE: Line numbers shown below (with arrows like '1→') are to help during editing. Do NOT include line number prefixes in your memory edit tool calls."


# Constants to do with summarization / conversation length window
# The max amount of tokens supported by the underlying model (eg 8k for gpt-4 and Mistral 7B)
LLM_MAX_TOKENS = {
    "DEFAULT": 30000,
    # deepseek
    "deepseek-chat": 64000,
    "deepseek-reasoner": 64000,
    ## OpenAI models: https://platform.openai.com/docs/models/overview
    # gpt-5
    "gpt-5": 272000,
    "gpt-5-2025-08-07": 272000,
    "gpt-5-mini": 272000,
    "gpt-5-mini-2025-08-07": 272000,
    "gpt-5-nano": 272000,
    "gpt-5-nano-2025-08-07": 272000,
    "gpt-5-codex": 272000,
    # reasoners
    "o1": 200000,
    # "o1-pro": 200000,  # responses API only
    "o1-2024-12-17": 200000,
    "o3": 200000,
    "o3-2025-04-16": 200000,
    "o3-mini": 200000,
    "o3-mini-2025-01-31": 200000,
    # "o3-pro": 200000,  # responses API only
    # "o3-pro-2025-06-10": 200000,
    "gpt-4.1": 1047576,
    "gpt-4.1-2025-04-14": 1047576,
    "gpt-4.1-mini": 1047576,
    "gpt-4.1-mini-2025-04-14": 1047576,
    "gpt-4.1-nano": 1047576,
    "gpt-4.1-nano-2025-04-14": 1047576,
    # gpt-4.5-preview
    "gpt-4.5-preview": 128000,
    "gpt-4.5-preview-2025-02-27": 128000,
    # "o1-preview
    "chatgpt-4o-latest": 128000,
    # "o1-preview-2024-09-12
    "gpt-4o-2024-08-06": 128000,
    "gpt-4o-2024-11-20": 128000,
    "gpt-4-turbo-preview": 128000,
    "gpt-4o": 128000,
    "gpt-3.5-turbo-instruct": 16385,
    "gpt-4-0125-preview": 128000,
    "gpt-3.5-turbo-0125": 16385,
    # "babbage-002": 128000,
    # "davinci-002": 128000,
    "gpt-4-turbo-2024-04-09": 128000,
    # "gpt-4o-realtime-preview-2024-10-01
    "gpt-4-turbo": 128000,
    "gpt-4o-2024-05-13": 128000,
    # "o1-mini
    # "o1-mini-2024-09-12
    # "gpt-3.5-turbo-instruct-0914
    "gpt-4o-mini": 128000,
    # "gpt-4o-realtime-preview
    "gpt-4o-mini-2024-07-18": 128000,
    # gpt-4
    "gpt-4-1106-preview": 128000,
    "gpt-4": 8192,
    "gpt-4-32k": 32768,
    "gpt-4-0613": 8192,
    "gpt-4-32k-0613": 32768,
    "gpt-4-0314": 8192,  # legacy
    "gpt-4-32k-0314": 32768,  # legacy
    # gpt-3.5
    "gpt-3.5-turbo-1106": 16385,
    "gpt-3.5-turbo": 4096,
    "gpt-3.5-turbo-16k": 16385,
    "gpt-3.5-turbo-0613": 4096,  # legacy
    "gpt-3.5-turbo-16k-0613": 16385,  # legacy
    "gpt-3.5-turbo-0301": 4096,  # legacy
    "gemini-1.0-pro-vision-latest": 12288,
    "gemini-pro-vision": 12288,
    "gemini-1.5-pro-latest": 2000000,
    "gemini-1.5-pro-001": 2000000,
    "gemini-1.5-pro-002": 2000000,
    "gemini-1.5-pro": 2000000,
    "gemini-1.5-flash-latest": 1000000,
    "gemini-1.5-flash-001": 1000000,
    "gemini-1.5-flash-001-tuning": 16384,
    "gemini-1.5-flash": 1000000,
    "gemini-1.5-flash-002": 1000000,
    "gemini-1.5-flash-8b": 1000000,
    "gemini-1.5-flash-8b-001": 1000000,
    "gemini-1.5-flash-8b-latest": 1000000,
    "gemini-1.5-flash-8b-exp-0827": 1000000,
    "gemini-1.5-flash-8b-exp-0924": 1000000,
    "gemini-2.5-pro-exp-03-25": 1048576,
    "gemini-2.5-pro-preview-03-25": 1048576,
    "gemini-2.5-flash-preview-04-17": 1048576,
    "gemini-2.5-flash-preview-05-20": 1048576,
    "gemini-2.5-flash-preview-04-17-thinking": 1048576,
    "gemini-2.5-pro-preview-05-06": 1048576,
    "gemini-2.0-flash-exp": 1048576,
    "gemini-2.0-flash": 1048576,
    "gemini-2.0-flash-001": 1048576,
    "gemini-2.0-flash-exp-image-generation": 1048576,
    "gemini-2.0-flash-lite-001": 1048576,
    "gemini-2.0-flash-lite": 1048576,
    "gemini-2.0-flash-preview-image-generation": 32768,
    "gemini-2.0-flash-lite-preview-02-05": 1048576,
    "gemini-2.0-flash-lite-preview": 1048576,
    "gemini-2.0-pro-exp": 1048576,
    "gemini-2.0-pro-exp-02-05": 1048576,
    "gemini-exp-1206": 1048576,
    "gemini-2.0-flash-thinking-exp-01-21": 1048576,
    "gemini-2.0-flash-thinking-exp": 1048576,
    "gemini-2.0-flash-thinking-exp-1219": 1048576,
    "gemini-2.5-flash-preview-tts": 32768,
    "gemini-2.5-pro-preview-tts": 65536,
    # gemini 2.5 stable releases
    "gemini-2.5-flash": 1048576,
    "gemini-2.5-flash-lite": 1048576,
    "gemini-2.5-pro": 1048576,
    "gemini-2.5-pro-preview-06-05": 1048576,
    "gemini-2.5-flash-lite-preview-06-17": 1048576,
    "gemini-2.5-flash-image": 1048576,
    "gemini-2.5-flash-image-preview": 1048576,
    "gemini-2.5-flash-preview-09-2025": 1048576,
    "gemini-2.5-flash-lite-preview-09-2025": 1048576,
    "gemini-2.5-computer-use-preview-10-2025": 1048576,
    # gemini latest aliases
    "gemini-flash-latest": 1048576,
    "gemini-flash-lite-latest": 1048576,
    "gemini-pro-latest": 1048576,
    # gemini specialized models
    "gemini-robotics-er-1.5-preview": 1048576,
}
# The error message that Letta will receive
# MESSAGE_SUMMARY_WARNING_STR = f"Warning: the conversation history will soon reach its maximum length and be trimmed. Make sure to save any important information from the conversation to your memory before it is removed."
# Much longer and more specific variant of the prompt
MESSAGE_SUMMARY_WARNING_STR = " ".join(
    [
        f"{NON_USER_MSG_PREFIX}The conversation history will soon reach its maximum length and be trimmed.",
        "Do NOT tell the user about this system alert, they should not know that the history is reaching max length.",
        "If there is any important new information or general memories about you or the user that you would like to save, you should save that information immediately by calling function core_memory_append, core_memory_replace, or archival_memory_insert.",
        # "Remember to pass request_heartbeat = true if you would like to send a message immediately after.",
    ]
)

# Throw an error message when a read-only block is edited
READ_ONLY_BLOCK_EDIT_ERROR = f"{ERROR_MESSAGE_PREFIX} This block is read-only and cannot be edited."

# The ackknowledgement message used in the summarize sequence
MESSAGE_SUMMARY_REQUEST_ACK = "Understood, I will respond with a summary of the message (and only the summary, nothing else) once I receive the conversation history. I'm ready."

# Maximum length of an error message
MAX_ERROR_MESSAGE_CHAR_LIMIT = 1000

# Default memory limits
CORE_MEMORY_PERSONA_CHAR_LIMIT: int = 20000
CORE_MEMORY_HUMAN_CHAR_LIMIT: int = 20000
CORE_MEMORY_BLOCK_CHAR_LIMIT: int = 20000

# Function return limits
FUNCTION_RETURN_CHAR_LIMIT = 50000  # ~300 words
BASE_FUNCTION_RETURN_CHAR_LIMIT = 50000  # same as regular function limit
FILE_IS_TRUNCATED_WARNING = "# NOTE: This block is truncated, use functions to view the full content."

# Tool return truncation limit for LLM context window management
TOOL_RETURN_TRUNCATION_CHARS = 5000

MAX_PAUSE_HEARTBEATS = 360  # in min

MESSAGE_CHATGPT_FUNCTION_MODEL = "gpt-3.5-turbo"
MESSAGE_CHATGPT_FUNCTION_SYSTEM_MESSAGE = "You are a helpful assistant. Keep your responses short and concise."

#### Functions related

# REQ_HEARTBEAT_MESSAGE = f"{NON_USER_MSG_PREFIX}request_heartbeat == true"
REQ_HEARTBEAT_MESSAGE = f"{NON_USER_MSG_PREFIX}Function called using request_heartbeat=true, returning control"
# FUNC_FAILED_HEARTBEAT_MESSAGE = f"{NON_USER_MSG_PREFIX}Function call failed"
FUNC_FAILED_HEARTBEAT_MESSAGE = f"{NON_USER_MSG_PREFIX}Function call failed, returning control"


RETRIEVAL_QUERY_DEFAULT_PAGE_SIZE = 5

MAX_FILENAME_LENGTH = 255
RESERVED_FILENAMES = {"CON", "PRN", "AUX", "NUL", "COM1", "COM2", "LPT1", "LPT2"}

WEB_SEARCH_CLIP_CONTENT = False
WEB_SEARCH_INCLUDE_SCORE = False
WEB_SEARCH_SEPARATOR = "\n" + "-" * 40 + "\n"

REDIS_INCLUDE = "include"
REDIS_EXCLUDE = "exclude"
REDIS_SET_DEFAULT_VAL = "None"
REDIS_DEFAULT_CACHE_PREFIX = "letta_cache"
REDIS_RUN_ID_PREFIX = "agent:send_message:run_id"

# TODO: This is temporary, eventually use token-based eviction
# File based controls
DEFAULT_MAX_FILES_OPEN = 5
DEFAULT_CORE_MEMORY_SOURCE_CHAR_LIMIT: int = 50000

GET_PROVIDERS_TIMEOUT_SECONDS = 10

# Pinecone related fields
PINECONE_EMBEDDING_MODEL: str = "llama-text-embed-v2"
PINECONE_TEXT_FIELD_NAME = "chunk_text"
PINECONE_METRIC = "cosine"
PINECONE_CLOUD = "aws"
PINECONE_REGION = "us-east-1"
PINECONE_MAX_BATCH_SIZE = 96

# retry configuration
PINECONE_MAX_RETRY_ATTEMPTS = 3
PINECONE_RETRY_BASE_DELAY = 1.0  # seconds
PINECONE_RETRY_MAX_DELAY = 60.0  # seconds
PINECONE_RETRY_BACKOFF_FACTOR = 2.0
PINECONE_THROTTLE_DELAY = 0.75  # seconds base delay between batches

# builtin web search
WEB_SEARCH_MODEL_ENV_VAR_NAME = "LETTA_BUILTIN_WEBSEARCH_OPENAI_MODEL_NAME"
WEB_SEARCH_MODEL_ENV_VAR_DEFAULT_VALUE = "gpt-4.1-mini-2025-04-14"

# Excluded model keywords from base tool rules
EXCLUDE_MODEL_KEYWORDS_FROM_BASE_TOOL_RULES = ["claude-4-sonnet", "claude-3-5-sonnet", "gpt-5", "gemini-2.5-pro"]
# But include models with these keywords in base tool rules (overrides exclusion)
INCLUDE_MODEL_KEYWORDS_BASE_TOOL_RULES = ["mini"]

# Deployment and versioning
MODAL_DEFAULT_TOOL_NAME = "modal_tool_wrapper.<locals>.modal_function"  # NOTE: must stay in sync with modal_tool_wrapper
MODAL_DEFAULT_CONFIG_KEY = "default"
MODAL_MODAL_DEPLOYMENTS_KEY = "modal_deployments"
MODAL_VERSION_HASH_LENGTH = 12

# Modal execution settings
MODAL_DEFAULT_TIMEOUT = 60
MODAL_DEFAULT_MAX_CONCURRENT_INPUTS = 1
MODAL_DEFAULT_PYTHON_VERSION = "3.12"

# Security settings
MODAL_SAFE_IMPORT_MODULES = {"typing", "pydantic", "datetime", "enum", "uuid", "decimal"}
# Default handle for model used to generate tools
DEFAULT_GENERATE_TOOL_MODEL_HANDLE = "openai/gpt-4.1"
