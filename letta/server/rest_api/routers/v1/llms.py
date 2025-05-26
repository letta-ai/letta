from typing import TYPE_CHECKING, List, Optional

from fastapi import APIRouter, Depends, Header, Query

from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import ProviderCategory, ProviderType
from letta.schemas.llm_config import LLMConfig
from letta.server.rest_api.utils import get_letta_server

if TYPE_CHECKING:
    from letta.server.server import SyncServer

router = APIRouter(prefix="/models", tags=["models", "llms"])


@router.get("/", response_model=List[LLMConfig], operation_id="list_models")
async def list_llm_models(
    provider_category: Optional[List[ProviderCategory]] = Query(None),
    provider_name: Optional[str] = Query(None),
    provider_type: Optional[ProviderType] = Query(None),
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
    # Extract user_id from header, default to None if not present
):
    """List available LLM models using the asynchronous implementation for improved performance"""
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)

    models = await server.list_llm_models_async(
        provider_category=provider_category,
        provider_name=provider_name,
        provider_type=provider_type,
        actor=actor,
    )

    return models


@router.get("/embedding", response_model=List[EmbeddingConfig], operation_id="list_embedding_models")
async def list_embedding_models(
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
    # Extract user_id from header, default to None if not present
):
    """List available embedding models using the asynchronous implementation for improved performance"""
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    models = await server.list_embedding_models_async(actor=actor)

    return models
