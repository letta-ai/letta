import asyncio
import mimetypes
import os
import tempfile
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, UploadFile
from starlette import status
from starlette.responses import Response

import letta.constants as constants
from letta.helpers.pinecone_utils import (
    delete_file_records_from_pinecone_index,
    delete_source_records_from_pinecone_index,
    should_use_pinecone,
)
from letta.log import get_logger
from letta.otel.tracing import trace_method
from letta.schemas.agent import AgentState
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import DuplicateFileHandling, FileProcessingStatus
from letta.schemas.file import FileMetadata
from letta.schemas.folder import Folder
from letta.schemas.passage import Passage
from letta.schemas.source import Source, SourceCreate, SourceUpdate
from letta.schemas.source_metadata import OrganizationSourcesStats
from letta.schemas.user import User
from letta.server.rest_api.utils import get_letta_server
from letta.server.server import SyncServer
from letta.services.file_processor.embedder.openai_embedder import OpenAIEmbedder
from letta.services.file_processor.embedder.pinecone_embedder import PineconeEmbedder
from letta.services.file_processor.file_processor import FileProcessor
from letta.services.file_processor.file_types import get_allowed_media_types, get_extension_to_mime_type_map, register_mime_types
from letta.services.file_processor.parser.markitdown_parser import MarkitdownFileParser
from letta.services.file_processor.parser.mistral_parser import MistralFileParser
from letta.settings import settings
from letta.utils import safe_create_file_processing_task, safe_create_task, sanitize_filename

logger = get_logger(__name__)

# Register all supported file types with Python's mimetypes module
register_mime_types()


router = APIRouter(prefix="/folders", tags=["folders"])


@router.get("/count", response_model=int, operation_id="count_folders")
async def count_folders(
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Count all data folders created by a user.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    return await server.source_manager.size_async(actor=actor)


@router.get("/{folder_id}", response_model=Folder, operation_id="retrieve_folder")
async def retrieve_folder(
    folder_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Get a folder by ID
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)

    folder = await server.source_manager.get_source_by_id(source_id=folder_id, actor=actor)
    if not folder:
        raise HTTPException(status_code=404, detail=f"Folder with id={folder_id} not found.")
    return folder


@router.get("/name/{folder_name}", response_model=str, operation_id="get_folder_id_by_name")
async def get_folder_id_by_name(
    folder_name: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Get a folder by name
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)

    folder = await server.source_manager.get_source_by_name(source_name=folder_name, actor=actor)
    if not folder:
        raise HTTPException(status_code=404, detail=f"Folder with name={folder_name} not found.")
    return folder.id


@router.get("/metadata", response_model=OrganizationSourcesStats, operation_id="get_folders_metadata")
async def get_folders_metadata(
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
    include_detailed_per_source_metadata: bool = False,
):
    """
    Get aggregated metadata for all folders in an organization.

    Returns structured metadata including:
    - Total number of folders
    - Total number of files across all folders
    - Total size of all files
    - Per-source breakdown with file details (file_name, file_size per file) if include_detailed_per_source_metadata is True
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    return await server.file_manager.get_organization_sources_metadata(
        actor=actor, include_detailed_per_source_metadata=include_detailed_per_source_metadata
    )


@router.get("/", response_model=List[Folder], operation_id="list_folders")
async def list_folders(
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    List all data folders created by a user.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    return await server.source_manager.list_sources(actor=actor)


@router.post("/", response_model=Folder, operation_id="create_folder")
async def create_folder(
    folder_create: SourceCreate,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Create a new data folder.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)

    # TODO: need to asyncify this
    if not folder_create.embedding_config:
        if not folder_create.embedding:
            if settings.default_embedding_handle is None:
                # TODO: modify error type
                raise ValueError("Must specify either embedding or embedding_config in request")
            else:
                folder_create.embedding = settings.default_embedding_handle
        folder_create.embedding_config = await server.get_embedding_config_from_handle_async(
            handle=folder_create.embedding,
            embedding_chunk_size=folder_create.embedding_chunk_size or constants.DEFAULT_EMBEDDING_CHUNK_SIZE,
            actor=actor,
        )
    folder = Source(
        name=folder_create.name,
        embedding_config=folder_create.embedding_config,
        description=folder_create.description,
        instructions=folder_create.instructions,
        metadata=folder_create.metadata,
    )
    return await server.source_manager.create_source(source=folder, actor=actor)


@router.patch("/{folder_id}", response_model=Folder, operation_id="modify_folder")
async def modify_folder(
    folder_id: str,
    folder: SourceUpdate,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Update the name or documentation of an existing data folder.
    """
    # TODO: allow updating the handle/embedding config
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    if not await server.source_manager.get_source_by_id(source_id=folder_id, actor=actor):
        raise HTTPException(status_code=404, detail=f"Folder with id={folder_id} does not exist.")
    return await server.source_manager.update_source(source_id=folder_id, source_update=folder, actor=actor)


@router.delete("/{folder_id}", response_model=None, operation_id="delete_folder")
async def delete_folder(
    folder_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Delete a data folder.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    folder = await server.source_manager.get_source_by_id(source_id=folder_id, actor=actor)
    agent_states = await server.source_manager.list_attached_agents(source_id=folder_id, actor=actor)
    files = await server.file_manager.list_files(folder_id, actor)
    file_ids = [f.id for f in files]

    if should_use_pinecone():
        logger.info(f"Deleting folder {folder_id} from pinecone index")
        await delete_source_records_from_pinecone_index(source_id=folder_id, actor=actor)

    for agent_state in agent_states:
        await server.remove_files_from_context_window(agent_state=agent_state, file_ids=file_ids, actor=actor)

        if agent_state.enable_sleeptime:
            try:
                block = await server.agent_manager.get_block_with_label_async(agent_id=agent_state.id, block_label=folder.name, actor=actor)
                await server.block_manager.delete_block_async(block.id, actor)
            except:
                pass
    await server.delete_source(source_id=folder_id, actor=actor)


@router.post("/{folder_id}/upload", response_model=FileMetadata, operation_id="upload_file_to_folder")
async def upload_file_to_folder(
    file: UploadFile,
    folder_id: str,
    duplicate_handling: DuplicateFileHandling = Query(DuplicateFileHandling.SUFFIX, description="How to handle duplicate filenames"),
    name: Optional[str] = Query(None, description="Optional custom name to override the uploaded file's name"),
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Upload a file to a data folder.
    """
    # NEW: Cloud based file processing
    # Determine file's MIME type
    mimetypes.guess_type(file.filename)[0] or "application/octet-stream"

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

    folder = await server.source_manager.get_source_by_id(source_id=folder_id, actor=actor)
    if folder is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Folder with id={folder_id} not found.")

    content = await file.read()

    # Store original filename and handle duplicate logic
    # Use custom name if provided, otherwise use the uploaded file's name
    # If custom name is provided, use it directly (it's just metadata, not a filesystem path)
    # Otherwise, sanitize the uploaded filename for security
    original_filename = name if name else sanitize_filename(file.filename)  # Basic sanitization only

    # Check if duplicate exists
    existing_file = await server.file_manager.get_file_by_original_name_and_source(
        original_filename=original_filename, source_id=folder_id, actor=actor
    )

    unique_filename = None
    if existing_file:
        # Duplicate found, handle based on strategy
        if duplicate_handling == DuplicateFileHandling.ERROR:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail=f"File '{original_filename}' already exists in folder '{folder.name}'"
            )
        elif duplicate_handling == DuplicateFileHandling.SKIP:
            # Return existing file metadata with custom header to indicate it was skipped
            response = Response(
                content=existing_file.model_dump_json(), media_type="application/json", headers={"X-Upload-Result": "skipped"}
            )
            return response
        elif duplicate_handling == DuplicateFileHandling.REPLACE:
            # delete the file
            deleted_file = await server.file_manager.delete_file(file_id=existing_file.id, actor=actor)
            unique_filename = original_filename

    if not unique_filename:
        # For SUFFIX, continue to generate unique filename
        # Generate unique filename (adds suffix if needed)
        unique_filename = await server.file_manager.generate_unique_filename(
            original_filename=original_filename, source=folder, organization_id=actor.organization_id
        )

    # create file metadata
    file_metadata = FileMetadata(
        source_id=folder_id,
        file_name=unique_filename,
        original_file_name=original_filename,
        file_path=None,
        file_type=mimetypes.guess_type(original_filename)[0] or file.content_type or "unknown",
        file_size=file.size if file.size is not None else None,
        processing_status=FileProcessingStatus.PARSING,
    )
    file_metadata = await server.file_manager.create_file(file_metadata, actor=actor)

    # TODO: Do we need to pull in the full agent_states? Can probably simplify here right?
    agent_states = await server.source_manager.list_attached_agents(source_id=folder_id, actor=actor)

    # Use cloud processing for all files (simple files always, complex files with Mistral key)
    logger.info("Running experimental cloud based file processing...")
    safe_create_file_processing_task(
        load_file_to_source_cloud(server, agent_states, content, folder_id, actor, folder.embedding_config, file_metadata),
        file_metadata=file_metadata,
        server=server,
        actor=actor,
        logger=logger,
        label="file_processor.process",
    )
    safe_create_task(sleeptime_document_ingest_async(server, folder_id, actor), logger=logger, label="sleeptime_document_ingest_async")

    return file_metadata


@router.get("/{folder_id}/agents", response_model=List[str], operation_id="get_agents_for_folder")
async def get_agents_for_folder(
    folder_id: str,
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    Get all agent IDs that have the specified folder attached.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    return await server.source_manager.get_agents_for_source_id(source_id=folder_id, actor=actor)


@router.get("/{folder_id}/passages", response_model=List[Passage], operation_id="list_folder_passages")
async def list_folder_passages(
    folder_id: str,
    after: Optional[str] = Query(None, description="Message after which to retrieve the returned messages."),
    before: Optional[str] = Query(None, description="Message before which to retrieve the returned messages."),
    limit: int = Query(100, description="Maximum number of messages to retrieve."),
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    List all passages associated with a data folder.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    return await server.agent_manager.list_passages_async(
        actor=actor,
        source_id=folder_id,
        after=after,
        before=before,
        limit=limit,
    )


@router.get("/{folder_id}/files", response_model=List[FileMetadata], operation_id="list_folder_files")
async def list_folder_files(
    folder_id: str,
    limit: int = Query(1000, description="Number of files to return"),
    after: Optional[str] = Query(None, description="Pagination cursor to fetch the next set of results"),
    include_content: bool = Query(False, description="Whether to include full file content"),
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),
):
    """
    List paginated files associated with a data folder.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
    return await server.file_manager.list_files(
        source_id=folder_id,
        limit=limit,
        after=after,
        actor=actor,
        include_content=include_content,
        strip_directory_prefix=True,  # TODO: Reconsider this. This is purely for aesthetics.
    )


# @router.get("/{folder_id}/files/{file_id}", response_model=FileMetadata, operation_id="get_file_metadata")
# async def get_file_metadata(
#    folder_id: str,
#    file_id: str,
#    include_content: bool = Query(False, description="Whether to include full file content"),
#    server: "SyncServer" = Depends(get_letta_server),
#    actor_id: Optional[str] = Header(None, alias="user_id"),
# ):
#    """
#    Retrieve metadata for a specific file by its ID.
#    """
#    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)
#
#    # Get file metadata using the file manager
#    file_metadata = await server.file_manager.get_file_by_id(
#        file_id=file_id, actor=actor, include_content=include_content, strip_directory_prefix=True
#    )
#
#    if not file_metadata:
#        raise HTTPException(status_code=404, detail=f"File with id={file_id} not found.")
#
#    # Verify the file belongs to the specified folder
#    if file_metadata.source_id != folder_id:
#        raise HTTPException(status_code=404, detail=f"File with id={file_id} not found in folder {folder_id}.")
#
#    if should_use_pinecone() and file_metadata.processing_status == FileProcessingStatus.EMBEDDING:
#        ids = await list_pinecone_index_for_files(file_id=file_id, actor=actor)
#        logger.info(
#            f"Embedded chunks {len(ids)}/{file_metadata.total_chunks} for {file_id} ({file_metadata.file_name}) in organization {actor.organization_id}"
#        )
#
#        if len(ids) != file_metadata.chunks_embedded or len(ids) == file_metadata.total_chunks:
#            if len(ids) != file_metadata.total_chunks:
#                file_status = file_metadata.processing_status
#            else:
#                file_status = FileProcessingStatus.COMPLETED
#            try:
#                file_metadata = await server.file_manager.update_file_status(
#                    file_id=file_metadata.id, actor=actor, chunks_embedded=len(ids), processing_status=file_status
#                )
#            except ValueError as e:
#                # state transition was blocked - this is a race condition
#                # log it but don't fail the request since we're just reading metadata
#                logger.warning(f"Race condition detected in get_file_metadata: {str(e)}")
#                # return the current file state without updating
#
#    return file_metadata


# it's redundant to include /delete in the URL path. The HTTP verb DELETE already implies that action.
# it's still good practice to return a status indicating the success or failure of the deletion
@router.delete("/{folder_id}/{file_id}", status_code=204, operation_id="delete_file_from_folder")
async def delete_file_from_folder(
    folder_id: str,
    file_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Delete a file from a folder.
    """
    actor = await server.user_manager.get_actor_or_default_async(actor_id=actor_id)

    deleted_file = await server.file_manager.delete_file(file_id=file_id, actor=actor)

    await server.remove_file_from_context_windows(source_id=folder_id, file_id=deleted_file.id, actor=actor)

    if should_use_pinecone():
        logger.info(f"Deleting file {file_id} from pinecone index")
        await delete_file_records_from_pinecone_index(file_id=file_id, actor=actor)

    asyncio.create_task(sleeptime_document_ingest_async(server, folder_id, actor, clear_history=True))
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


@trace_method
async def load_file_to_source_cloud(
    server: SyncServer,
    agent_states: List[AgentState],
    content: bytes,
    source_id: str,
    actor: User,
    embedding_config: EmbeddingConfig,
    file_metadata: FileMetadata,
):
    # Choose parser based on mistral API key availability
    if settings.mistral_api_key:
        file_parser = MistralFileParser()
    else:
        file_parser = MarkitdownFileParser()

    using_pinecone = should_use_pinecone()
    if using_pinecone:
        embedder = PineconeEmbedder(embedding_config=embedding_config)
    else:
        embedder = OpenAIEmbedder(embedding_config=embedding_config)
    file_processor = FileProcessor(file_parser=file_parser, embedder=embedder, actor=actor, using_pinecone=using_pinecone)
    await file_processor.process(agent_states=agent_states, source_id=source_id, content=content, file_metadata=file_metadata)
