from typing import List, Optional

from letta.helpers.tpuf_client import TurbopufferClient
from letta.log import get_logger
from letta.otel.tracing import log_event, trace_method
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import VectorDBProvider
from letta.schemas.passage import Passage
from letta.schemas.user import User
from letta.services.file_processor.embedder.base_embedder import BaseEmbedder

logger = get_logger(__name__)


class TurbopufferEmbedder(BaseEmbedder):
    """Turbopuffer-based embedding generation and storage"""

    def __init__(self, embedding_config: Optional[EmbeddingConfig] = None):
        super().__init__()
        # set the vector db type for turbopuffer
        self.vector_db_type = VectorDBProvider.TPUF
        # use the default embedding config from TurbopufferClient if not provided
        self.embedding_config = embedding_config or TurbopufferClient.default_embedding_config
        self.tpuf_client = TurbopufferClient()

    @trace_method
    async def generate_embedded_passages(self, file_id: str, source_id: str, chunks: List[str], actor: User) -> List[Passage]:
        """Generate embeddings and store in Turbopuffer, then return Passage objects"""
        if not chunks:
            return []

        logger.info(f"Generating embeddings for {len(chunks)} chunks using Turbopuffer")
        log_event(
            "turbopuffer_embedder.generation_started",
            {
                "total_chunks": len(chunks),
                "file_id": file_id,
                "source_id": source_id,
                "embedding_model": self.embedding_config.embedding_model,
            },
        )

        try:
            # insert passages to Turbopuffer - it will handle embedding generation internally
            passages = await self.tpuf_client.insert_file_passages(
                source_id=source_id,
                file_id=file_id,
                text_chunks=chunks,
                organization_id=actor.organization_id,
                actor=actor,
            )

            logger.info(f"Successfully generated and stored {len(passages)} passages in Turbopuffer")
            log_event(
                "turbopuffer_embedder.generation_completed",
                {
                    "passages_created": len(passages),
                    "total_chunks_processed": len(chunks),
                    "file_id": file_id,
                    "source_id": source_id,
                },
            )
            return passages

        except Exception as e:
            logger.error(f"Failed to generate embeddings with Turbopuffer: {str(e)}")
            log_event(
                "turbopuffer_embedder.generation_failed",
                {"error": str(e), "error_type": type(e).__name__, "file_id": file_id, "source_id": source_id},
            )
            raise
