"""Google AI embedder for Letta file processing pipeline.

This embedder uses Google's Generative AI SDK to generate embeddings for file chunks,
enabling semantic_search_files to work with Google AI embedding models.

Mirrors the interface of OpenAIEmbedder but uses the Google GenAI client instead.
"""

import asyncio
import time
from typing import List, Optional, Tuple

from google import genai
from google.genai.types import HttpOptions

from letta.log import get_logger
from letta.otel.tracing import log_event, trace_method
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.passage import Passage
from letta.schemas.user import User
from letta.services.file_processor.embedder.base_embedder import BaseEmbedder
from letta.settings import model_settings, settings

logger = get_logger(__name__)

# Global semaphore shared across ALL embedding operations to prevent overwhelming Google AI API
_GLOBAL_EMBEDDING_SEMAPHORE = asyncio.Semaphore(3)


class GoogleAIEmbedder(BaseEmbedder):
    """Google AI-based embedding generation for file processing"""

    def __init__(self, embedding_config: Optional[EmbeddingConfig] = None):
        super().__init__()

        self.embedding_config = embedding_config or EmbeddingConfig.default_config(model_name="gemini-embedding-001", provider="google_ai")

    def _get_client(self):
        """Create Google GenAI client using GEMINI_API_KEY."""
        timeout_ms = int(settings.llm_request_timeout_seconds * 1000)
        return genai.Client(
            api_key=model_settings.gemini_api_key,
            http_options=HttpOptions(timeout=timeout_ms),
        )

    @trace_method
    async def _embed_batch(self, batch: List[str], batch_indices: List[int]) -> List[Tuple[int, List[float]]]:
        """Embed a single batch using Google AI and return embeddings with their original indices."""
        log_event(
            "embedder.batch_started",
            {
                "batch_size": len(batch),
                "model": self.embedding_config.embedding_model,
                "provider": "google_ai",
            },
        )

        try:
            client = self._get_client()

            # Google AI rejects empty strings - replace with placeholder
            sanitized_batch = [text if text and text.strip() else " " for text in batch]

            response = await client.aio.models.embed_content(
                model=self.embedding_config.embedding_model,
                contents=sanitized_batch,
            )

            embeddings = [embedding.values for embedding in response.embeddings]

            log_event("embedder.batch_completed", {"batch_size": len(batch), "embeddings_generated": len(embeddings)})
            return [(idx, e) for idx, e in zip(batch_indices, embeddings)]

        except Exception as e:
            # If batch is large, try splitting in half
            if len(batch) > 1:
                logger.warning(f"[Google AI] Embedding batch of size {len(batch)} failed, splitting in half: {e}")
                log_event(
                    "embedder.batch_split_retry",
                    {
                        "original_batch_size": len(batch),
                        "error": str(e),
                        "split_size": len(batch) // 2,
                    },
                )

                mid = len(batch) // 2
                result1 = await self._embed_batch(batch[:mid], batch_indices[:mid])
                result2 = await self._embed_batch(batch[mid:], batch_indices[mid:])
                return result1 + result2
            else:
                raise

    @trace_method
    async def generate_embedded_passages(self, file_id: str, source_id: str, chunks: List[str], actor: User) -> List[Passage]:
        """Generate embeddings for chunks with batching and concurrent processing."""
        if not chunks:
            return []

        # Filter out empty or whitespace-only chunks
        valid_chunks = [(i, chunk) for i, chunk in enumerate(chunks) if chunk and chunk.strip()]

        if not valid_chunks:
            logger.warning(f"[Google AI] No valid text chunks found for file {file_id}")
            log_event(
                "embedder.no_valid_chunks",
                {"file_id": file_id, "source_id": source_id, "total_chunks": len(chunks)},
            )
            return []

        if len(valid_chunks) < len(chunks):
            logger.info(f"[Google AI] Filtered out {len(chunks) - len(valid_chunks)} empty chunks from {len(chunks)} total")

        chunk_indices = [i for i, _ in valid_chunks]
        chunks_to_embed = [chunk for _, chunk in valid_chunks]

        embedding_start = time.time()
        logger.info(f"[Google AI] Generating embeddings for {len(chunks_to_embed)} chunks using {self.embedding_config.embedding_model}")
        log_event(
            "embedder.generation_started",
            {
                "total_chunks": len(chunks_to_embed),
                "model": self.embedding_config.embedding_model,
                "provider": "google_ai",
                "batch_size": self.embedding_config.batch_size,
                "file_id": file_id,
                "source_id": source_id,
            },
        )

        # Create batches - Google AI supports up to 100 texts per call
        batch_size = min(self.embedding_config.batch_size, 100)
        batches = []
        batch_indices_list = []

        for i in range(0, len(chunks_to_embed), batch_size):
            batch = chunks_to_embed[i : i + batch_size]
            indices = list(range(i, min(i + batch_size, len(chunks_to_embed))))
            batches.append(batch)
            batch_indices_list.append(indices)

        logger.info(f"[Google AI] Processing {len(batches)} batches (batch_size={batch_size})")

        # Use global semaphore to limit concurrent requests
        async def process(batch: List[str], indices: List[int]):
            async with _GLOBAL_EMBEDDING_SEMAPHORE:
                try:
                    return await self._embed_batch(batch, indices)
                except Exception as e:
                    logger.error(f"[Google AI] Failed to embed batch of size {len(batch)}: {e}")
                    log_event("embedder.batch_failed", {"batch_size": len(batch), "error": str(e)})
                    raise

        tasks = [process(batch, indices) for batch, indices in zip(batches, batch_indices_list)]
        results = await asyncio.gather(*tasks)

        # Flatten and sort by original index
        indexed_embeddings = []
        for batch_result in results:
            indexed_embeddings.extend(batch_result)
        indexed_embeddings.sort(key=lambda x: x[0])

        # Create Passage objects
        passages = []
        for (idx, embedding), text in zip(indexed_embeddings, chunks_to_embed):
            passage = Passage(
                text=text,
                file_id=file_id,
                source_id=source_id,
                embedding=embedding,
                embedding_config=self.embedding_config,
                organization_id=actor.organization_id,
            )
            passages.append(passage)

        embedding_duration = time.time() - embedding_start
        logger.info(f"[Google AI] Generated {len(passages)} embeddings in {embedding_duration:.2f}s")
        log_event(
            "embedder.generation_completed",
            {
                "passages_created": len(passages),
                "total_chunks_processed": len(chunks_to_embed),
                "file_id": file_id,
                "source_id": source_id,
                "duration_seconds": embedding_duration,
            },
        )
        return passages
