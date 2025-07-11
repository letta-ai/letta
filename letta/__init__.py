import os
from importlib.metadata import PackageNotFoundError, version

try:
    __version__ = version("letta")
except PackageNotFoundError:
    # Fallback for development installations
    __version__ = "0.8.13"

if os.environ.get("LETTA_VERSION"):
    __version__ = os.environ["LETTA_VERSION"]


# import clients
from letta.client.client import RESTClient

# imports for easier access
from letta.schemas.agent import AgentState
from letta.schemas.block import Block
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import JobStatus
from letta.schemas.file import FileMetadata
from letta.schemas.job import Job
from letta.schemas.letta_message import LettaMessage
from letta.schemas.letta_stop_reason import LettaStopReason
from letta.schemas.llm_config import LLMConfig
from letta.schemas.memory import ArchivalMemorySummary, BasicBlockMemory, ChatMemory, Memory, RecallMemorySummary
from letta.schemas.message import Message
from letta.schemas.organization import Organization
from letta.schemas.passage import Passage
from letta.schemas.source import Source
from letta.schemas.tool import Tool
from letta.schemas.usage import LettaUsageStatistics
from letta.schemas.user import User
