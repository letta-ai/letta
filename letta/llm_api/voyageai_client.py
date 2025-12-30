"""VoyageAI client for embeddings with support for contextual and multimodal models."""

from typing import List, Optional, Union

from letta.log import get_logger
from letta.schemas.embedding_config import EmbeddingConfig

logger = get_logger(__name__)

# Token limits for different VoyageAI models
VOYAGE_TOTAL_TOKEN_LIMITS = {
    "voyage-context-3": 32_000,
    "voyage-3.5-lite": 1_000_000,
    "voyage-3.5": 320_000,
    "voyage-2": 320_000,
    "voyage-3-large": 120_000,
    "voyage-code-3": 120_000,
    "voyage-large-2-instruct": 120_000,
    "voyage-finance-2": 120_000,
    "voyage-multilingual-2": 120_000,
    "voyage-law-2": 120_000,
    "voyage-large-2": 120_000,
    "voyage-3": 120_000,
    "voyage-3-lite": 120_000,
    "voyage-code-2": 120_000,
    "voyage-3-m-exp": 120_000,
    "voyage-multimodal-3": 32_000,
    "voyage-multimodal-3.5": 32_000,
}

# Default batch size for VoyageAI API
DEFAULT_BATCH_SIZE = 1000


def is_contextual_model(model_name: str) -> bool:
    """Check if a model is a contextualized embedding model."""
    return "context" in model_name.lower()


def is_multimodal_model(model_name: str) -> bool:
    """Check if a model is a multimodal embedding model."""
    return "multimodal" in model_name.lower()


def get_token_limit(model_name: str) -> int:
    """Get the token limit for a VoyageAI model."""
    return VOYAGE_TOTAL_TOKEN_LIMITS.get(model_name, 120_000)


async def voyageai_get_embeddings_async(
    texts: List[str],
    embedding_config: EmbeddingConfig,
    api_key: str,
    input_type: Optional[str] = None,
    truncation: bool = True,
    output_dimension: Optional[int] = None,
) -> List[List[float]]:
    """
    Get embeddings from VoyageAI API for a batch of texts.

    Args:
        texts: List of texts to embed
        embedding_config: Embedding configuration
        api_key: VoyageAI API key
        input_type: Optional input type ('query' or 'document')
        truncation: Whether to truncate texts that exceed token limit
        output_dimension: Optional output dimension for embeddings

    Returns:
        List of embedding vectors
    """
    try:
        import voyageai
    except ImportError as e:
        raise ImportError(
            "voyageai package is required for VoyageAI embeddings. "
            "Install it with: pip install voyageai"
        ) from e

    client = voyageai.AsyncClient(api_key=api_key, max_retries=0)

    model_name = embedding_config.embedding_model

    if is_contextual_model(model_name):
        # For contextual models, use contextualized_embed
        # Treats the batch as a single document with chunks
        result = await client.contextualized_embed(
            inputs=[texts],
            model=model_name,
            input_type=input_type,
            output_dimension=output_dimension,
        )
        return [list(emb) for emb in result.results[0].embeddings]
    else:
        # For regular models, use standard embed
        result = await client.embed(
            texts=texts,
            model=model_name,
            input_type=input_type,
            truncation=truncation,
            output_dimension=output_dimension,
        )
        return [list(emb) for emb in result.embeddings]


async def voyageai_multimodal_get_embeddings_async(
    inputs: List[Union[str, dict]],
    embedding_config: EmbeddingConfig,
    api_key: str,
    input_type: Optional[str] = None,
    output_dimension: Optional[int] = None,
) -> List[List[float]]:
    """
    Get multimodal embeddings from VoyageAI API.

    Args:
        inputs: List of text strings or multimodal content dicts
        embedding_config: Embedding configuration
        api_key: VoyageAI API key
        input_type: Optional input type ('query' or 'document')
        output_dimension: Optional output dimension for embeddings

    Returns:
        List of embedding vectors
    """
    try:
        import voyageai
    except ImportError as e:
        raise ImportError(
            "voyageai package is required for VoyageAI embeddings. "
            "Install it with: pip install voyageai"
        ) from e

    client = voyageai.AsyncClient(api_key=api_key, max_retries=0)

    result = await client.multimodal_embed(
        inputs=inputs,
        model=embedding_config.embedding_model,
        input_type=input_type,
        output_dimension=output_dimension,
    )
    return [list(emb) for emb in result.embeddings]


async def voyageai_count_tokens_async(
    texts: List[str],
    model: str,
    api_key: str,
) -> List[int]:
    """
    Count tokens for a list of texts using VoyageAI's tokenize API.

    Args:
        texts: List of texts to count tokens for
        model: Model name
        api_key: VoyageAI API key

    Returns:
        List of token counts for each text
    """
    try:
        import voyageai
    except ImportError as e:
        raise ImportError(
            "voyageai package is required for VoyageAI embeddings. "
            "Install it with: pip install voyageai"
        ) from e

    if not texts:
        return []

    client = voyageai.AsyncClient(api_key=api_key, max_retries=0)

    token_lists = client.tokenize(texts, model=model)
    return [len(token_list) for token_list in token_lists]
