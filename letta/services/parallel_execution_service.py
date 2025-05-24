import asyncio
import time
import uuid
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set, Tuple, Union

from pydantic import ValidationError

from letta.log import get_logger
from letta.schemas.parallel_execution import (
    BatchConfig,
    BatchingStrategy,
    ParallelExecutionConfig,
    ParallelToolBatch,
    ParallelToolCall,
    ParallelToolResult,
    ParallelizationStrategy,
    ToolExecutionMode
)
from letta.schemas.tool import Tool
from letta.schemas.user import User
from letta.server.db import db_context
from letta.services.tool_executor.tool_execution_sandbox import ToolExecutionSandbox
from letta.services.tool_manager import ToolManager
from letta.utils import enforce_types

logger = get_logger(__name__)

class ExecutorType(str, Enum):
    THREAD = "thread"
    PROCESS = "process"


class ParallelExecutionService:
    """Service for parallel execution of tools"""

    def __init__(self):
        # Database session maker
        self.session_maker = db_context
        
        # Related services
        self.tool_manager = ToolManager()
        
        # Thread and process pool executors
        self._thread_pool = ThreadPoolExecutor()
        self._process_pool = ProcessPoolExecutor()
        
        # Cache for execution results
        self._execution_cache: Dict[str, ParallelToolResult] = {}
        
        # Active tool batch executions
        self._active_batches: Dict[str, ParallelToolBatch] = {}
        
    @enforce_types
    def get_config(self, agent_id: str, actor: User) -> ParallelExecutionConfig:
        """Get the parallel execution configuration for an agent"""
        from letta.orm.parallel_execution import ParallelExecutionConfig as ORMParallelExecutionConfig

        with self.session_maker() as session:
            try:
                config = session.query(ORMParallelExecutionConfig).filter(
                    ORMParallelExecutionConfig.agent_id == agent_id,
                    ORMParallelExecutionConfig.organization_id == actor.organization_id
                ).one_or_none()
                
                if config:
                    return config.to_pydantic()
                else:
                    # Create default config
                    agent_manager = __import__('letta.services.agent_manager', fromlist=['AgentManager']).AgentManager()
                    agent = agent_manager.get_agent_by_id(agent_id, actor)
                    new_config = ParallelExecutionConfig(
                        agent_id=agent_id,
                        organization_id=actor.organization_id
                    )
                    return self.create_config(new_config, actor)
            except Exception as e:
                logger.error(f"Error getting parallel execution config for agent {agent_id}: {e}")
                raise
    
    @enforce_types
    def create_config(self, config: ParallelExecutionConfig, actor: User) -> ParallelExecutionConfig:
        """Create a new parallel execution configuration"""
        from letta.orm.parallel_execution import ParallelExecutionConfig as ORMParallelExecutionConfig
        
        with self.session_maker() as session:
            orm_config = ORMParallelExecutionConfig(
                id=config.id,
                agent_id=config.agent_id,
                organization_id=config.organization_id,
                default_execution_mode=config.default_execution_mode,
                max_concurrent_executions=config.max_concurrent_executions,
                parallelization_strategy=config.parallelization_strategy,
                wait_for_all_results=config.wait_for_all_results,
                batching_enabled=config.batching.enabled,
                batching_strategy=config.batching.strategy,
                batching_max_batch_size=config.batching.max_batch_size,
                batching_timeout_ms=config.batching.batch_timeout_ms,
                batching_process_partial=config.batching.process_partial_batches,
                tool_specific_configs=config.tool_specific_configs
            )
            orm_config.create(session, actor=actor)
            return orm_config.to_pydantic()
    
    @enforce_types
    def update_config(self, agent_id: str, config_update: Dict, actor: User) -> ParallelExecutionConfig:
        """Update the parallel execution configuration for an agent"""
        from letta.orm.parallel_execution import ParallelExecutionConfig as ORMParallelExecutionConfig
        
        with self.session_maker() as session:
            current_config = self.get_config(agent_id, actor)
            
            # Handle nested batching updates
            if "batching" in config_update:
                batching_update = config_update.pop("batching")
                current_config.batching = BatchConfig(**{**current_config.batching.dict(), **batching_update})
            
            # Apply other updates
            for key, value in config_update.items():
                if hasattr(current_config, key):
                    setattr(current_config, key, value)
            
            orm_config = ORMParallelExecutionConfig.read(session, current_config.id, actor=actor)
            
            # Update fields from current_config
            orm_config.default_execution_mode = current_config.default_execution_mode
            orm_config.max_concurrent_executions = current_config.max_concurrent_executions
            orm_config.parallelization_strategy = current_config.parallelization_strategy
            orm_config.wait_for_all_results = current_config.wait_for_all_results
            orm_config.batching_enabled = current_config.batching.enabled
            orm_config.batching_strategy = current_config.batching.strategy
            orm_config.batching_max_batch_size = current_config.batching.max_batch_size
            orm_config.batching_timeout_ms = current_config.batching.batch_timeout_ms
            orm_config.batching_process_partial = current_config.batching.process_partial_batches
            orm_config.tool_specific_configs = current_config.tool_specific_configs
            
            session.commit()
            return orm_config.to_pydantic()
    
    def _determine_executor_type(self, tool: Tool) -> ExecutorType:
        """Determine the appropriate executor type for a tool"""
        # Determine whether to use thread or process pool based on the tool
        # By default use threads for most tools as they're generally I/O bound
        # For compute-intensive tools, use process pool
        
        # This could be enhanced with more sophisticated logic based on tool metadata or past performance
        if tool.metadata_ and tool.metadata_.get("compute_intensive"):
            return ExecutorType.PROCESS
        return ExecutorType.THREAD
    
    async def _execute_tool_async(self, tool_call: ParallelToolCall, tool: Tool, user: User, agent_state=None) -> ParallelToolResult:
        """Execute a tool asynchronously"""
        start_time = time.time()
        tool_id = tool_call.id
        tool_name = tool_call.tool_name
        retry_count = 0
        result = None
        error = None
        success = False
        
        # Check if we have a cached result
        cache_key = f"{tool_name}:{hash(str(tool_call.args))}"
        if cache_key in self._execution_cache:
            cached_result = self._execution_cache[cache_key]
            cached_result.tool_id = tool_id  # Update with current tool call ID
            cached_result.was_cached = True
            return cached_result
        
        # Create sandbox
        sandbox = ToolExecutionSandbox(
            tool_name=tool_name,
            args=tool_call.args,
            user=user,
            tool_object=tool
        )
        
        # Execute with retries
        while retry_count <= tool_call.retries:
            try:
                # Determine executor type
                executor_type = self._determine_executor_type(tool)
                
                # Get the appropriate executor pool
                executor_pool = self._thread_pool if executor_type == ExecutorType.THREAD else self._process_pool
                
                # Execute the tool in the appropriate pool
                loop = asyncio.get_event_loop()
                execution_future = loop.run_in_executor(
                    executor_pool,
                    lambda: sandbox.run(agent_state=agent_state, additional_env_vars=tool_call.env_vars)
                )
                
                # Wait for execution with timeout
                execution_result = await asyncio.wait_for(execution_future, timeout=tool_call.timeout_seconds)
                
                # Process successful execution
                result = execution_result.response
                success = True
                break
                
            except asyncio.TimeoutError:
                error = f"Tool execution timed out after {tool_call.timeout_seconds} seconds"
                logger.warning(f"Tool {tool_name} timed out: {error}")
            except Exception as e:
                error = str(e)
                logger.error(f"Error executing tool {tool_name}: {error}")
            
            # Handle retry logic
            retry_count += 1
            if retry_count <= tool_call.retries:
                logger.info(f"Retrying tool {tool_name} (attempt {retry_count} of {tool_call.retries})")
                await asyncio.sleep(tool_call.retry_delay_seconds)
        
        # Calculate execution time
        execution_time_ms = int((time.time() - start_time) * 1000)
        
        # Create result object
        tool_result = ParallelToolResult(
            tool_id=tool_id,
            tool_name=tool_name,
            success=success,
            result=result,
            error=error,
            execution_time_ms=execution_time_ms,
            retry_count=retry_count,
            was_cached=False
        )
        
        # Cache successful results
        if success:
            self._execution_cache[cache_key] = tool_result
        
        return tool_result

    async def execute_tool_calls_parallel(
        self, 
        tool_calls: List[ParallelToolCall],
        user: User,
        agent_id: str, 
        strategy: ParallelizationStrategy = ParallelizationStrategy.FULL,
        timeout_seconds: int = 300,
        wait_for_all: bool = True
    ) -> List[ParallelToolResult]:
        """Execute multiple tool calls in parallel"""
        if not tool_calls:
            return []
        
        # Get the agent's parallel execution config
        config = self.get_config(agent_id, user)
        
        # Use provided strategy or fall back to config
        if strategy == ParallelizationStrategy.NONE:
            strategy = config.parallelization_strategy
        
        # Use provided wait_for_all or fall back to config
        if wait_for_all is None:
            wait_for_all = config.wait_for_all_results
        
        # Create batch ID and store the batch
        batch_id = f"batch_{uuid.uuid4()}"
        batch = ParallelToolBatch(
            id=batch_id,
            tool_calls=tool_calls,
            created_at=datetime.now(timezone.utc).isoformat(),
            timeout_seconds=timeout_seconds,
            agent_id=agent_id,
            organization_id=user.organization_id
        )
        self._active_batches[batch_id] = batch
        
        # Get all required tools
        tool_names = {call.tool_name for call in tool_calls}
        tools_dict = {}
        for tool_name in tool_names:
            tool = self.tool_manager.get_tool_by_name(tool_name=tool_name, actor=user)
            if not tool:
                logger.error(f"Tool {tool_name} not found")
                continue
            tools_dict[tool_name] = tool
        
        # Prepare tasks based on strategy
        tasks = []
        
        if strategy == ParallelizationStrategy.FULL:
            # Execute all tools in parallel
            for tool_call in tool_calls:
                if tool_call.tool_name not in tools_dict:
                    continue
                tool = tools_dict[tool_call.tool_name]
                tasks.append(self._execute_tool_async(tool_call, tool, user))
            
        elif strategy == ParallelizationStrategy.DEPENDENCY_BASED:
            # Execute tools in dependency order
            # First, create mapping of tool_id to tool_call and dependency sets
            id_to_call = {call.id: call for call in tool_calls}
            no_dependencies = [call for call in tool_calls if not call.dependencies]
            
            # Execute tools with no dependencies first
            no_dep_tasks = []
            for tool_call in no_dependencies:
                if tool_call.tool_name not in tools_dict:
                    continue
                tool = tools_dict[tool_call.tool_name]
                no_dep_tasks.append(self._execute_tool_async(tool_call, tool, user))
            
            # Wait for no-dependency tasks to complete
            no_dep_results = await asyncio.gather(*no_dep_tasks)
            results_dict = {result.tool_id: result for result in no_dep_results}
            
            # Now handle dependencies recursively
            async def process_dependencies(call_id):
                # If already processed, return result
                if call_id in results_dict:
                    return results_dict[call_id]
                
                tool_call = id_to_call[call_id]
                
                # Process all dependencies first
                dep_results = []
                for dep_id in tool_call.dependencies:
                    if dep_id in id_to_call:
                        dep_results.append(await process_dependencies(dep_id))
                
                # Only proceed if all dependencies succeeded
                if all(result.success for result in dep_results):
                    if tool_call.tool_name not in tools_dict:
                        # Create failure result for missing tool
                        result = ParallelToolResult(
                            tool_id=tool_call.id,
                            tool_name=tool_call.tool_name,
                            success=False,
                            error=f"Tool {tool_call.tool_name} not found",
                            execution_time_ms=0,
                            retry_count=0,
                            was_cached=False
                        )
                    else:
                        # Execute the tool
                        tool = tools_dict[tool_call.tool_name]
                        result = await self._execute_tool_async(tool_call, tool, user)
                else:
                    # Create failure result for dependency failure
                    result = ParallelToolResult(
                        tool_id=tool_call.id,
                        tool_name=tool_call.tool_name,
                        success=False,
                        error="One or more dependencies failed",
                        execution_time_ms=0,
                        retry_count=0,
                        was_cached=False
                    )
                
                results_dict[call_id] = result
                return result
            
            # Process all remaining tools with dependencies
            remaining_calls = [call for call in tool_calls if call.dependencies]
            for call in remaining_calls:
                if call.id not in results_dict:  # Skip if already processed
                    tasks.append(process_dependencies(call.id))
        
        elif strategy == ParallelizationStrategy.PRIORITY_BASED:
            # Sort by priority and execute
            priority_sorted = sorted(tool_calls, key=lambda x: x.priority)
            for tool_call in priority_sorted:
                if tool_call.tool_name not in tools_dict:
                    continue
                tool = tools_dict[tool_call.tool_name]
                tasks.append(self._execute_tool_async(tool_call, tool, user))
        
        # Execute all tasks with timeout
        try:
            if wait_for_all:
                # Wait for all tools to complete
                results = await asyncio.gather(*tasks)
            else:
                # Start all tasks and return as they complete
                results = []
                for future in asyncio.as_completed(tasks, timeout=timeout_seconds):
                    result = await future
                    results.append(result)
        except asyncio.TimeoutError:
            logger.warning(f"Batch {batch_id} timed out after {timeout_seconds} seconds")
            # Return results for completed tasks and timeouts for the rest
            completed_tasks = [task for task in tasks if task.done()]
            completed_results = [task.result() for task in completed_tasks if not task.exception()]
            
            # Create timeout results for incomplete tasks
            incomplete_calls = [call for call in tool_calls if call.id not in [r.tool_id for r in completed_results]]
            timeout_results = [
                ParallelToolResult(
                    tool_id=call.id,
                    tool_name=call.tool_name,
                    success=False,
                    error=f"Execution timed out after {timeout_seconds} seconds",
                    execution_time_ms=timeout_seconds * 1000,
                    retry_count=0,
                    was_cached=False
                ) for call in incomplete_calls
            ]
            
            results = completed_results + timeout_results
        
        # Remove the batch from active batches
        self._active_batches.pop(batch_id, None)
        
        return results
    
    @enforce_types
    def create_tool_batch(
        self, 
        agent_id: str, 
        tool_calls: List[ParallelToolCall], 
        actor: User
    ) -> ParallelToolBatch:
        """Create a new batch of tool calls"""
        batch_id = f"batch_{uuid.uuid4()}"
        batch = ParallelToolBatch(
            id=batch_id,
            tool_calls=tool_calls,
            created_at=datetime.now(timezone.utc).isoformat(),
            timeout_seconds=300,  # Default timeout
            agent_id=agent_id,
            organization_id=actor.organization_id
        )
        self._active_batches[batch_id] = batch
        return batch
    
    @enforce_types
    def get_batch_status(self, batch_id: str, actor: User) -> Optional[ParallelToolBatch]:
        """Get the status of a batch execution"""
        return self._active_batches.get(batch_id)
    
    @enforce_types
    async def execute_batch(
        self, 
        batch_id: str, 
        actor: User, 
        wait_for_all: bool = True,
        strategy: ParallelizationStrategy = ParallelizationStrategy.FULL
    ) -> List[ParallelToolResult]:
        """Execute a previously created batch of tool calls"""
        batch = self._active_batches.get(batch_id)
        if not batch:
            logger.error(f"Batch {batch_id} not found")
            return []
        
        return await self.execute_tool_calls_parallel(
            tool_calls=batch.tool_calls,
            user=actor,
            agent_id=batch.agent_id,
            strategy=strategy,
            timeout_seconds=batch.timeout_seconds,
            wait_for_all=wait_for_all
        )
