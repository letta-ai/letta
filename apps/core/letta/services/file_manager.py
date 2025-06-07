from datetime import datetime
from typing import List, Optional

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from letta.orm.errors import NoResultFound
from letta.orm.file import FileContent as FileContentModel
from letta.orm.file import FileMetadata as FileMetadataModel
from letta.orm.sqlalchemy_base import AccessType
from letta.otel.tracing import trace_method
from letta.schemas.enums import FileProcessingStatus
from letta.schemas.file import FileMetadata as PydanticFileMetadata
from letta.schemas.user import User as PydanticUser
from letta.server.db import db_registry
from letta.utils import enforce_types


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
        self,
        file_id: str,
        actor: Optional[PydanticUser] = None,
        *,
        include_content: bool = False,
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

                return await file_orm.to_pydantic_async(include_content=include_content)

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
    ) -> PydanticFileMetadata:
        """
        Update processing_status and/or error_message on a FileMetadata row.

        * 1st round-trip → UPDATE
        * 2nd round-trip → SELECT fresh row (same as read_async)
        """

        if processing_status is None and error_message is None:
            raise ValueError("Nothing to update")

        values: dict[str, object] = {"updated_at": datetime.utcnow()}
        if processing_status is not None:
            values["processing_status"] = processing_status
        if error_message is not None:
            values["error_message"] = error_message

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
        self, source_id: str, actor: PydanticUser, after: Optional[str] = None, limit: Optional[int] = 50, include_content: bool = False
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
            return [await file.to_pydantic_async(include_content=include_content) for file in files]

    @enforce_types
    @trace_method
    async def delete_file(self, file_id: str, actor: PydanticUser) -> PydanticFileMetadata:
        """Delete a file by its ID."""
        async with db_registry.async_session() as session:
            file = await FileMetadataModel.read_async(db_session=session, identifier=file_id)
            await file.hard_delete_async(db_session=session, actor=actor)
            return await file.to_pydantic_async()
