from enum import Enum
from typing import Dict, List, Optional, Union

from pydantic import BaseModel, Field, validator

from letta.schemas.letta_base import LettaBase


class ToolExecutionMode(str, Enum):
    """Execution modes for tool operations"""
    SYNC = "sync"           # Default synchronous execution
    ASYNC = "async"         # Asynchronous execution (non-blocking)
    PARALLEL = "parallel"   # Parallel execution of multiple tools


class BatchingStrategy(str, Enum):
    """Strategies for batching tool executions"""
    NONE = "none"               # No batching
    COUNT_BASED = "count"      # Batch based on operation count
    TIME_BASED = "time"        # Batch based on time window
    HYBRID = "hybrid"          # Combination of count and time


class ParallelizationStrategy(str, Enum):
    """Strategies for parallelizing tool executions"""
    NONE = "none"                     # No parallelization
    FULL = "full"                     # Fully parallel execution
    DEPENDENCY_BASED = "dependency"   # Parallelize based on dependencies
    PRIORITY_BASED = "priority"       # Parallelize based on priorities


class ParallelToolCall(BaseModel):
    """Configuration for a parallel tool call"""
    tool_name: str = Field(..., description="Name of the tool to execute")
    args: Dict = Field(default_factory=dict, description="Arguments for the tool call")
    env_vars: Optional[Dict[str, str]] = Field(None, description="Environment variables for this specific tool call")
    priority: int = Field(1, description="Execution priority (lower means higher priority)")
    dependencies: List[str] = Field(default_factory=list, description="IDs of tool calls that must complete before this one")
    timeout_seconds: int = Field(60, description="Maximum execution time in seconds")
    retries: int = Field(0, description="Number of retry attempts if the tool fails")
    retry_delay_seconds: int = Field(1, description="Delay between retries in seconds")
    id: Optional[str] = Field(None, description="Unique identifier for this tool call")
    
    @validator('id', pre=True, always=True)
    def set_id_if_none(cls, v):
        import uuid
        return v or f"p_tool_{uuid.uuid4()}"


class BatchConfig(BaseModel):
    """Configuration for batching tool executions"""
    enabled: bool = Field(False, description="Whether batching is enabled")
    strategy: BatchingStrategy = Field(BatchingStrategy.COUNT_BASED, description="Batching strategy to use")
    max_batch_size: int = Field(10, description="Maximum number of operations in a batch")
    batch_timeout_ms: int = Field(500, description="Maximum wait time for batch formation in milliseconds")
    process_partial_batches: bool = Field(True, description="Whether to process partial batches")


class ParallelExecutionConfig(LettaBase):
    """Configuration for parallel tool execution"""
    __id_prefix__ = "parallel_cfg"
    
    id: str = LettaBase.generate_id_field()
    agent_id: str = Field(..., description="ID of the agent this configuration belongs to")
    organization_id: str = Field(..., description="ID of the organization this configuration belongs to")
    
    # General execution settings
    default_execution_mode: ToolExecutionMode = Field(
        ToolExecutionMode.SYNC, 
        description="Default execution mode for tool operations"
    )
    max_concurrent_executions: int = Field(
        5, 
        description="Maximum number of concurrent tool executions"
    )
    
    # Parallelization settings
    parallelization_strategy: ParallelizationStrategy = Field(
        ParallelizationStrategy.FULL, 
        description="Strategy for parallelizing tool executions"
    )
    wait_for_all_results: bool = Field(
        True, 
        description="Whether to wait for all results before returning (vs. streaming results as available)"
    )
    
    # Batching configuration
    batching: BatchConfig = Field(
        default_factory=BatchConfig, 
        description="Configuration for batching tool executions"
    )
    
    # Tool-specific configurations
    tool_specific_configs: Optional[Dict[str, ToolExecutionMode]] = Field(
        None,
        description="Specific execution modes for individual tools, overriding the default"
    )


class ParallelToolResult(BaseModel):
    """Result of a parallel tool execution"""
    tool_id: str = Field(..., description="ID of the tool call")
    tool_name: str = Field(..., description="Name of the tool that was called")
    success: bool = Field(..., description="Whether the execution was successful")
    result: Optional[Union[str, Dict, List]] = Field(None, description="Result of the tool execution if successful")
    error: Optional[str] = Field(None, description="Error message if execution failed")
    execution_time_ms: int = Field(..., description="Execution time in milliseconds")
    retry_count: int = Field(0, description="Number of retries performed")
    was_cached: bool = Field(False, description="Whether the result was retrieved from cache")


class ParallelToolBatch(BaseModel):
    """Batch of parallel tool calls"""
    id: str = Field(..., description="Unique identifier for this batch")
    tool_calls: List[ParallelToolCall] = Field(..., description="List of tool calls in this batch")
    created_at: str = Field(..., description="ISO timestamp when the batch was created")
    timeout_seconds: int = Field(300, description="Maximum execution time for the entire batch in seconds")
    agent_id: str = Field(..., description="ID of the agent making these tool calls")
    organization_id: str = Field(..., description="ID of the organization the agent belongs to")


class BatchToolRequest(BaseModel):
    """Request body for batched tool execution"""
    tool_calls: List[ParallelToolCall] = Field(..., description="List of tool calls to execute in parallel")
    timeout_seconds: Optional[int] = Field(300, description="Maximum execution time in seconds")
    wait_for_all: Optional[bool] = Field(True, description="Whether to wait for all results before returning")
    strategy: Optional[ParallelizationStrategy] = Field(ParallelizationStrategy.FULL, description="Strategy for parallelization")


class BatchToolResponse(BaseModel):
    """Response body for batched tool execution"""
    batch_id: str = Field(..., description="Unique identifier for this batch")
    results: List[ParallelToolResult] = Field(..., description="Results of the tool executions")
    complete: bool = Field(..., description="Whether all tool executions have completed")
    execution_time_ms: int = Field(..., description="Total execution time in milliseconds")
