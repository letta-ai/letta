import os
from datetime import datetime
from typing import List, Optional

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from letta.constants import MAX_FILENAME_LENGTH
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
from letta.utils import enforce_types


class DuplicateFileError(Exception):
    """Raised when a duplicate file is encountered and error handling is specified"""

    def __init__(self, filename: str, source_name: str):
        self.filename = filename
        self.source_name = source_name
        super().__init__(f"File '{filename}' already exists in source '{source_name}'")


class FileManager:
    """Manager class to handle business logic related to files."""

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
                return await file_orm.to_pydantic_async()

            except IntegrityError:
                await session.rollback()
                return await self.get_file_by_id(file_metadata.id, actor=actor)

    # TODO: We make actor optional for now, but should most likely be enforced due to security reasons
    @enforce_types
    @trace_method
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
    ) -> PydanticFileMetadata:
        """
        Update processing_status, error_message, total_chunks, and/or chunks_embedded on a FileMetadata row.

        * 1st round-trip → UPDATE
        * 2nd round-trip → SELECT fresh row (same as read_async)
        """

        if processing_status is None and error_message is None and total_chunks is None and chunks_embedded is None:
            raise ValueError("Nothing to update")

        values: dict[str, object] = {"updated_at": datetime.utcnow()}
        if processing_status is not None:
            values["processing_status"] = processing_status
        if error_message is not None:
            values["error_message"] = error_message
        if total_chunks is not None:
            values["total_chunks"] = total_chunks
        if chunks_embedded is not None:
            values["chunks_embedded"] = chunks_embedded

        async with db_registry.async_session() as session:
            # Fast in-place update – no ORM hydration
            stmt = (
                update(FileMetadataModel)
                .where(
                    FileMetadataModel.id == file_id,
                    FileMetadataModel.organization_id == actor.organization_id,
                )
                .values(**values)
            )
            await session.execute(stmt)
            await session.commit()

            # Reload via normal accessor so we return a fully-attached object
            file_orm = await FileMetadataModel.read_async(
                db_session=session,
                identifier=file_id,
                actor=actor,
            )
            return await file_orm.to_pydantic_async()

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
    ) -> List[PydanticFileMetadata]:
        """List all files with optional pagination."""
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
            return [
                await file.to_pydantic_async(include_content=include_content, strip_directory_prefix=strip_directory_prefix)
                for file in files
            ]

    @enforce_types
    @trace_method
    async def delete_file(self, file_id: str, actor: PydanticUser) -> PydanticFileMetadata:
        """Delete a file by its ID."""
        async with db_registry.async_session() as session:
            file = await FileMetadataModel.read_async(db_session=session, identifier=file_id)
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
    async def get_organization_sources_metadata(self, actor: PydanticUser) -> OrganizationSourcesStats:
        """
        Get aggregated metadata for all sources in an organization with optimized queries.

        Returns structured metadata including:
        - Total number of sources
        - Total number of files across all sources
        - Total size of all files
        - Per-source breakdown with file details
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

            metadata.total_sources = len(metadata.sources)
            return metadata
