import os
import tempfile
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Query, UploadFile

from letta.schemas.file import FileMetadata
from letta.schemas.job import Job
from letta.schemas.passage import Passage
from letta.schemas.source import Source, SourceCreate, SourceUpdate
from letta.schemas.user import User
from letta.server.rest_api.utils import get_letta_server
from letta.server.server import SyncServer
from letta.utils import sanitize_filename

# These can be forward refs, but because Fastapi needs them at runtime the must be imported normally


router = APIRouter(prefix="/sources", tags=["sources"])


@router.get("/{source_id}", response_model=Source, operation_id="retrieve_source")
def retrieve_source(
    source_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Get all sources
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)

    source = server.source_manager.get_source_by_id(source_id=source_id, actor=actor)
    if not source:
        raise HTTPException(status_code=404, detail=f"Source with id={source_id} not found.")
    return source


@router.get("/name/{source_name}", response_model=str, operation_id="get_source_id_by_name")
def get_source_id_by_name(
    source_name: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Get a source by name
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)

    source = server.source_manager.get_source_by_name(source_name=source_name, actor=actor)
    if not source:
        raise HTTPException(status_code=404, detail=f"Source with name={source_name} not found.")
    return source.id


@router.get("/", response_model=List[Source], operation_id="list_sources")
def list_sources(
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    List all data sources created by a user.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)

    return server.list_all_sources(actor=actor)


@router.post("/", response_model=Source, operation_id="create_source")
def create_source(
    source_create: SourceCreate,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Create a new data source.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    if not source_create.embedding_config:
        if not source_create.embedding:
            # TODO: modify error type
            raise ValueError("Must specify either embedding or embedding_config in request")
        source_create.embedding_config = server.get_embedding_config_from_handle(
            handle=source_create.embedding,
            embedding_chunk_size=source_create.embedding_chunk_size or constants.DEFAULT_EMBEDDING_CHUNK_SIZE,
        )
    source = Source(
        name=source_create.name,
        embedding_config=source_create.embedding_config,
        description=source_create.description,
        metadata=source_create.metadata,
    )
    return server.source_manager.create_source(source=source, actor=actor)


@router.patch("/{source_id}", response_model=Source, operation_id="modify_source")
def modify_source(
    source_id: str,
    source: SourceUpdate,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Update the name or documentation of an existing data source.
    """
    # TODO: allow updating the handle/embedding config
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    if not server.source_manager.get_source_by_id(source_id=source_id, actor=actor):
        raise HTTPException(status_code=404, detail=f"Source with id={source_id} does not exist.")
    return server.source_manager.update_source(source_id=source_id, source_update=source, actor=actor)


@router.delete("/{source_id}", response_model=None, operation_id="delete_source")
def delete_source(
    source_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Delete a data source.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)

    server.delete_source(source_id=source_id, actor=actor)


@router.post("/{source_id}/upload", response_model=Job, operation_id="upload_file_to_source")
def upload_file_to_source(
    file: UploadFile,
    source_id: str,
    background_tasks: BackgroundTasks,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Upload a file to a data source.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)

    source = server.source_manager.get_source_by_id(source_id=source_id, actor=actor)
    assert source is not None, f"Source with id={source_id} not found."
    bytes = file.file.read()

    # create job
    job = Job(
        user_id=actor.id,
        metadata={"type": "embedding", "filename": file.filename, "source_id": source_id},
        completed_at=None,
    )
    job_id = job.id
    server.job_manager.create_job(job, actor=actor)

    # create background task
    background_tasks.add_task(load_file_to_source_async, server, source_id=source.id, file=file, job_id=job.id, bytes=bytes, actor=actor)

    # return job information
    # Is this necessary? Can we just return the job from create_job?
    job = server.job_manager.get_job_by_id(job_id=job_id, actor=actor)
    assert job is not None, "Job not found"
    return job


@router.get("/{source_id}/passages", response_model=List[Passage], operation_id="list_source_passages")
def list_source_passages(
    source_id: str,
    server: SyncServer = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    List all passages associated with a data source.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    passages = server.list_data_source_passages(user_id=actor.id, source_id=source_id)
    return passages


@router.get("/{source_id}/files", response_model=List[FileMetadata], operation_id="list_source_files")
def list_source_files(
    source_id: str,
    limit: int = Query(1000, description="Number of files to return"),
    after: Optional[str] = Query(None, description="Pagination cursor to fetch the next set of results"),
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    List paginated files associated with a data source.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)
    return server.source_manager.list_files(source_id=source_id, limit=limit, after=after, actor=actor)


# it's redundant to include /delete in the URL path. The HTTP verb DELETE already implies that action.
# it's still good practice to return a status indicating the success or failure of the deletion
@router.delete("/{source_id}/{file_id}", status_code=204, operation_id="delete_file_from_source")
def delete_file_from_source(
    source_id: str,
    file_id: str,
    server: "SyncServer" = Depends(get_letta_server),
    actor_id: Optional[str] = Header(None, alias="user_id"),  # Extract user_id from header, default to None if not present
):
    """
    Delete a data source.
    """
    actor = server.user_manager.get_user_or_default(user_id=actor_id)

    deleted_file = server.source_manager.delete_file(file_id=file_id, actor=actor)
    if deleted_file is None:
        raise HTTPException(status_code=404, detail=f"File with id={file_id} not found.")


def load_file_to_source_async(server: SyncServer, source_id: str, job_id: str, file: UploadFile, bytes: bytes, actor: User):
    # Create a temporary directory (deleted after the context manager exits)
    with tempfile.TemporaryDirectory() as tmpdirname:
        # Sanitize the filename
        sanitized_filename = sanitize_filename(file.filename)
        file_path = os.path.join(tmpdirname, sanitized_filename)

        # Write the file to the sanitized path
        with open(file_path, "wb") as buffer:
            buffer.write(bytes)

        # Pass the file to load_file_to_source
        server.load_file_to_source(source_id, file_path, job_id, actor)
