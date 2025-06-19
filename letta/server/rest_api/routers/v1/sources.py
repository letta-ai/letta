import asyncio
import mimetypes
import os
import tempfile
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, UploadFile
from starlette import status

import letta.constants as constants
from letta.log import get_logger
from letta.schemas.agent import AgentState
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.file import FileMetadata
from letta.schemas.job import Job
from letta.schemas.passage import Passage
from letta.schemas.source import Source, SourceCreate, SourceUpdate
from letta.schemas.user import User
from letta.server.rest_api.utils import get_letta_server
from letta.server.server import SyncServer
from letta.services.file_processor.chunker.llama_index_chunker import LlamaIndexChunker
from letta.services.file_processor.embedder.openai_embedder import OpenAIEmbedder
from letta.services.file_processor.file_processor import FileProcessor
from letta.services.file_processor.file_types import (
    get_allowed_media_types,
    get_extension_to_mime_type_map,
    is_simple_text_mime_type,
    register_mime_types,
)
from letta.services.file_processor.parser.mistral_parser import MistralFileParser
from letta.settings import settings
from letta.utils import safe_create_task, sanitize_filename

logger = get_logger(__name__)

# Register all supported file types with Python's mimetypes module
register_mime_types()


router = APIRouter(prefix="/sources", tags=["sources"])


@router.get("/count", response_model=int, operation_id="count_sources")
async def count_sources(
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Count all data sources created by a user.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    return await server.source_manager.size_async(actor=actor)


@router.get("/{source_id}", response_model=Source, operation_id="retrieve_source")
async def retrieve_source(
    source_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Get all sources
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)

    source = await server.source_manager.get_source_by_id(source_id=source_id, actor=actor)
    if not source:
        raise HTTPException(status_code=404, detail=f"Source with id={source_id} not found.")
    return source


@router.get("/name/{source_name}", response_model=str, operation_id="get_source_id_by_name")
async def get_source_id_by_name(
    source_name: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Get a source by name
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)

    source = await server.source_manager.get_source_by_name(source_name=source_name, actor=actor)
    if not source:
        raise HTTPException(status_code=404, detail=f"Source with name={source_name} not found.")
    return source.id


@router.get("/", response_model=List[Source], operation_id="list_sources")
async def list_sources(
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    List all data sources created by a user.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    return await server.source_manager.list_sources(actor=actor)


@router.post("/", response_model=Source, operation_id="create_source")
async def create_source(
    source_create: SourceCreate,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Create a new data source.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)

    # TODO: need to asyncify this
    if not source_create.embedding_config:
        if not source_create.embedding:
            # TODO: modify error type
            raise ValueError("Must specify either embedding or embedding_config in request")
        source_create.embedding_config = await server.get_embedding_config_from_handle_async(
            handle=source_create.embedding,
            embedding_chunk_size=source_create.embedding_chunk_size or constants.DEFAULT_EMBEDDING_CHUNK_SIZE,
            actor=actor,
        )
    source = Source(
        name=source_create.name,
        embedding_config=source_create.embedding_config,
        description=source_create.description,
        instructions=source_create.instructions,
        metadata=source_create.metadata,
    )
    return await server.source_manager.create_source(source=source, actor=actor)


@router.patch("/{source_id}", response_model=Source, operation_id="modify_source")
async def modify_source(
    source_id: str,
    source: SourceUpdate,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Update the name or documentation of an existing data source.
    """
    # TODO: allow updating the handle/embedding config
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    if not await server.source_manager.get_source_by_id(source_id=source_id, actor=actor):
        raise HTTPException(status_code=404, detail=f"Source with id={source_id} does not exist.")
    return await server.source_manager.update_source(source_id=source_id, source_update=source, actor=actor)


@router.delete("/{source_id}", response_model=None, operation_id="delete_source")
async def delete_source(
    source_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Delete a data source.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    source = await server.source_manager.get_source_by_id(source_id=source_id, actor=actor)
    agent_states = await server.source_manager.list_attached_agents(source_id=source_id, actor=actor)
    files = await server.file_manager.list_files(source_id, actor)
    file_ids = [f.id for f in files]

    for agent_state in agent_states:
        await server.remove_files_from_context_window(agent_state=agent_state, file_ids=file_ids, actor=actor)

        if agent_state.enable_sleeptime:
            try:
                block = await server.agent_manager.get_block_with_label_async(agent_id=agent_state.id, block_label=source.name, actor=actor)
                await server.block_manager.delete_block_async(block.id, actor)
            except:
                pass
    await server.delete_source(source_id=source_id, actor=actor)


@router.post("/{source_id}/upload", response_model=Job, operation_id="upload_file_to_source")
async def upload_file_to_source(
    file: UploadFile,
    source_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Upload a file to a data source.
    """
    allowed_media_types = get_allowed_media_types()

    # Normalize incoming Content-Type header (strip charset or any parameters).
    raw_ct = file.content_type or ""
    media_type = raw_ct.split(";", 1)[0].strip().lower()

    # If client didn't supply a Content-Type or it's not one of the allowed types,
    #    attempt to infer from filename extension.
    if media_type not in allowed_media_types and file.filename:
        guessed, _ = mimetypes.guess_type(file.filename)
        media_type = (guessed or "").lower()

        if media_type not in allowed_media_types:
            ext = Path(file.filename).suffix.lower()
            ext_map = get_extension_to_mime_type_map()
            media_type = ext_map.get(ext, media_type)

    # If still not allowed, reject with 415.
    if media_type not in allowed_media_types:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"Unsupported file type: {media_type or 'unknown'} "
                f"(filename: {file.filename}). "
                f"Supported types: PDF, text files (.txt, .md), JSON, and code files (.py, .js, .java, etc.)."
            ),
        )

    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)

    source = await server.source_manager.get_source_by_id(source_id=source_id, actor=actor)
    if source is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Source with id={source_id} not found.")

    content = await file.read()

    # sanitize filename
    file.filename = sanitize_filename(file.filename)

    # create job
    job = Job(
        user_id=actor.id,
        metadata={"type": "embedding", "filename": file.filename, "source_id": source_id},
        completed_at=None,
    )
    job = await server.job_manager.create_job_async(job, actor=actor)

    # TODO: Do we need to pull in the full agent_states? Can probably simplify here right?
    agent_states = await server.source_manager.list_attached_agents(source_id=source_id, actor=actor)

    # NEW: Cloud based file processing
    # Determine file's MIME type
    file_mime_type = mimetypes.guess_type(file.filename)[0] or "application/octet-stream"

    # Check if it's a simple text file
    is_simple_file = is_simple_text_mime_type(file_mime_type)

    # For complex files, require Mistral API key
    if not is_simple_file and not settings.mistral_api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Mistral API key is required to process this file type {file_mime_type}. Please configure your Mistral API key to upload complex file formats.",
        )

    # Use cloud processing for all files (simple files always, complex files with Mistral key)
    logger.info("Running experimental cloud based file processing...")
    safe_create_task(
        load_file_to_source_cloud(server, agent_states, content, file, job, source_id, actor, source.embedding_config),
        logger=logger,
        label="file_processor.process",
    )
    safe_create_task(sleeptime_document_ingest_async(server, source_id, actor), logger=logger, label="sleeptime_document_ingest_async")

    return job


@router.get("/{source_id}/passages", response_model=List[Passage], operation_id="list_source_passages")
async def list_source_passages(
    source_id: str,
    after: Optional[str] = Query(None, description="Message after which to retrieve the returned messages."),
    before: Optional[str] = Query(None, description="Message before which to retrieve the returned messages."),
    limit: int = Query(100, description="Maximum number of messages to retrieve."),
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    List all passages associated with a data source.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    return await server.agent_manager.list_passages_async(
        actor=actor,
        source_id=source_id,
        after=after,
        before=before,
        limit=limit,
    )


@router.get("/{source_id}/files", response_model=List[FileMetadata], operation_id="list_source_files")
async def list_source_files(
    source_id: str,
    limit: int = Query(1000, description="Number of files to return"),
    after: Optional[str] = Query(None, description="Pagination cursor to fetch the next set of results"),
    include_content: bool = Query(False, description="Whether to include full file content"),
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    List paginated files associated with a data source.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    return await server.file_manager.list_files(
        source_id=source_id,
        limit=limit,
        after=after,
        actor=actor,
        include_content=include_content,
    )


# it's redundant to include /delete in the URL path. The HTTP verb DELETE already implies that action.
# it's still good practice to return a status indicating the success or failure of the deletion
@router.delete("/{source_id}/{file_id}", status_code=204, operation_id="delete_file_from_source")
async def delete_file_from_source(
    source_id: str,
    file_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Delete a data source.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)

    deleted_file = await server.file_manager.delete_file(file_id=file_id, actor=actor)

    await server.remove_file_from_context_windows(source_id=source_id, file_id=deleted_file.id, actor=actor)

    asyncio.create_task(sleeptime_document_ingest_async(server, source_id, actor, clear_history=True))
    if deleted_file is None:
        raise HTTPException(status_code=404, detail=f"File with id={file_id} not found.")


async def load_file_to_source_async(server: SyncServer, source_id: str, job_id: str, filename: str, bytes: bytes, actor: User):
    # Create a temporary directory (deleted after the context manager exits)
    with tempfile.TemporaryDirectory() as tmpdirname:
        file_path = os.path.join(tmpdirname, filename)

        # Write the file to the sanitized path
        with open(file_path, "wb") as buffer:
            buffer.write(bytes)

        # Pass the file to load_file_to_source
        await server.load_file_to_source(source_id, file_path, job_id, actor)


async def sleeptime_document_ingest_async(server: SyncServer, source_id: str, actor: User, clear_history: bool = False):
    source = await server.source_manager.get_source_by_id(source_id=source_id)
    agents = await server.source_manager.list_attached_agents(source_id=source_id, actor=actor)
    for agent in agents:
        if agent.enable_sleeptime:
            await server.sleeptime_document_ingest_async(agent, source, actor, clear_history)


async def load_file_to_source_cloud(
    server: SyncServer,
    agent_states: List[AgentState],
    content: bytes,
    file: UploadFile,
    job: Job,
    source_id: str,
    actor: User,
    embedding_config: EmbeddingConfig,
):
    file_processor = MistralFileParser()
    text_chunker = LlamaIndexChunker(chunk_size=embedding_config.embedding_chunk_size)
    embedder = OpenAIEmbedder(embedding_config=embedding_config)
    file_processor = FileProcessor(file_parser=file_processor, text_chunker=text_chunker, embedder=embedder, actor=actor)
    await file_processor.process(server=server, agent_states=agent_states, source_id=source_id, content=content, file=file, job=job)
