import asyncio
import os
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from letta.constants import MAX_FILENAME_LENGTH
from letta.helpers.pinecone_utils import list_pinecone_index_for_files, should_use_pinecone
from letta.log import get_logger
from letta.orm.errors import NoResultFound
from letta.orm.file import FileContent as FileContentModel
from letta.orm.file import FileMetadata as FileMetadataModel
from letta.orm.sqlalchemy_base import AccessType
from letta.otel.tracing import trace_method
from letta.schemas.enums import FileProcessingStatus
from letta.schemas.file import FileMetadata as PydanticFileMetadata
from letta.schemas.source import Source as PydanticSource
from letta.schemas.source_metadata import FileStats, OrganizationSourcesStats, SourceStats
from letta.schemas.user import User as PydanticUser
from letta.server.db import db_registry
from letta.settings import settings
from letta.utils import enforce_types

logger = get_logger(__name__)


class DuplicateFileError(Exception):
    """Raised when a duplicate file is encountered and error handling is specified"""

    def __init__(self, filename: str, source_name: str):
        self.filename = filename
        self.source_name = source_name
        super().__init__(f"File '{filename}' already exists in source '{source_name}'")


class FileManager:
    """Manager class to handle business logic related to files."""

    async def _invalidate_file_caches(self, file_id: str, actor: PydanticUser, original_filename: str = None, source_id: str = None):
        """Invalidate all caches related to a file."""
        # TEMPORARILY DISABLED - caching is disabled
        # # invalidate file content cache (all variants)
        # await self.get_file_by_id.cache_invalidate(self, file_id, actor, include_content=True)
        # await self.get_file_by_id.cache_invalidate(self, file_id, actor, include_content=False)

        # # invalidate filename-based cache if we have the info
        # if original_filename and source_id:
        #     await self.get_file_by_original_name_and_source.cache_invalidate(self, original_filename, source_id, actor)

    @enforce_types
    @trace_method
    async def create_file(
        self,
        file_metadata: PydanticFileMetadata,
        actor: PydanticUser,
        *,
        text: Optional[str] = None,
    ) -> PydanticFileMetadata:

        # short-circuit if it already exists
        existing = await self.get_file_by_id(file_metadata.id, actor=actor)
        if existing:
            return existing

        async with db_registry.async_session() as session:
            try:
                file_metadata.organization_id = actor.organization_id
                file_orm = FileMetadataModel(**file_metadata.model_dump(to_orm=True, exclude_none=True))
                await file_orm.create_async(session, actor=actor, no_commit=True)

                if text is not None:
                    content_orm = FileContentModel(file_id=file_orm.id, text=text)
                    await content_orm.create_async(session, actor=actor, no_commit=True)

                await session.commit()
                await session.refresh(file_orm)

                # invalidate cache for this new file
                await self._invalidate_file_caches(file_orm.id, actor, file_orm.original_file_name, file_orm.source_id)

                return await file_orm.to_pydantic_async()

            except IntegrityError:
                await session.rollback()
                return await self.get_file_by_id(file_metadata.id, actor=actor)

    # TODO: We make actor optional for now, but should most likely be enforced due to security reasons
    @enforce_types
    @trace_method
    # @async_redis_cache(
    #     key_func=lambda self, file_id, actor=None, include_content=False, strip_directory_prefix=False: f"{file_id}:{actor.organization_id if actor else 'none'}:{include_content}:{strip_directory_prefix}",
    #     prefix="file_content",
    #     ttl_s=3600,
    #     model_class=PydanticFileMetadata,
    # )
    async def get_file_by_id(
        self, file_id: str, actor: Optional[PydanticUser] = None, *, include_content: bool = False, strip_directory_prefix: bool = False
    ) -> Optional[PydanticFileMetadata]:
        """Retrieve a file by its ID.

        If `include_content=True`, the FileContent relationship is eagerly
        loaded so `to_pydantic(include_content=True)` never triggers a
        lazy SELECT (avoids MissingGreenlet).
        """
        async with db_registry.async_session() as session:
            try:
                if include_content:
                    # explicit eager load
                    query = (
                        select(FileMetadataModel).where(FileMetadataModel.id == file_id).options(selectinload(FileMetadataModel.content))
                    )
                    # apply org-scoping if actor provided
                    if actor:
                        query = FileMetadataModel.apply_access_predicate(
                            query,
                            actor,
                            access=["read"],
                            access_type=AccessType.ORGANIZATION,
                        )

                    result = await session.execute(query)
                    file_orm = result.scalar_one()
                else:
                    # fast path (metadata only)
                    file_orm = await FileMetadataModel.read_async(
                        db_session=session,
                        identifier=file_id,
                        actor=actor,
                    )

                return await file_orm.to_pydantic_async(include_content=include_content, strip_directory_prefix=strip_directory_prefix)

            except NoResultFound:
                return None

    @enforce_types
    @trace_method
    async def update_file_status(
        self,
        *,
        file_id: str,
        actor: PydanticUser,
        processing_status: Optional[FileProcessingStatus] = None,
        error_message: Optional[str] = None,
        total_chunks: Optional[int] = None,
        chunks_embedded: Optional[int] = None,
        enforce_state_transitions: bool = True,
    ) -> Optional[PydanticFileMetadata]:
        """
        Update processing_status, error_message, total_chunks, and/or chunks_embedded on a FileMetadata row.

        Enforces state transition rules (when enforce_state_transitions=True):
        - PENDING -> PARSING -> EMBEDDING -> COMPLETED (normal flow)
        - Any non-terminal state -> ERROR
        - Same-state transitions are allowed (e.g., EMBEDDING -> EMBEDDING)
        - ERROR and COMPLETED are terminal (no status transitions allowed, metadata updates blocked)

        Args:
            file_id: ID of the file to update
            actor: User performing the update
            processing_status: New processing status to set
            error_message: Error message to set (if any)
            total_chunks: Total number of chunks in the file
            chunks_embedded: Number of chunks already embedded
            enforce_state_transitions: Whether to enforce state transition rules (default: True).
                                     Set to False to bypass validation for testing or special cases.

        Returns:
            Updated file metadata, or None if the update was blocked

        * 1st round-trip → UPDATE with optional state validation
        * 2nd round-trip → SELECT fresh row (same as read_async) if update succeeded
        """

        if processing_status is None and error_message is None and total_chunks is None and chunks_embedded is None:
            raise ValueError("Nothing to update")

        # validate that ERROR status must have an error message
        if processing_status == FileProcessingStatus.ERROR and not error_message:
            raise ValueError("Error message is required when setting processing status to ERROR")

        values: dict[str, object] = {"updated_at": datetime.utcnow()}
        if processing_status is not None:
            values["processing_status"] = processing_status
        if error_message is not None:
            values["error_message"] = error_message
        if total_chunks is not None:
            values["total_chunks"] = total_chunks
        if chunks_embedded is not None:
            values["chunks_embedded"] = chunks_embedded

        # validate state transitions before making any database calls
        if enforce_state_transitions and processing_status == FileProcessingStatus.PENDING:
            # PENDING cannot be set after initial creation
            raise ValueError(f"Cannot transition to PENDING state for file {file_id} - PENDING is only valid as initial state")

        async with db_registry.async_session() as session:
            # build where conditions
            where_conditions = [
                FileMetadataModel.id == file_id,
                FileMetadataModel.organization_id == actor.organization_id,
            ]

            # only add state transition validation if enforce_state_transitions is True
            if enforce_state_transitions and processing_status is not None:
                # enforce specific transitions based on target status
                if processing_status == FileProcessingStatus.PARSING:
                    where_conditions.append(
                        FileMetadataModel.processing_status.in_([FileProcessingStatus.PENDING, FileProcessingStatus.PARSING])
                    )
                elif processing_status == FileProcessingStatus.EMBEDDING:
                    where_conditions.append(
                        FileMetadataModel.processing_status.in_([FileProcessingStatus.PARSING, FileProcessingStatus.EMBEDDING])
                    )
                elif processing_status == FileProcessingStatus.COMPLETED:
                    where_conditions.append(
                        FileMetadataModel.processing_status.in_([FileProcessingStatus.EMBEDDING, FileProcessingStatus.COMPLETED])
                    )
                elif processing_status == FileProcessingStatus.ERROR:
                    # ERROR can be set from any non-terminal state
                    where_conditions.append(
                        FileMetadataModel.processing_status.notin_([FileProcessingStatus.ERROR, FileProcessingStatus.COMPLETED])
                    )
            elif enforce_state_transitions and processing_status is None:
                # If only updating metadata fields (not status), prevent updates to terminal states
                where_conditions.append(
                    FileMetadataModel.processing_status.notin_([FileProcessingStatus.ERROR, FileProcessingStatus.COMPLETED])
                )

            # fast in-place update with state validation
            stmt = (
                update(FileMetadataModel)
                .where(*where_conditions)
                .values(**values)
                .returning(FileMetadataModel.id)  # return id if update succeeded
            )
            result = await session.execute(stmt)
            updated_id = result.scalar()

            if not updated_id:
                # update was blocked
                await session.commit()

                if enforce_state_transitions:
                    # update was blocked by state transition rules - raise error
                    # fetch current state to provide informative error
                    current_file = await FileMetadataModel.read_async(
                        db_session=session,
                        identifier=file_id,
                        actor=actor,
                    )
                    current_status = current_file.processing_status

                    # build informative error message
                    if processing_status is not None:
                        if current_status in [FileProcessingStatus.ERROR, FileProcessingStatus.COMPLETED]:
                            raise ValueError(
                                f"Cannot update file {file_id} status from terminal state {current_status} to {processing_status}"
                            )
                        else:
                            raise ValueError(f"Invalid state transition for file {file_id}: {current_status} -> {processing_status}")
                    else:
                        raise ValueError(f"Cannot update file {file_id} in terminal state {current_status}")
                else:
                    # validation was bypassed but update still failed (e.g., file doesn't exist)
                    return None

            await session.commit()

            # invalidate cache for this file
            await self._invalidate_file_caches(file_id, actor)

            # reload via normal accessor so we return a fully-attached object
            file_orm = await FileMetadataModel.read_async(
                db_session=session,
                identifier=file_id,
                actor=actor,
            )
            return await file_orm.to_pydantic_async()

    @enforce_types
    @trace_method
    async def check_and_update_file_status(
        self,
        file_metadata: PydanticFileMetadata,
        actor: PydanticUser,
    ) -> PydanticFileMetadata:
        """
        Check and update file status for timeout and embedding completion.

        This method consolidates logic for:
        1. Checking if a file has timed out during processing
        2. Checking Pinecone embedding status and updating counts

        Args:
            file_metadata: The file metadata to check
            actor: User performing the check

        Returns:
            Updated file metadata with current status
        """
        # check for timeout if status is not terminal
        if not file_metadata.processing_status.is_terminal_state():
            if file_metadata.created_at:
                # handle timezone differences between PostgreSQL (timezone-aware) and SQLite (timezone-naive)
                if settings.letta_pg_uri_no_default:
                    # postgresql: both datetimes are timezone-aware
                    timeout_threshold = datetime.now(timezone.utc) - timedelta(minutes=settings.file_processing_timeout_minutes)
                    file_created_at = file_metadata.created_at
                else:
                    # sqlite: both datetimes should be timezone-naive
                    timeout_threshold = datetime.utcnow() - timedelta(minutes=settings.file_processing_timeout_minutes)
                    file_created_at = file_metadata.created_at

                if file_created_at < timeout_threshold:
                    # move file to error status with timeout message
                    timeout_message = settings.file_processing_timeout_error_message.format(settings.file_processing_timeout_minutes)
                    try:
                        file_metadata = await self.update_file_status(
                            file_id=file_metadata.id,
                            actor=actor,
                            processing_status=FileProcessingStatus.ERROR,
                            error_message=timeout_message,
                        )
                    except ValueError as e:
                        # state transition was blocked - log it but don't fail
                        logger.warning(f"Could not update file to timeout error state: {str(e)}")
                        # continue with existing file_metadata

        # check pinecone embedding status
        if should_use_pinecone() and file_metadata.processing_status == FileProcessingStatus.EMBEDDING:
            ids = await list_pinecone_index_for_files(file_id=file_metadata.id, actor=actor)
            logger.info(
                f"Embedded chunks {len(ids)}/{file_metadata.total_chunks} for {file_metadata.id} ({file_metadata.file_name}) in organization {actor.organization_id}"
            )

            if len(ids) != file_metadata.chunks_embedded or len(ids) == file_metadata.total_chunks:
                if len(ids) != file_metadata.total_chunks:
                    file_status = file_metadata.processing_status
                else:
                    file_status = FileProcessingStatus.COMPLETED
                try:
                    file_metadata = await self.update_file_status(
                        file_id=file_metadata.id, actor=actor, chunks_embedded=len(ids), processing_status=file_status
                    )
                except ValueError as e:
                    # state transition was blocked - this is a race condition
                    # log it but don't fail since we're just checking status
                    logger.warning(f"Race condition detected in check_and_update_file_status: {str(e)}")
                    # return the current file state without updating

        return file_metadata

    @enforce_types
    @trace_method
    async def upsert_file_content(
        self,
        *,
        file_id: str,
        text: str,
        actor: PydanticUser,
    ) -> PydanticFileMetadata:
        async with db_registry.async_session() as session:
            await FileMetadataModel.read_async(session, file_id, actor)

            dialect_name = session.bind.dialect.name

            if dialect_name == "postgresql":
                stmt = (
                    pg_insert(FileContentModel)
                    .values(file_id=file_id, text=text)
                    .on_conflict_do_update(
                        index_elements=[FileContentModel.file_id],
                        set_={"text": text},
                    )
                )
                await session.execute(stmt)
            else:
                # Emulate upsert for SQLite and others
                stmt = select(FileContentModel).where(FileContentModel.file_id == file_id)
                result = await session.execute(stmt)
                existing = result.scalar_one_or_none()

                if existing:
                    await session.execute(update(FileContentModel).where(FileContentModel.file_id == file_id).values(text=text))
                else:
                    session.add(FileContentModel(file_id=file_id, text=text))

            await session.commit()

            # invalidate cache for this file since content changed
            await self._invalidate_file_caches(file_id, actor)

            # Reload with content
            query = select(FileMetadataModel).options(selectinload(FileMetadataModel.content)).where(FileMetadataModel.id == file_id)
            result = await session.execute(query)
            return await result.scalar_one().to_pydantic_async(include_content=True)

    @enforce_types
    @trace_method
    async def list_files(
        self,
        source_id: str,
        actor: PydanticUser,
        after: Optional[str] = None,
        limit: Optional[int] = 50,
        include_content: bool = False,
        strip_directory_prefix: bool = False,
        check_status_updates: bool = False,
    ) -> List[PydanticFileMetadata]:
        """List all files with optional pagination and status checking.

        Args:
            source_id: Source to list files from
            actor: User performing the request
            after: Pagination cursor
            limit: Maximum number of files to return
            include_content: Whether to include file content
            strip_directory_prefix: Whether to strip directory prefix from filenames
            check_status_updates: Whether to check and update status for timeout and embedding completion

        Returns:
            List of file metadata
        """
        async with db_registry.async_session() as session:
            options = [selectinload(FileMetadataModel.content)] if include_content else None

            files = await FileMetadataModel.list_async(
                db_session=session,
                after=after,
                limit=limit,
                organization_id=actor.organization_id,
                source_id=source_id,
                query_options=options,
            )

            # convert all files to pydantic models
            file_metadatas = await asyncio.gather(
                *[file.to_pydantic_async(include_content=include_content, strip_directory_prefix=strip_directory_prefix) for file in files]
            )

            # if status checking is enabled, check all files concurrently
            if check_status_updates:
                file_metadatas = await asyncio.gather(
                    *[self.check_and_update_file_status(file_metadata, actor) for file_metadata in file_metadatas]
                )

            return file_metadatas

    @enforce_types
    @trace_method
    async def delete_file(self, file_id: str, actor: PydanticUser) -> PydanticFileMetadata:
        """Delete a file by its ID."""
        async with db_registry.async_session() as session:
            file = await FileMetadataModel.read_async(db_session=session, identifier=file_id)

            # invalidate cache for this file before deletion
            await self._invalidate_file_caches(file_id, actor, file.original_file_name, file.source_id)

            await file.hard_delete_async(db_session=session, actor=actor)
            return await file.to_pydantic_async()

    @enforce_types
    @trace_method
    async def generate_unique_filename(self, original_filename: str, source: PydanticSource, organization_id: str) -> str:
        """
        Generate a unique filename by adding a numeric suffix if duplicates exist.
        Always returns a unique filename - does not handle duplicate policies.

        Parameters:
            original_filename (str): The original filename as uploaded.
            source (PydanticSource): Source to check for duplicates within.
            organization_id (str): Organization ID to check for duplicates within.

        Returns:
            str: A unique filename with source.name prefix and numeric suffix if needed.
        """
        base, ext = os.path.splitext(original_filename)

        # Reserve space for potential suffix: " (999)" = 6 characters
        max_base_length = MAX_FILENAME_LENGTH - len(ext) - 6
        if len(base) > max_base_length:
            base = base[:max_base_length]
            original_filename = f"{base}{ext}"

        async with db_registry.async_session() as session:
            # Count existing files with the same original_file_name in this source
            query = select(func.count(FileMetadataModel.id)).where(
                FileMetadataModel.original_file_name == original_filename,
                FileMetadataModel.source_id == source.id,
                FileMetadataModel.organization_id == organization_id,
                FileMetadataModel.is_deleted == False,
            )
            result = await session.execute(query)
            count = result.scalar() or 0

            if count == 0:
                # No duplicates, return original filename with source.name
                return f"{source.name}/{original_filename}"
            else:
                # Add numeric suffix to make unique
                return f"{source.name}/{base}_({count}){ext}"

    @enforce_types
    @trace_method
    # @async_redis_cache(
    #     key_func=lambda self, original_filename, source_id, actor: f"{original_filename}:{source_id}:{actor.organization_id}",
    #     prefix="file_by_name",
    #     ttl_s=3600,
    #     model_class=PydanticFileMetadata,
    # )
    async def get_file_by_original_name_and_source(
        self, original_filename: str, source_id: str, actor: PydanticUser
    ) -> Optional[PydanticFileMetadata]:
        """
        Get a file by its original filename and source ID.

        Parameters:
            original_filename (str): The original filename to search for.
            source_id (str): The source ID to search within.
            actor (PydanticUser): The actor performing the request.

        Returns:
            Optional[PydanticFileMetadata]: The file metadata if found, None otherwise.
        """
        async with db_registry.async_session() as session:
            query = (
                select(FileMetadataModel)
                .where(
                    FileMetadataModel.original_file_name == original_filename,
                    FileMetadataModel.source_id == source_id,
                    FileMetadataModel.organization_id == actor.organization_id,
                    FileMetadataModel.is_deleted == False,
                )
                .limit(1)
            )

            result = await session.execute(query)
            file_orm = result.scalar_one_or_none()

            if file_orm:
                return await file_orm.to_pydantic_async()
            return None

    @enforce_types
    @trace_method
    async def get_organization_sources_metadata(
        self, actor: PydanticUser, include_detailed_per_source_metadata: bool = False
    ) -> OrganizationSourcesStats:
        """
        Get aggregated metadata for all sources in an organization with optimized queries.

        Returns structured metadata including:
        - Total number of sources
        - Total number of files across all sources
        - Total size of all files
        - Per-source breakdown with file details (if include_detailed_per_source_metadata is True)
        """
        async with db_registry.async_session() as session:
            # Import here to avoid circular imports
            from letta.orm.source import Source as SourceModel

            # Single optimized query to get all sources with their file aggregations
            query = (
                select(
                    SourceModel.id,
                    SourceModel.name,
                    func.count(FileMetadataModel.id).label("file_count"),
                    func.coalesce(func.sum(FileMetadataModel.file_size), 0).label("total_size"),
                )
                .outerjoin(FileMetadataModel, (FileMetadataModel.source_id == SourceModel.id) & (FileMetadataModel.is_deleted == False))
                .where(SourceModel.organization_id == actor.organization_id)
                .where(SourceModel.is_deleted == False)
                .group_by(SourceModel.id, SourceModel.name)
                .order_by(SourceModel.name)
            )

            result = await session.execute(query)
            source_aggregations = result.fetchall()

            # Build response
            metadata = OrganizationSourcesStats()

            for row in source_aggregations:
                source_id, source_name, file_count, total_size = row

                if include_detailed_per_source_metadata:
                    # Get individual file details for this source
                    files_query = (
                        select(FileMetadataModel.id, FileMetadataModel.file_name, FileMetadataModel.file_size)
                        .where(
                            FileMetadataModel.source_id == source_id,
                            FileMetadataModel.organization_id == actor.organization_id,
                            FileMetadataModel.is_deleted == False,
                        )
                        .order_by(FileMetadataModel.file_name)
                    )

                    files_result = await session.execute(files_query)
                    files_rows = files_result.fetchall()

                    # Build file stats
                    files = [FileStats(file_id=file_row[0], file_name=file_row[1], file_size=file_row[2]) for file_row in files_rows]

                    # Build source metadata
                    source_metadata = SourceStats(
                        source_id=source_id, source_name=source_name, file_count=file_count, total_size=total_size, files=files
                    )

                    metadata.sources.append(source_metadata)

                metadata.total_files += file_count
                metadata.total_size += total_size

            metadata.total_sources = len(source_aggregations)
            return metadata

    @enforce_types
    @trace_method
    async def get_files_by_ids_async(
        self, file_ids: List[str], actor: PydanticUser, *, include_content: bool = False
    ) -> List[PydanticFileMetadata]:
        """
        Get multiple files by their IDs in a single query.

        Args:
            file_ids: List of file IDs to retrieve
            actor: User performing the action
            include_content: Whether to include file content in the response

        Returns:
            List[PydanticFileMetadata]: List of files (may be fewer than requested if some don't exist)
        """
        if not file_ids:
            return []

        async with db_registry.async_session() as session:
            query = select(FileMetadataModel).where(
                FileMetadataModel.id.in_(file_ids),
                FileMetadataModel.organization_id == actor.organization_id,
                FileMetadataModel.is_deleted == False,
            )

            # Eagerly load content if requested
            if include_content:
                query = query.options(selectinload(FileMetadataModel.content))

            result = await session.execute(query)
            files_orm = result.scalars().all()

            return await asyncio.gather(*[file.to_pydantic_async(include_content=include_content) for file in files_orm])

    @enforce_types
    @trace_method
    async def get_files_for_agents_async(
        self, agent_ids: List[str], actor: PydanticUser, *, include_content: bool = False
    ) -> List[PydanticFileMetadata]:
        """
        Get all files associated with the given agents via file-agent relationships.

        Args:
            agent_ids: List of agent IDs to find files for
            actor: User performing the action
            include_content: Whether to include file content in the response

        Returns:
            List[PydanticFileMetadata]: List of unique files associated with these agents
        """
        if not agent_ids:
            return []

        async with db_registry.async_session() as session:
            # We need to import FileAgent here to avoid circular imports
            from letta.orm.file_agent import FileAgent as FileAgentModel

            # Join through file-agent relationships
            query = (
                select(FileMetadataModel)
                .join(FileAgentModel, FileMetadataModel.id == FileAgentModel.file_id)
                .where(
                    FileAgentModel.agent_id.in_(agent_ids),
                    FileMetadataModel.organization_id == actor.organization_id,
                    FileMetadataModel.is_deleted == False,
                    FileAgentModel.is_deleted == False,
                )
                .distinct()  # Ensure we don't get duplicate files
            )

            # Eagerly load content if requested
            if include_content:
                query = query.options(selectinload(FileMetadataModel.content))

            result = await session.execute(query)
            files_orm = result.scalars().all()

            return await asyncio.gather(*[file.to_pydantic_async(include_content=include_content) for file in files_orm])
