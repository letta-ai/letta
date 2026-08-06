"""VoyageAI embedder with token-based batching for optimal API usage."""

import asyncio
from typing import Generator, List, Optional, Tuple

from letta.llm_api.voyageai_client import (
    DEFAULT_BATCH_SIZE,
    get_token_limit,
    is_contextual_model,
    is_multimodal_model,
    voyageai_count_tokens_async,
    voyageai_get_embeddings_async,
)
from letta.log import get_logger
from letta.otel.tracing import log_event, trace_method
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.passage import Passage
from letta.schemas.user import User
from letta.services.file_processor.embedder.base_embedder import BaseEmbedder
from letta.settings import model_settings

logger = get_logger(__name__)


class VoyageAIEmbedder(BaseEmbedder):
    """VoyageAI-based embedding generation with smart token-based batching."""

    def __init__(self, embedding_config: Optional[EmbeddingConfig] = None):
        super().__init__()

        if embedding_config is None:
            raise ValueError("VoyageAI embedder requires an embedding_config")

        self.embedding_config = embedding_config

        # Get API key from settings
        if not model_settings.voyageai_api_key:
            raise ValueError("VoyageAI API key not found in settings. Set VOYAGEAI_API_KEY environment variable.")

        self.api_key = model_settings.voyageai_api_key

    def _build_batches(
        self, texts: List[str], token_counts: List[int]
    ) -> Generator[Tuple[List[str], List[int]], None, None]:
        """
        Generate batches of texts based on token limits using a generator.

        Args:
            texts: List of texts to batch
            token_counts: Pre-computed token counts for each text

        Yields:
            Tuples of (batch_texts, batch_indices)
        """
        if not texts:
            return

        model_name = self.embedding_config.embedding_model
        max_tokens_per_batch = get_token_limit(model_name)
        max_items_per_batch = min(self.embedding_config.batch_size or DEFAULT_BATCH_SIZE, DEFAULT_BATCH_SIZE)

        current_batch: List[str] = []
        current_batch_indices: List[int] = []
        current_batch_tokens = 0

        for i, (text, n_tokens) in enumerate(zip(texts, token_counts)):
            # Check if adding this text would exceed limits
            if current_batch and (
                len(current_batch) >= max_items_per_batch or (current_batch_tokens + n_tokens > max_tokens_per_batch)
            ):
                # Yield the current batch and start a new one
                yield (current_batch, current_batch_indices)
                current_batch = []
                current_batch_indices = []
                current_batch_tokens = 0

            current_batch.append(text)
            current_batch_indices.append(i)
            current_batch_tokens += n_tokens

        # Yield the last batch if it has any items
        if current_batch:
            yield (current_batch, current_batch_indices)

    @trace_method
    async def _embed_batch(
        self, batch: List[str], batch_indices: List[int], input_type: Optional[str] = None
    ) -> List[Tuple[int, List[float]]]:
        """
        Embed a single batch and return embeddings with their original indices.

        Args:
            batch: List of texts to embed
            batch_indices: Original indices of the texts
            input_type: Optional input type ('query' or 'document')

        Returns:
            List of tuples (original_index, embedding)
        """
        log_event(
            "voyageai_embedder.batch_started",
            {
                "batch_size": len(batch),
                "model": self.embedding_config.embedding_model,
                "is_contextual": is_contextual_model(self.embedding_config.embedding_model),
                "is_multimodal": is_multimodal_model(self.embedding_config.embedding_model),
            },
        )

        try:
            embeddings = await voyageai_get_embeddings_async(
                texts=batch,
                embedding_config=self.embedding_config,
                api_key=self.api_key,
                input_type=input_type or "document",  # Default to 'document' for file chunks
                truncation=True,
            )

            log_event(
                "voyageai_embedder.batch_completed",
                {"batch_size": len(batch), "embeddings_generated": len(embeddings)},
            )

            return [(idx, emb) for idx, emb in zip(batch_indices, embeddings)]

        except Exception as e:
            logger.error(f"Failed to embed batch of size {len(batch)}: {e}")
            log_event(
                "voyageai_embedder.batch_failed",
                {"batch_size": len(batch), "error": str(e), "error_type": type(e).__name__},
            )
            raise

    @trace_method
    async def generate_embedded_passages(
        self, file_id: str, source_id: str, chunks: List[str], actor: User
    ) -> List[Passage]:
        """
        Generate embeddings for chunks with token-based batching.

        Args:
            file_id: ID of the file being processed
            source_id: ID of the source
            chunks: List of text chunks to embed
            actor: User performing the operation

        Returns:
            List of Passage objects with embeddings
        """
        if not chunks:
            return []

        logger.info(
            f"Generating VoyageAI embeddings for {len(chunks)} chunks using {self.embedding_config.embedding_model}"
        )
        log_event(
            "voyageai_embedder.generation_started",
            {
                "total_chunks": len(chunks),
                "model": self.embedding_config.embedding_model,
                "is_contextual": is_contextual_model(self.embedding_config.embedding_model),
                "file_id": file_id,
                "source_id": source_id,
            },
        )

        # Step 1: Count tokens for all chunks upfront
        logger.info("Counting tokens for all chunks...")
        token_counts = await voyageai_count_tokens_async(
            texts=chunks, model=self.embedding_config.embedding_model, api_key=self.api_key
        )

        total_tokens = sum(token_counts)
        log_event(
            "voyageai_embedder.tokenization_completed",
            {
                "total_chunks": len(chunks),
                "total_tokens": total_tokens,
                "avg_tokens_per_chunk": total_tokens / len(chunks) if chunks else 0,
            },
        )

        # Step 2: Create optimal batches based on token counts
        batches = []
        batch_indices = []

        for batch_texts, indices in self._build_batches(chunks, token_counts):
            batches.append(batch_texts)
            batch_indices.append(indices)

        logger.info(
            f"Created {len(batches)} token-optimized batches "
            f"(avg: {len(chunks) / len(batches):.1f} chunks/batch, "
            f"{total_tokens / len(batches):.1f} tokens/batch)"
        )
        log_event(
            "voyageai_embedder.batching_completed",
            {
                "total_batches": len(batches),
                "total_chunks": len(chunks),
                "total_tokens": total_tokens,
                "avg_chunks_per_batch": len(chunks) / len(batches) if batches else 0,
                "avg_tokens_per_batch": total_tokens / len(batches) if batches else 0,
            },
        )

        # Step 3: Process all batches concurrently
        async def process(batch: List[str], indices: List[int]):
            try:
                return await self._embed_batch(batch, indices)
            except Exception as e:
                logger.error(f"Failed to embed batch of size {len(batch)}: {e}")
                raise

        tasks = [process(batch, indices) for batch, indices in zip(batches, batch_indices)]

        log_event("voyageai_embedder.concurrent_processing_started", {"concurrent_tasks": len(tasks)})
        results = await asyncio.gather(*tasks)
        log_event("voyageai_embedder.concurrent_processing_completed", {"batches_processed": len(results)})

        # Step 4: Flatten results and sort by original index
        indexed_embeddings = []
        for batch_result in results:
            indexed_embeddings.extend(batch_result)

        # Sort by index to maintain original order
        indexed_embeddings.sort(key=lambda x: x[0])

        # Step 5: Create Passage objects in original order
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

        logger.info(f"Successfully generated {len(passages)} VoyageAI embeddings")
        log_event(
            "voyageai_embedder.generation_completed",
            {
                "passages_created": len(passages),
                "total_chunks_processed": len(chunks),
                "file_id": file_id,
                "source_id": source_id,
            },
        )

        return passages
