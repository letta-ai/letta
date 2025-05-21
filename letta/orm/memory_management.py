from sqlalchemy import Column, Enum, Integer, String, Boolean, Float, ForeignKey, JSON
from sqlalchemy.orm import relationship

from letta.orm.base import Base
from letta.orm.mixins import ActorshipMixin, TimestampMixin
from letta.schemas.memory_management import (
    CompressionAlgorithm,
    MemoryCompressionConfig,
    MemoryManagementConfig as PydanticMemoryManagementConfig,
    MemoryPruningConfig,
    MemoryPruningStrategy,
    MemorySummarizationConfig
)


class MemoryManagementConfig(Base, ActorshipMixin, TimestampMixin):
    """ORM model for memory management configuration"""
    __tablename__ = "memory_management_configs"

    id = Column(String, primary_key=True)
    agent_id = Column(String, ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    
    # Summarization config
    summarization_enabled = Column(Boolean, default=False)
    summarization_summary_interval = Column(Integer, default=10)
    summarization_token_limit = Column(Integer, default=4000)
    summarization_min_messages_for_summary = Column(Integer, default=5)
    
    # Compression config
    compression_enabled = Column(Boolean, default=False)
    compression_algorithm = Column(Enum(CompressionAlgorithm), default=CompressionAlgorithm.GZIP)
    compression_threshold_days = Column(Integer, default=30)
    compression_level = Column(Integer, default=5)
    
    # Pruning config
    pruning_enabled = Column(Boolean, default=False)
    pruning_strategy = Column(Enum(MemoryPruningStrategy), default=MemoryPruningStrategy.TIME_BASED)
    pruning_max_age_days = Column(Integer, nullable=True)
    pruning_max_count = Column(Integer, nullable=True)
    pruning_min_relevance_score = Column(Float, nullable=True)
    pruning_protect_starred = Column(Boolean, default=True)
    
    # Relationships
    agent = relationship("Agent", back_populates="memory_management_config")
    
    def to_pydantic(self) -> PydanticMemoryManagementConfig:
        """Convert ORM model to Pydantic model"""
        summarization = MemorySummarizationConfig(
            enabled=self.summarization_enabled,
            summary_interval=self.summarization_summary_interval,
            token_limit=self.summarization_token_limit,
            min_messages_for_summary=self.summarization_min_messages_for_summary
        )
        
        compression = MemoryCompressionConfig(
            enabled=self.compression_enabled,
            algorithm=self.compression_algorithm,
            compression_threshold_days=self.compression_threshold_days,
            compression_level=self.compression_level
        )
        
        pruning = MemoryPruningConfig(
            enabled=self.pruning_enabled,
            strategy=self.pruning_strategy,
            max_age_days=self.pruning_max_age_days,
            max_count=self.pruning_max_count,
            min_relevance_score=self.pruning_min_relevance_score,
            protect_starred=self.pruning_protect_starred
        )
        
        return PydanticMemoryManagementConfig(
            id=self.id,
            agent_id=self.agent_id,
            organization_id=self.organization_id,
            summarization=summarization,
            compression=compression,
            pruning=pruning
        )
