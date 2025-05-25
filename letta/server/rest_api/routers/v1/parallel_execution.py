from typing import Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Body, Depends, Header, HTTPException, Query, status
from fastapi.responses import JSONResponse

from letta.log import get_logger
from letta.schemas.parallel_execution import (
    BatchToolRequest,
    BatchToolResponse,
    ParallelExecutionConfig,
    ParallelToolBatch,
    ParallelToolCall,
    ParallelToolResult,
    ParallelizationStrategy
)
from letta.server.rest_api.utils import get_letta_server
from letta.server.server import SyncServer
from letta.services.parallel_execution_service import ParallelExecutionService

router = APIRouter(prefix="/parallel-execution", tags=["parallel-execution"])
logger = get_logger(__name__)

# Initialize the parallel execution service
parallel_service = ParallelExecutionService()


@router.get("/agent/{agent_id}/config", response_model=ParallelExecutionConfig, operation_id="get_parallel_execution_config")
def get_parallel_execution_config(
    agent_id: str,
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Get the parallel execution configuration for an agent.
    
    This endpoint retrieves the current parallel execution configuration for the specified agent,
    including settings for async execution, batching, and parallelization strategies.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    
    try:
        config = parallel_service.get_config(agent_id, actor)
        return config
    except Exception as e:
        logger.error(f"Error getting parallel execution config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/agent/{agent_id}/config", response_model=ParallelExecutionConfig, operation_id="update_parallel_execution_config")
def update_parallel_execution_config(
    agent_id: str,
    config_update: Dict = Body(...),
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Update the parallel execution configuration for an agent.
    
    This endpoint updates the parallel execution configuration for the specified agent
    with the provided settings for async execution, batching, and parallelization strategies.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    
    try:
        updated_config = parallel_service.update_config(agent_id, config_update, actor)
        return updated_config
    except Exception as e:
        logger.error(f"Error updating parallel execution config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/agent/{agent_id}/batch/create", response_model=ParallelToolBatch, operation_id="create_tool_batch")
def create_tool_batch(
    agent_id: str,
    tool_calls: List[ParallelToolCall] = Body(...),
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Create a new batch of tool calls for later execution.
    
    This endpoint creates a new batch of tool calls that can be executed later
    using the /execute endpoint. This is useful for preparing complex tool operations
    that may need to be executed as a group.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    
    try:
        batch = parallel_service.create_tool_batch(agent_id, tool_calls, actor)
        return batch
    except Exception as e:
        logger.error(f"Error creating tool batch: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/batch/{batch_id}", response_model=ParallelToolBatch, operation_id="get_batch_status")
def get_batch_status(
    batch_id: str,
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Get the status of a batch of tool calls.
    
    This endpoint retrieves the current status of a previously created batch of tool calls,
    including information about which tools have been executed and their results.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    
    try:
        batch = parallel_service.get_batch_status(batch_id, actor)
        if not batch:
            raise HTTPException(status_code=404, detail=f"Batch {batch_id} not found")
        return batch
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting batch status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def _execute_batch_background(batch_id: str, actor_id: str, server: SyncServer, wait_for_all: bool, strategy: ParallelizationStrategy):
    """
    Background task to execute a batch of tool calls.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    try:
        await parallel_service.execute_batch(batch_id, actor, wait_for_all, strategy)
    except Exception as e:
        logger.error(f"Error executing batch: {e}")


@router.post("/batch/{batch_id}/execute", status_code=status.HTTP_202_ACCEPTED, operation_id="execute_batch_async")
def execute_batch_async(
    batch_id: str,
    background_tasks: BackgroundTasks,
    wait_for_all: bool = Query(True, description="Whether to wait for all results before completing"),
    strategy: ParallelizationStrategy = Query(ParallelizationStrategy.FULL, description="Strategy for parallelization"),
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Execute a batch of tool calls asynchronously.
    
    This endpoint starts the execution of a previously created batch of tool calls in the background.
    The execution will proceed asynchronously, and the status can be checked using the /batch/{batch_id} endpoint.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    
    try:
        batch = parallel_service.get_batch_status(batch_id, actor)
        if not batch:
            raise HTTPException(status_code=404, detail=f"Batch {batch_id} not found")
        
        # Start background execution
        background_tasks.add_task(
            _execute_batch_background,
            batch_id=batch_id,
            actor_id=actor_id,
            server=server,
            wait_for_all=wait_for_all,
            strategy=strategy
        )
        
        return JSONResponse(
            status_code=status.HTTP_202_ACCEPTED,
            content={
                "message": f"Batch {batch_id} execution started",
                "batch_id": batch_id
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting batch execution: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/agent/{agent_id}/execute", response_model=BatchToolResponse, operation_id="execute_tools_parallel")
async def execute_tools_parallel(
    agent_id: str,
    request: BatchToolRequest = Body(...),
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Execute multiple tool calls in parallel.
    
    This endpoint executes multiple tool calls in parallel for the specified agent.
    The execution can be configured with different parallelization strategies and timeout settings.
    Results are returned once all tools have completed execution or the timeout has been reached.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    
    try:
        # Create a batch to track execution
        batch = parallel_service.create_tool_batch(agent_id, request.tool_calls, actor)
        
        # Execute the batch
        start_time = __import__("time").time()
        results = await parallel_service.execute_tool_calls_parallel(
            tool_calls=request.tool_calls,
            user=actor,
            agent_id=agent_id,
            strategy=request.strategy or ParallelizationStrategy.FULL,
            timeout_seconds=request.timeout_seconds or 300,
            wait_for_all=request.wait_for_all if request.wait_for_all is not None else True
        )
        execution_time_ms = int((__import__("time").time() - start_time) * 1000)
        
        # Create and return the response
        return BatchToolResponse(
            batch_id=batch.id,
            results=results,
            complete=all(result.success for result in results),
            execution_time_ms=execution_time_ms
        )
    except Exception as e:
        logger.error(f"Error executing tools in parallel: {e}")
        raise HTTPException(status_code=500, detail=str(e))
