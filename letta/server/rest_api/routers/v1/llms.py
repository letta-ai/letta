from typing import TYPE_CHECKING, List, Optional

from fastapi import APIRouter, Depends, Query

from letta.schemas.enums import ProviderCategory, ProviderType
from letta.schemas.model import EmbeddingModel, Model
from letta.server.rest_api.dependencies import HeaderParams, get_headers, get_letta_server

if TYPE_CHECKING:
    from letta.server.server import SyncServer

router = APIRouter(prefix="/models", tags=["models", "llms"])


@router.get("/", response_model=List[Model], operation_id="list_models")
async def list_llm_models(
    provider_category: Optional[List[ProviderCategory]] = Query(None),
    provider_name: Optional[str] = Query(None),
    provider_type: Optional[ProviderType] = Query(None),
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    List available LLM models using the asynchronous implementation for improved performance.

    Returns Model format which extends LLMConfig with additional metadata fields.
    Legacy LLMConfig fields are marked as deprecated but still available for backward compatibility.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)

    models = await server.list_llm_models_async(
        provider_category=provider_category,
        provider_name=provider_name,
        provider_type=provider_type,
        actor=actor,
    )

    # Convert all models to the new Model schema
    return [Model.from_llm_config(model) for model in models]


@router.get("/embedding", response_model=List[EmbeddingModel], operation_id="list_embedding_models")
async def list_embedding_models(
    server: "SyncServer" = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    List available embedding models using the asynchronous implementation for improved performance.

    Returns EmbeddingModel format which extends EmbeddingConfig with additional metadata fields.
    Legacy EmbeddingConfig fields are marked as deprecated but still available for backward compatibility.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
    models = await server.list_embedding_models_async(actor=actor)

    # Convert all models to the new EmbeddingModel schema
    return [EmbeddingModel.from_embedding_config(model) for model in models]
