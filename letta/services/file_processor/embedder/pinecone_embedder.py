from typing import List, Optional

from letta.helpers.pinecone_utils import upsert_file_records_to_pinecone_index
from letta.log import get_logger
from letta.otel.tracing import log_event, trace_method
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import VectorDBProvider
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
        super().__init__()
        # set the vector db type for pinecone
        self.vector_db_type = VectorDBProvider.PINECONE

        if not PINECONE_AVAILABLE:
            raise ImportError("Pinecone package is not installed. Install it with: pip install pinecone")

        # set default embedding config if not provided
        if embedding_config is None:
            embedding_config = EmbeddingConfig.default_config(provider="pinecone")

        self.embedding_config = embedding_config

    @trace_method
    async def generate_embedded_passages(self, file_id: str, source_id: str, chunks: List[str], actor: User) -> List[Passage]:
        """Generate embeddings and upsert to Pinecone, then return Passage objects"""
        if not chunks:
            return []

        # Filter out empty or whitespace-only chunks
        valid_chunks = [chunk for chunk in chunks if chunk and chunk.strip()]

        if not valid_chunks:
            logger.warning(f"No valid text chunks found for file {file_id}. PDF may contain only images without text layer.")
            log_event(
                "pinecone_embedder.no_valid_chunks",
                {"file_id": file_id, "source_id": source_id, "total_chunks": len(chunks), "reason": "All chunks empty or whitespace-only"},
            )
            return []

        if len(valid_chunks) < len(chunks):
            logger.info(f"Filtered out {len(chunks) - len(valid_chunks)} empty chunks from {len(chunks)} total")
            log_event(
                "pinecone_embedder.chunks_filtered",
                {
                    "file_id": file_id,
                    "original_chunks": len(chunks),
                    "valid_chunks": len(valid_chunks),
                    "filtered_chunks": len(chunks) - len(valid_chunks),
                },
            )

        logger.info(f"Upserting {len(valid_chunks)} chunks to Pinecone using namespace {source_id}")
        log_event(
            "embedder.generation_started",
            {
                "total_chunks": len(valid_chunks),
                "file_id": file_id,
                "source_id": source_id,
            },
        )

        # Upsert records to Pinecone using source_id as namespace
        try:
            await upsert_file_records_to_pinecone_index(file_id=file_id, source_id=source_id, chunks=valid_chunks, actor=actor)
            logger.info(f"Successfully kicked off upserting {len(valid_chunks)} records to Pinecone")
            log_event(
                "embedder.upsert_started",
                {"records_upserted": len(valid_chunks), "namespace": source_id, "file_id": file_id},
            )
        except Exception as e:
            logger.error(f"Failed to upsert records to Pinecone: {str(e)}")
            log_event("embedder.upsert_failed", {"error": str(e), "error_type": type(e).__name__})
            raise

        # Create Passage objects (without embeddings since Pinecone handles them)
        passages = []
        for i, text in enumerate(valid_chunks):
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
            {"passages_created": len(passages), "total_chunks_processed": len(valid_chunks), "file_id": file_id, "source_id": source_id},
        )
        return passages
