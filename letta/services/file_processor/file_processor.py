from typing import List

from letta.log import get_logger
from letta.otel.context import get_ctx_attributes
from letta.otel.tracing import log_event, trace_method
from letta.schemas.agent import AgentState
from letta.schemas.enums import FileProcessingStatus
from letta.schemas.file import FileMetadata
from letta.schemas.passage import Passage
from letta.schemas.user import User
from letta.server.server import SyncServer
from letta.services.file_manager import FileManager
from letta.services.file_processor.chunker.line_chunker import LineChunker
from letta.services.file_processor.chunker.llama_index_chunker import LlamaIndexChunker
from letta.services.file_processor.embedder.base_embedder import BaseEmbedder
from letta.services.file_processor.parser.mistral_parser import MistralFileParser
from letta.services.job_manager import JobManager
from letta.services.passage_manager import PassageManager
from letta.services.source_manager import SourceManager

logger = get_logger(__name__)


class FileProcessor:
    """Main PDF processing orchestrator"""

    def __init__(
        self,
        file_parser: MistralFileParser,
        embedder: BaseEmbedder,
        actor: User,
        using_pinecone: bool,
        max_file_size: int = 50 * 1024 * 1024,  # 50MB default
    ):
        self.file_parser = file_parser
        self.line_chunker = LineChunker()
        self.embedder = embedder
        self.max_file_size = max_file_size
        self.file_manager = FileManager()
        self.source_manager = SourceManager()
        self.passage_manager = PassageManager()
        self.job_manager = JobManager()
        self.actor = actor
        self.using_pinecone = using_pinecone

    async def _chunk_and_embed_with_fallback(self, file_metadata: FileMetadata, ocr_response, source_id: str) -> List:
        """Chunk text and generate embeddings with fallback to default chunker if needed"""
        filename = file_metadata.file_name

        # Create file-type-specific chunker
        text_chunker = LlamaIndexChunker(file_type=file_metadata.file_type)

        # First attempt with file-specific chunker
        try:
            all_chunks = []
            for page in ocr_response.pages:
                chunks = text_chunker.chunk_text(page)
                if not chunks:
                    log_event("file_processor.chunking_failed", {"filename": filename, "page_index": ocr_response.pages.index(page)})
                    raise ValueError("No chunks created from text")
                all_chunks.extend(chunks)

            all_passages = await self.embedder.generate_embedded_passages(
                file_id=file_metadata.id, source_id=source_id, chunks=all_chunks, actor=self.actor
            )
            return all_passages

        except Exception as e:
            logger.warning(f"Failed to chunk/embed with file-specific chunker for {filename}: {str(e)}. Retrying with default chunker.")
            log_event("file_processor.embedding_failed_retrying", {"filename": filename, "error": str(e), "error_type": type(e).__name__})

            # Retry with default chunker
            try:
                logger.info(f"Retrying chunking with default SentenceSplitter for {filename}")
                all_chunks = []

                for page in ocr_response.pages:
                    chunks = text_chunker.default_chunk_text(page)
                    if not chunks:
                        log_event(
                            "file_processor.default_chunking_failed", {"filename": filename, "page_index": ocr_response.pages.index(page)}
                        )
                        raise ValueError("No chunks created from text with default chunker")
                    all_chunks.extend(chunks)

                all_passages = await self.embedder.generate_embedded_passages(
                    file_id=file_metadata.id, source_id=source_id, chunks=all_chunks, actor=self.actor
                )
                logger.info(f"Successfully generated passages with default chunker for {filename}")
                log_event("file_processor.default_chunking_success", {"filename": filename, "total_chunks": len(all_chunks)})
                return all_passages

            except Exception as fallback_error:
                logger.error("Default chunking also failed for %s: %s", filename, fallback_error)
                log_event(
                    "file_processor.default_chunking_also_failed",
                    {"filename": filename, "fallback_error": str(fallback_error), "fallback_error_type": type(fallback_error).__name__},
                )
                raise fallback_error

    # TODO: Factor this function out of SyncServer
    @trace_method
    async def process(
        self, server: SyncServer, agent_states: List[AgentState], source_id: str, content: bytes, file_metadata: FileMetadata
    ) -> List[Passage]:
        filename = file_metadata.file_name

        # Create file as early as possible with no content
        file_metadata.processing_status = FileProcessingStatus.PARSING  # Parsing now
        file_metadata = await self.file_manager.create_file(file_metadata, self.actor)
        log_event(
            "file_processor.file_created",
            {
                "file_id": str(file_metadata.id),
                "filename": filename,
                "file_type": file_metadata.file_type,
                "status": FileProcessingStatus.PARSING.value,
            },
        )

        try:
            # Ensure we're working with bytes
            if isinstance(content, str):
                content = content.encode("utf-8")

            from letta.otel.metric_registry import MetricRegistry

            MetricRegistry().file_process_bytes_histogram.record(len(content), attributes=get_ctx_attributes())

            if len(content) > self.max_file_size:
                log_event(
                    "file_processor.size_limit_exceeded",
                    {"filename": filename, "file_size": len(content), "max_file_size": self.max_file_size},
                )
                raise ValueError(f"PDF size exceeds maximum allowed size of {self.max_file_size} bytes")

            logger.info(f"Starting OCR extraction for {filename}")
            log_event("file_processor.ocr_started", {"filename": filename, "file_size": len(content), "mime_type": file_metadata.file_type})
            ocr_response = await self.file_parser.extract_text(content, mime_type=file_metadata.file_type)

            # update file with raw text
            raw_markdown_text = "".join([page.markdown for page in ocr_response.pages])
            log_event(
                "file_processor.ocr_completed",
                {"filename": filename, "pages_extracted": len(ocr_response.pages), "text_length": len(raw_markdown_text)},
            )
            file_metadata = await self.file_manager.update_file_status(
                file_id=file_metadata.id, actor=self.actor, processing_status=FileProcessingStatus.EMBEDDING
            )
            file_metadata = await self.file_manager.upsert_file_content(file_id=file_metadata.id, text=raw_markdown_text, actor=self.actor)

            await server.insert_file_into_context_windows(
                source_id=source_id,
                file_metadata_with_content=file_metadata,
                actor=self.actor,
                agent_states=agent_states,
            )

            if not ocr_response or len(ocr_response.pages) == 0:
                log_event(
                    "file_processor.ocr_no_text",
                    {
                        "filename": filename,
                        "ocr_response_empty": not ocr_response,
                        "pages_count": len(ocr_response.pages) if ocr_response else 0,
                    },
                )
                raise ValueError("No text extracted from PDF")

            logger.info("Chunking extracted text")
            log_event("file_processor.chunking_started", {"filename": filename, "pages_to_process": len(ocr_response.pages)})

            # Chunk and embed with fallback logic
            all_passages = await self._chunk_and_embed_with_fallback(
                file_metadata=file_metadata, ocr_response=ocr_response, source_id=source_id
            )

            if not self.using_pinecone:
                all_passages = await self.passage_manager.create_many_source_passages_async(
                    passages=all_passages, file_metadata=file_metadata, actor=self.actor
                )
                log_event("file_processor.passages_created", {"filename": filename, "total_passages": len(all_passages)})

            logger.info(f"Successfully processed {filename}: {len(all_passages)} passages")
            log_event(
                "file_processor.processing_completed",
                {
                    "filename": filename,
                    "file_id": str(file_metadata.id),
                    "total_passages": len(all_passages),
                    "status": FileProcessingStatus.COMPLETED.value,
                },
            )

            # update job status
            if not self.using_pinecone:
                await self.file_manager.update_file_status(
                    file_id=file_metadata.id, actor=self.actor, processing_status=FileProcessingStatus.COMPLETED
                )
            else:
                await self.file_manager.update_file_status(
                    file_id=file_metadata.id, actor=self.actor, total_chunks=len(all_passages), chunks_embedded=0
                )

            return all_passages

        except Exception as e:
            logger.error("File processing failed for %s: %s", filename, e)
            log_event(
                "file_processor.processing_failed",
                {
                    "filename": filename,
                    "file_id": str(file_metadata.id),
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "status": FileProcessingStatus.ERROR.value,
                },
            )
            await self.file_manager.update_file_status(
                file_id=file_metadata.id, actor=self.actor, processing_status=FileProcessingStatus.ERROR, error_message=str(e)
            )

            return []
