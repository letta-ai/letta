from typing import Dict, List, Optional

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query

from letta.log import get_logger
from letta.schemas.memory_management import MemoryManagementConfig
from letta.server.rest_api.utils import get_letta_server
from letta.server.server import SyncServer
from letta.services.memory_management_service import MemoryManagementService


router = APIRouter(prefix="/memory-management", tags=["memory-management"])
logger = get_logger(__name__)
memory_service = MemoryManagementService()


@router.get("/agent/{agent_id}/config", response_model=MemoryManagementConfig, operation_id="get_memory_management_config")
def get_memory_management_config(
    agent_id: str,
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Get the memory management configuration for an agent.
    
    This endpoint retrieves the current memory management configuration for the specified agent,
    including settings for summarization, compression, and pruning.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    
    try:
        config = memory_service.get_config(agent_id, actor)
        return config
    except Exception as e:
        logger.error(f"Error getting memory management config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/agent/{agent_id}/config", response_model=MemoryManagementConfig, operation_id="update_memory_management_config")
def update_memory_management_config(
    agent_id: str,
    config_update: Dict = Body(...),
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Update the memory management configuration for an agent.
    
    This endpoint updates the memory management configuration for the specified agent
    with the provided settings for summarization, compression, and pruning.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    
    try:
        updated_config = memory_service.update_config(agent_id, config_update, actor)
        return updated_config
    except Exception as e:
        logger.error(f"Error updating memory management config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/agent/{agent_id}/run", response_model=Dict, operation_id="run_memory_management")
def run_memory_management(
    agent_id: str,
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Run all memory management processes for an agent.
    
    This endpoint triggers memory management operations (summarization, compression, and pruning)
    for the specified agent based on its configuration.
    
    Returns a summary of the actions performed.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    
    try:
        result = memory_service.run_memory_management(agent_id, actor)
        return result
    except Exception as e:
        logger.error(f"Error running memory management: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/agent/{agent_id}/summarize", response_model=Dict, operation_id="run_memory_summarization")
def run_memory_summarization(
    agent_id: str,
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Run memory summarization for an agent.
    
    This endpoint triggers the memory summarization process for the specified agent,
    which condenses recent messages into summaries to reduce context size.
    
    Returns information about the summarization performed.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    
    try:
        summary = memory_service.process_memory_summarization(agent_id, actor)
        return {"summarized": bool(summary), "summary": summary}
    except Exception as e:
        logger.error(f"Error running memory summarization: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/agent/{agent_id}/compress", response_model=Dict, operation_id="run_memory_compression")
def run_memory_compression(
    agent_id: str,
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Run memory compression for an agent.
    
    This endpoint triggers the memory compression process for the specified agent,
    which compresses older memory items to reduce storage usage.
    
    Returns the number of passages compressed.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    
    try:
        compressed_count = memory_service.process_memory_compression(agent_id, actor)
        return {"compressed_count": compressed_count}
    except Exception as e:
        logger.error(f"Error running memory compression: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/agent/{agent_id}/prune", response_model=Dict, operation_id="run_memory_pruning")
def run_memory_pruning(
    agent_id: str,
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Run memory pruning for an agent.
    
    This endpoint triggers the memory pruning process for the specified agent,
    which removes less relevant or older memory items based on the pruning strategy.
    
    Returns the number of passages pruned.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    
    try:
        pruned_count = memory_service.process_memory_pruning(agent_id, actor)
        return {"pruned_count": pruned_count}
    except Exception as e:
        logger.error(f"Error running memory pruning: {e}")
        raise HTTPException(status_code=500, detail=str(e))
