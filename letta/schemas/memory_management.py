from enum import Enum
from typing import Dict, List, Optional, Union

from pydantic import BaseModel, Field

from letta.schemas.letta_base import LettaBase


class CompressionAlgorithm(str, Enum):
    """Supported compression algorithms for memory storage"""
    NONE = "none"
    GZIP = "gzip"
    ZSTD = "zstd"
    LZ4 = "lz4"


class MemoryPruningStrategy(str, Enum):
    """Strategies for pruning memories from storage"""
    NONE = "none"                   # No pruning
    TIME_BASED = "time_based"       # Remove memories older than a specified time
    COUNT_BASED = "count_based"     # Limit the number of memories
    RELEVANCE_BASED = "relevance"   # Remove memories based on relevance score
    HYBRID = "hybrid"               # Combination of strategies


class MemorySummarizationConfig(BaseModel):
    """Configuration for memory summarization"""
    enabled: bool = Field(False, description="Whether summarization is enabled")
    summary_interval: int = Field(10, description="Number of messages to include in a summary chunk")
    token_limit: int = Field(4000, description="Maximum token count before summarization is triggered")
    min_messages_for_summary: int = Field(5, description="Minimum number of messages needed before summarization")


class MemoryCompressionConfig(BaseModel):
    """Configuration for memory compression"""
    enabled: bool = Field(False, description="Whether compression is enabled")
    algorithm: CompressionAlgorithm = Field(CompressionAlgorithm.GZIP, description="Compression algorithm to use")
    compression_threshold_days: int = Field(30, description="Age in days after which memories are compressed")
    compression_level: int = Field(5, description="Compression level (1-9 for gzip and zstd, 1-12 for lz4)")


class MemoryPruningConfig(BaseModel):
    """Configuration for memory pruning"""
    enabled: bool = Field(False, description="Whether pruning is enabled")
    strategy: MemoryPruningStrategy = Field(MemoryPruningStrategy.TIME_BASED, description="Pruning strategy to use")
    max_age_days: Optional[int] = Field(None, description="Maximum age of memories in days (for time-based)")
    max_count: Optional[int] = Field(None, description="Maximum number of memories to keep (for count-based)")
    min_relevance_score: Optional[float] = Field(None, description="Minimum relevance score to keep (for relevance-based)")
    protect_starred: bool = Field(True, description="Whether to protect starred memories from pruning")


class MemoryManagementConfig(LettaBase):
    """Configuration for memory management including summarization, compression, and pruning"""
    __id_prefix__ = "mem_config"
    
    id: str = LettaBase.generate_id_field()
    agent_id: str = Field(..., description="ID of the agent this configuration belongs to")
    summarization: MemorySummarizationConfig = Field(default_factory=MemorySummarizationConfig, description="Configuration for memory summarization")
    compression: MemoryCompressionConfig = Field(default_factory=MemoryCompressionConfig, description="Configuration for memory compression")
    pruning: MemoryPruningConfig = Field(default_factory=MemoryPruningConfig, description="Configuration for memory pruning")
    organization_id: str = Field(..., description="ID of the organization this configuration belongs to")
