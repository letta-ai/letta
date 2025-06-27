from typing import List

from letta.log import get_logger
from letta.schemas.agent import AgentState
from letta.schemas.enums import FileProcessingStatus
from letta.schemas.file import FileMetadata
from letta.schemas.passage import Passage
from letta.schemas.user import User
from letta.server.server import SyncServer
from letta.services.file_manager import FileManager
from letta.services.file_processor.chunker.line_chunker import LineChunker
from letta.services.file_processor.chunker.llama_index_chunker import LlamaIndexChunker
from letta.services.file_processor.embedder.openai_embedder import OpenAIEmbedder
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
        text_chunker: LlamaIndexChunker,
        embedder: OpenAIEmbedder,
        actor: User,
        max_file_size: int = 50 * 1024 * 1024,  # 50MB default
    ):
        self.file_parser = file_parser
        self.text_chunker = text_chunker
        self.line_chunker = LineChunker()
        self.embedder = embedder
        self.max_file_size = max_file_size
        self.file_manager = FileManager()
        self.source_manager = SourceManager()
        self.passage_manager = PassageManager()
        self.job_manager = JobManager()
        self.actor = actor

    # TODO: Factor this function out of SyncServer
    async def process(
        self, server: SyncServer, agent_states: List[AgentState], source_id: str, content: bytes, file_metadata: FileMetadata
    ) -> List[Passage]:
        filename = file_metadata.file_name

        # Create file as early as possible with no content
        file_metadata.processing_status = FileProcessingStatus.PARSING  # Parsing now
        file_metadata = await self.file_manager.create_file(file_metadata, self.actor)

        try:
            # Ensure we're working with bytes
            if isinstance(content, str):
                content = content.encode("utf-8")

            if len(content) > self.max_file_size:
                raise ValueError(f"PDF size exceeds maximum allowed size of {self.max_file_size} bytes")

            logger.info(f"Starting OCR extraction for {filename}")
            ocr_response = await self.file_parser.extract_text(content, mime_type=file_metadata.file_type)

            # update file with raw text
            raw_markdown_text = "".join([page.markdown for page in ocr_response.pages])
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
                raise ValueError("No text extracted from PDF")

            logger.info("Chunking extracted text")
            all_passages = []

            for page in ocr_response.pages:
                chunks = self.text_chunker.chunk_text(page)

                if not chunks:
                    raise ValueError("No chunks created from text")

                passages = await self.embedder.generate_embedded_passages(
                    file_id=file_metadata.id, source_id=source_id, chunks=chunks, actor=self.actor
                )
                all_passages.extend(passages)

            all_passages = await self.passage_manager.create_many_source_passages_async(
                passages=all_passages, file_metadata=file_metadata, actor=self.actor
            )

            logger.info(f"Successfully processed {filename}: {len(all_passages)} passages")

            # update job status
            await self.file_manager.update_file_status(
                file_id=file_metadata.id, actor=self.actor, processing_status=FileProcessingStatus.COMPLETED
            )

            return all_passages

        except Exception as e:
            logger.error(f"File processing failed for {filename}: {str(e)}")
            await self.file_manager.update_file_status(
                file_id=file_metadata.id, actor=self.actor, processing_status=FileProcessingStatus.ERROR, error_message=str(e)
            )

            return []
