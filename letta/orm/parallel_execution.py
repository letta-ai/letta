from sqlalchemy import Column, Enum, Integer, String, Boolean, Float, ForeignKey, JSON
from sqlalchemy.orm import relationship

from letta.orm.base import Base
from letta.orm.mixins import ActorshipMixin, TimestampMixin
from letta.schemas.parallel_execution import (
    BatchingStrategy,
    ParallelExecutionConfig as PydanticParallelExecutionConfig,
    ParallelizationStrategy,
    ToolExecutionMode
)


class ParallelExecutionConfig(Base, ActorshipMixin, TimestampMixin):
    """ORM model for parallel execution configuration"""
    __tablename__ = "parallel_execution_configs"

    id = Column(String, primary_key=True)
    agent_id = Column(String, ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    
    # General execution settings
    default_execution_mode = Column(Enum(ToolExecutionMode), default=ToolExecutionMode.SYNC)
    max_concurrent_executions = Column(Integer, default=5)
    
    # Parallelization settings
    parallelization_strategy = Column(Enum(ParallelizationStrategy), default=ParallelizationStrategy.FULL)
    wait_for_all_results = Column(Boolean, default=True)
    
    # Batching configuration
    batching_enabled = Column(Boolean, default=False)
    batching_strategy = Column(Enum(BatchingStrategy), default=BatchingStrategy.COUNT_BASED)
    batching_max_batch_size = Column(Integer, default=10)
    batching_timeout_ms = Column(Integer, default=500)
    batching_process_partial = Column(Boolean, default=True)
    
    # Tool-specific configurations (stored as JSON)
    tool_specific_configs = Column(JSON, nullable=True)
    
    # Relationships
    agent = relationship("Agent", back_populates="parallel_execution_config")
    
    def to_pydantic(self) -> PydanticParallelExecutionConfig:
        """Convert ORM model to Pydantic model"""
        from letta.schemas.parallel_execution import BatchConfig
        
        batching = BatchConfig(
            enabled=self.batching_enabled,
            strategy=self.batching_strategy,
            max_batch_size=self.batching_max_batch_size,
            batch_timeout_ms=self.batching_timeout_ms,
            process_partial_batches=self.batching_process_partial
        )
        
        return PydanticParallelExecutionConfig(
            id=self.id,
            agent_id=self.agent_id,
            organization_id=self.organization_id,
            default_execution_mode=self.default_execution_mode,
            max_concurrent_executions=self.max_concurrent_executions,
            parallelization_strategy=self.parallelization_strategy,
            wait_for_all_results=self.wait_for_all_results,
            batching=batching,
            tool_specific_configs=self.tool_specific_configs
        )
