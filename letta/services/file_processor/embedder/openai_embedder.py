import asyncio
from typing import List, Optional, Tuple

import openai

from letta.log import get_logger
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.passage import Passage
from letta.schemas.user import User
from letta.settings import model_settings

logger = get_logger(__name__)


class OpenAIEmbedder:
    """OpenAI-based embedding generation"""

    def __init__(self, embedding_config: Optional[EmbeddingConfig] = None):
        self.default_embedding_config = (
            EmbeddingConfig.default_config(model_name="text-embedding-3-small", provider="openai")
            if model_settings.openai_api_key
            else EmbeddingConfig.default_config(model_name="letta")
        )
        self.embedding_config = embedding_config or self.default_embedding_config

        # TODO: Unify to global OpenAI client
        self.client = openai.AsyncOpenAI(api_key=model_settings.openai_api_key)
        self.max_batch = 1024
        self.max_concurrent_requests = 20

    async def _embed_batch(self, batch: List[str], batch_indices: List[int]) -> List[Tuple[int, List[float]]]:
        """Embed a single batch and return embeddings with their original indices"""
        response = await self.client.embeddings.create(model=self.embedding_config.embedding_model, input=batch)
        return [(idx, res.embedding) for idx, res in zip(batch_indices, response.data)]

    async def generate_embedded_passages(self, file_id: str, source_id: str, chunks: List[str], actor: User) -> List[Passage]:
        """Generate embeddings for chunks with batching and concurrent processing"""
        if not chunks:
            return []

        logger.info(f"Generating embeddings for {len(chunks)} chunks using {self.embedding_config.embedding_model}")

        # Create batches with their original indices
        batches = []
        batch_indices = []

        for i in range(0, len(chunks), self.max_batch):
            batch = chunks[i : i + self.max_batch]
            indices = list(range(i, min(i + self.max_batch, len(chunks))))
            batches.append(batch)
            batch_indices.append(indices)

        logger.info(f"Processing {len(batches)} batches")

        async def process(batch: List[str], indices: List[int]):
            try:
                return await self._embed_batch(batch, indices)
            except Exception as e:
                logger.error(f"Failed to embed batch of size {len(batch)}: {str(e)}")
                raise

        # Execute all batches concurrently with semaphore control
        tasks = [process(batch, indices) for batch, indices in zip(batches, batch_indices)]

        results = await asyncio.gather(*tasks)

        # Flatten results and sort by original index
        indexed_embeddings = []
        for batch_result in results:
            indexed_embeddings.extend(batch_result)

        # Sort by index to maintain original order
        indexed_embeddings.sort(key=lambda x: x[0])

        # Create Passage objects in original order
        passages = []
        for (idx, embedding), text in zip(indexed_embeddings, chunks):
            passage = Passage(
                text=text,
                file_id=file_id,
                source_id=source_id,
                embedding=embedding,
                embedding_config=self.embedding_config,
                organization_id=actor.organization_id,
            )
            passages.append(passage)

        logger.info(f"Successfully generated {len(passages)} embeddings")
        return passages
