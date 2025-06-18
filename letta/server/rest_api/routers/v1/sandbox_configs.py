import os
import shutil
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from letta.log import get_logger
from letta.schemas.environment_variables import SandboxEnvironmentVariable as PydanticEnvVar
from letta.schemas.environment_variables import SandboxEnvironmentVariableCreate, SandboxEnvironmentVariableUpdate
from letta.schemas.sandbox_config import LocalSandboxConfig
from letta.schemas.sandbox_config import SandboxConfig as PydanticSandboxConfig
from letta.schemas.sandbox_config import SandboxConfigCreate, SandboxConfigUpdate, SandboxType
from letta.server.rest_api.utils import get_letta_server, get_user_id
from letta.server.server import SyncServer
from letta.services.helpers.tool_execution_helper import create_venv_for_local_sandbox, install_pip_requirements_for_sandbox

router = APIRouter(prefix="/sandbox-config", tags=["sandbox-config"])

logger = get_logger(__name__)

### Sandbox Config Routes


@router.post("/", response_model=PydanticSandboxConfig)
async def create_sandbox_config(
    config_create: SandboxConfigCreate,
    server: SyncServer = Depends(get_letta_server),
    actor_id: str = Depends(get_user_id),
):
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)

    return await server.sandbox_config_manager.create_or_update_sandbox_config_async(config_create, actor)


@router.post("/e2b/default", response_model=PydanticSandboxConfig)
async def create_default_e2b_sandbox_config(
    server: SyncServer = Depends(get_letta_server),
    actor_id: str = Depends(get_user_id),
):
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    return await server.sandbox_config_manager.get_or_create_default_sandbox_config_async(sandbox_type=SandboxType.E2B, actor=actor)


@router.post("/local/default", response_model=PydanticSandboxConfig)
async def create_default_local_sandbox_config(
    server: SyncServer = Depends(get_letta_server),
    actor_id: str = Depends(get_user_id),
):
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    return await server.sandbox_config_manager.get_or_create_default_sandbox_config_async(sandbox_type=SandboxType.LOCAL, actor=actor)


@router.post("/local", response_model=PydanticSandboxConfig)
async def create_custom_local_sandbox_config(
    local_sandbox_config: LocalSandboxConfig,
    server: SyncServer = Depends(get_letta_server),
    actor_id: str = Depends(get_user_id),
):
    """
    Create or update a custom LocalSandboxConfig, including pip_requirements.
    """
    # Ensure the incoming config is of type LOCAL
    if local_sandbox_config.type != SandboxType.LOCAL:
        raise HTTPException(
            status_code=400,
            detail=f"Provided config must be of type '{SandboxType.LOCAL.value}'.",
        )

    # Retrieve the user (actor)
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)

    # Wrap the LocalSandboxConfig into a SandboxConfigCreate
    sandbox_config_create = SandboxConfigCreate(config=local_sandbox_config)

    # Use the manager to create or update the sandbox config
    sandbox_config = await server.sandbox_config_manager.create_or_update_sandbox_config_async(sandbox_config_create, actor=actor)

    return sandbox_config


@router.patch("/{sandbox_config_id}", response_model=PydanticSandboxConfig)
async def update_sandbox_config(
    sandbox_config_id: str,
    config_update: SandboxConfigUpdate,
    server: SyncServer = Depends(get_letta_server),
    actor_id: str = Depends(get_user_id),
):
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    return await server.sandbox_config_manager.update_sandbox_config_async(sandbox_config_id, config_update, actor)


@router.delete("/{sandbox_config_id}", status_code=204)
async def delete_sandbox_config(
    sandbox_config_id: str,
    server: SyncServer = Depends(get_letta_server),
    actor_id: str = Depends(get_user_id),
):
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    await server.sandbox_config_manager.delete_sandbox_config_async(sandbox_config_id, actor)


@router.get("/", response_model=List[PydanticSandboxConfig])
async def list_sandbox_configs(
    limit: int = Query(1000, description="Number of results to return"),
    after: Optional[str] = Query(None, description="Pagination cursor to fetch the next set of results"),
    sandbox_type: Optional[SandboxType] = Query(None, description="Filter for this specific sandbox type"),
    server: SyncServer = Depends(get_letta_server),
    actor_id: str = Depends(get_user_id),
):
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    return await server.sandbox_config_manager.list_sandbox_configs_async(actor, limit=limit, after=after, sandbox_type=sandbox_type)


@router.post("/local/recreate-venv", response_model=PydanticSandboxConfig)
async def force_recreate_local_sandbox_venv(
    server: SyncServer = Depends(get_letta_server),
    actor_id: str = Depends(get_user_id),
):
    """
    Forcefully recreate the virtual environment for the local sandbox.
    Deletes and recreates the venv, then reinstalls required dependencies.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)

    # Retrieve the local sandbox config
    sbx_config = await server.sandbox_config_manager.get_or_create_default_sandbox_config_async(sandbox_type=SandboxType.LOCAL, actor=actor)

    local_configs = sbx_config.get_local_config()
    sandbox_dir = os.path.expanduser(local_configs.sandbox_dir)  # Expand tilde
    venv_path = os.path.join(sandbox_dir, local_configs.venv_name)

    # Check if venv exists, and delete if necessary
    if os.path.isdir(venv_path):
        try:
            shutil.rmtree(venv_path)
            logger.info(f"Deleted existing virtual environment at: {venv_path}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete existing venv: {e}")

    # Recreate the virtual environment
    try:
        create_venv_for_local_sandbox(sandbox_dir_path=sandbox_dir, venv_path=str(venv_path), env=os.environ.copy(), force_recreate=True)
        logger.info(f"Successfully recreated virtual environment at: {venv_path}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to recreate venv: {e}")

    # Install pip requirements
    try:
        install_pip_requirements_for_sandbox(local_configs=local_configs, env=os.environ.copy())
        logger.info(f"Successfully installed pip requirements for venv at: {venv_path}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to install pip requirements: {e}")

    return sbx_config


### Sandbox Environment Variable Routes


@router.post("/{sandbox_config_id}/environment-variable", response_model=PydanticEnvVar)
async def create_sandbox_env_var(
    sandbox_config_id: str,
    env_var_create: SandboxEnvironmentVariableCreate,
    server: SyncServer = Depends(get_letta_server),
    actor_id: str = Depends(get_user_id),
):
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    return await server.sandbox_config_manager.create_sandbox_env_var_async(env_var_create, sandbox_config_id, actor)


@router.patch("/environment-variable/{env_var_id}", response_model=PydanticEnvVar)
async def update_sandbox_env_var(
    env_var_id: str,
    env_var_update: SandboxEnvironmentVariableUpdate,
    server: SyncServer = Depends(get_letta_server),
    actor_id: str = Depends(get_user_id),
):
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    return await server.sandbox_config_manager.update_sandbox_env_var_async(env_var_id, env_var_update, actor)


@router.delete("/environment-variable/{env_var_id}", status_code=204)
async def delete_sandbox_env_var(
    env_var_id: str,
    server: SyncServer = Depends(get_letta_server),
    actor_id: str = Depends(get_user_id),
):
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    await server.sandbox_config_manager.delete_sandbox_env_var_async(env_var_id, actor)


@router.get("/{sandbox_config_id}/environment-variable", response_model=List[PydanticEnvVar])
async def list_sandbox_env_vars(
    sandbox_config_id: str,
    limit: int = Query(1000, description="Number of results to return"),
    after: Optional[str] = Query(None, description="Pagination cursor to fetch the next set of results"),
    server: SyncServer = Depends(get_letta_server),
    actor_id: str = Depends(get_user_id),
):
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    return await server.sandbox_config_manager.list_sandbox_env_vars_async(sandbox_config_id, actor, limit=limit, after=after)
