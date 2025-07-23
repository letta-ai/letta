from typing import List, Optional

from letta.helpers.pinecone_utils import upsert_file_records_to_pinecone_index
from letta.log import get_logger
from letta.otel.tracing import log_event, trace_method
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.passage import Passage
from letta.schemas.user import User
from letta.services.file_processor.embedder.base_embedder import BaseEmbedder

try:
    PINECONE_AVAILABLE = True
except ImportError:
    PINECONE_AVAILABLE = False

logger = get_logger(__name__)


class PineconeEmbedder(BaseEmbedder):
    """Pinecone-based embedding generation"""

    def __init__(self, embedding_config: Optional[EmbeddingConfig] = None):
        if not PINECONE_AVAILABLE:
            raise ImportError("Pinecone package is not installed. Install it with: pip install pinecone")

        # set default embedding config if not provided
        if embedding_config is None:
            embedding_config = EmbeddingConfig.default_config(provider="pinecone")

        self.embedding_config = embedding_config
        super().__init__()

    @trace_method
    async def generate_embedded_passages(self, file_id: str, source_id: str, chunks: List[str], actor: User) -> List[Passage]:
        """Generate embeddings and upsert to Pinecone, then return Passage objects"""
        if not chunks:
            return []

        logger.info(f"Upserting {len(chunks)} chunks to Pinecone using namespace {source_id}")
        log_event(
            "embedder.generation_started",
            {
                "total_chunks": len(chunks),
                "file_id": file_id,
                "source_id": source_id,
            },
        )

        # Upsert records to Pinecone using source_id as namespace
        try:
            await upsert_file_records_to_pinecone_index(file_id=file_id, source_id=source_id, chunks=chunks, actor=actor)
            logger.info(f"Successfully kicked off upserting {len(chunks)} records to Pinecone")
            log_event(
                "embedder.upsert_started",
                {"records_upserted": len(chunks), "namespace": source_id, "file_id": file_id},
            )
        except Exception as e:
            logger.error(f"Failed to upsert records to Pinecone: {str(e)}")
            log_event("embedder.upsert_failed", {"error": str(e), "error_type": type(e).__name__})
            raise

        # Create Passage objects (without embeddings since Pinecone handles them)
        passages = []
        for i, text in enumerate(chunks):
            passage = Passage(
                text=text,
                file_id=file_id,
                source_id=source_id,
                embedding=None,  # Pinecone handles embeddings internally
                embedding_config=None,  # None
                organization_id=actor.organization_id,
            )
            passages.append(passage)

        logger.info(f"Successfully created {len(passages)} passages")
        log_event(
            "embedder.generation_completed",
            {"passages_created": len(passages), "total_chunks_processed": len(chunks), "file_id": file_id, "source_id": source_id},
        )
        return passages
