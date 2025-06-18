import mimetypes
from typing import List, Optional

from fastapi import UploadFile

from letta.log import get_logger
from letta.schemas.agent import AgentState
from letta.schemas.enums import FileProcessingStatus, JobStatus
from letta.schemas.file import FileMetadata
from letta.schemas.job import Job, JobUpdate
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
        self,
        server: SyncServer,
        agent_states: List[AgentState],
        source_id: str,
        content: bytes,
        file: UploadFile,
        job: Optional[Job] = None,
    ) -> List[Passage]:
        file_metadata = self._extract_upload_file_metadata(file, source_id=source_id)
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
            file_metadata = await self.file_manager.upsert_file_content(file_id=file_metadata.id, text=raw_markdown_text, actor=self.actor)
            file_metadata = await self.file_manager.update_file_status(
                file_id=file_metadata.id, actor=self.actor, processing_status=FileProcessingStatus.EMBEDDING
            )

            # Insert to agent context window
            # TODO: Rethink this line chunking mechanism
            content_lines = self.line_chunker.chunk_text(text=raw_markdown_text, file_metadata=file_metadata)
            visible_content = "\n".join(content_lines)

            await server.insert_file_into_context_windows(
                source_id=source_id,
                text=visible_content,
                file_id=file_metadata.id,
                file_name=file_metadata.file_name,
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
            if job:
                job.status = JobStatus.completed
                job.metadata["num_passages"] = len(all_passages)
                await self.job_manager.update_job_by_id_async(job_id=job.id, job_update=JobUpdate(**job.model_dump()), actor=self.actor)

            await self.file_manager.update_file_status(
                file_id=file_metadata.id, actor=self.actor, processing_status=FileProcessingStatus.COMPLETED
            )

            return all_passages

        except Exception as e:
            logger.error(f"File processing failed for {filename}: {str(e)}")

            # update job status
            if job:
                job.status = JobStatus.failed
                job.metadata["error"] = str(e)
                await self.job_manager.update_job_by_id_async(job_id=job.id, job_update=JobUpdate(**job.model_dump()), actor=self.actor)

            await self.file_manager.update_file_status(
                file_id=file_metadata.id, actor=self.actor, processing_status=FileProcessingStatus.ERROR, error_message=str(e)
            )

            return []

    def _extract_upload_file_metadata(self, file: UploadFile, source_id: str) -> FileMetadata:
        file_metadata = {
            "file_name": file.filename,
            "file_path": None,
            "file_type": mimetypes.guess_type(file.filename)[0] or file.content_type or "unknown",
            "file_size": file.size if file.size is not None else None,
        }
        return FileMetadata(**file_metadata, source_id=source_id)
