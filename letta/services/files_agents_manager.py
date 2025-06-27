from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import and_, func, select, update

from letta.constants import MAX_FILES_OPEN
from letta.orm.errors import NoResultFound
from letta.orm.files_agents import FileAgent as FileAgentModel
from letta.otel.tracing import trace_method
from letta.schemas.block import Block as PydanticBlock
from letta.schemas.file import FileAgent as PydanticFileAgent
from letta.schemas.user import User as PydanticUser
from letta.server.db import db_registry
from letta.utils import enforce_types


class FileAgentManager:
    """High-level helpers for CRUD / listing on the `files_agents` join table."""

    @enforce_types
    @trace_method
    async def attach_file(
        self,
        *,
        agent_id: str,
        file_id: str,
        file_name: str,
        actor: PydanticUser,
        is_open: bool = True,
        visible_content: Optional[str] = None,
    ) -> tuple[PydanticFileAgent, List[str]]:
        """
        Idempotently attach *file_id* to *agent_id* with LRU enforcement.

        • If the row already exists → update `is_open`, `visible_content`
          and always refresh `last_accessed_at`.
        • Otherwise create a brand-new association.
        • If is_open=True, enforces MAX_FILES_OPEN using LRU eviction.

        Returns:
            Tuple of (file_agent, closed_file_names)
        """
        if is_open:
            # Use the efficient LRU + open method
            closed_files, was_already_open = await self.enforce_max_open_files_and_open(
                agent_id=agent_id, file_id=file_id, file_name=file_name, actor=actor, visible_content=visible_content or ""
            )

            # Get the updated file agent to return
            file_agent = await self.get_file_agent_by_id(agent_id=agent_id, file_id=file_id, actor=actor)
            return file_agent, closed_files
        else:
            # Original logic for is_open=False
            async with db_registry.async_session() as session:
                query = select(FileAgentModel).where(
                    and_(
                        FileAgentModel.agent_id == agent_id,
                        FileAgentModel.file_id == file_id,
                        FileAgentModel.file_name == file_name,
                        FileAgentModel.organization_id == actor.organization_id,
                    )
                )
                existing = await session.scalar(query)

                now_ts = datetime.now(timezone.utc)

                if existing:
                    # update only the fields that actually changed
                    if existing.is_open != is_open:
                        existing.is_open = is_open

                    if visible_content is not None and existing.visible_content != visible_content:
                        existing.visible_content = visible_content

                    existing.last_accessed_at = now_ts

                    await existing.update_async(session, actor=actor)
                    return existing.to_pydantic(), []

                assoc = FileAgentModel(
                    agent_id=agent_id,
                    file_id=file_id,
                    file_name=file_name,
                    organization_id=actor.organization_id,
                    is_open=is_open,
                    visible_content=visible_content,
                    last_accessed_at=now_ts,
                )
                await assoc.create_async(session, actor=actor)
                return assoc.to_pydantic(), []

    @enforce_types
    @trace_method
    async def update_file_agent_by_id(
        self,
        *,
        agent_id: str,
        file_id: str,
        actor: PydanticUser,
        is_open: Optional[bool] = None,
        visible_content: Optional[str] = None,
    ) -> PydanticFileAgent:
        """Patch an existing association row."""
        async with db_registry.async_session() as session:
            assoc = await self._get_association_by_file_id(session, agent_id, file_id, actor)

            if is_open is not None:
                assoc.is_open = is_open
            if visible_content is not None:
                assoc.visible_content = visible_content

            # touch timestamp
            assoc.last_accessed_at = datetime.now(timezone.utc)

            await assoc.update_async(session, actor=actor)
            return assoc.to_pydantic()

    @enforce_types
    @trace_method
    async def update_file_agent_by_name(
        self,
        *,
        agent_id: str,
        file_name: str,
        actor: PydanticUser,
        is_open: Optional[bool] = None,
        visible_content: Optional[str] = None,
    ) -> PydanticFileAgent:
        """Patch an existing association row."""
        async with db_registry.async_session() as session:
            assoc = await self._get_association_by_file_name(session, agent_id, file_name, actor)

            if is_open is not None:
                assoc.is_open = is_open
            if visible_content is not None:
                assoc.visible_content = visible_content

            # touch timestamp
            assoc.last_accessed_at = datetime.now(timezone.utc)

            await assoc.update_async(session, actor=actor)
            return assoc.to_pydantic()

    @enforce_types
    @trace_method
    async def detach_file(self, *, agent_id: str, file_id: str, actor: PydanticUser) -> None:
        """Hard-delete the association."""
        async with db_registry.async_session() as session:
            assoc = await self._get_association_by_file_id(session, agent_id, file_id, actor)
            await assoc.hard_delete_async(session, actor=actor)

    @enforce_types
    @trace_method
    async def get_file_agent_by_id(self, *, agent_id: str, file_id: str, actor: PydanticUser) -> Optional[PydanticFileAgent]:
        async with db_registry.async_session() as session:
            try:
                assoc = await self._get_association_by_file_id(session, agent_id, file_id, actor)
                return assoc.to_pydantic()
            except NoResultFound:
                return None

    @enforce_types
    @trace_method
    async def get_all_file_blocks_by_name(
        self,
        *,
        file_names: List[str],
        actor: PydanticUser,
    ) -> List[PydanticBlock]:
        """
        Retrieve multiple FileAgent associations by their IDs in a single query.

        Args:
            file_names: List of file names to retrieve
            actor: The user making the request

        Returns:
            List of PydanticFileAgent objects found (may be fewer than requested if some IDs don't exist)
        """
        if not file_names:
            return []

        async with db_registry.async_session() as session:
            # Use IN clause for efficient bulk retrieval
            query = select(FileAgentModel).where(
                and_(
                    FileAgentModel.file_name.in_(file_names),
                    FileAgentModel.organization_id == actor.organization_id,
                )
            )

            # Execute query and get all results
            rows = (await session.execute(query)).scalars().all()

            # Convert to Pydantic models
            return [row.to_pydantic_block() for row in rows]

    @enforce_types
    @trace_method
    async def get_file_agent_by_file_name(self, *, agent_id: str, file_name: str, actor: PydanticUser) -> Optional[PydanticFileAgent]:
        async with db_registry.async_session() as session:
            try:
                assoc = await self._get_association_by_file_name(session, agent_id, file_name, actor)
                return assoc.to_pydantic()
            except NoResultFound:
                return None

    @enforce_types
    @trace_method
    async def list_files_for_agent(
        self, agent_id: str, actor: PydanticUser, is_open_only: bool = False, return_as_blocks: bool = False
    ) -> List[PydanticFileAgent]:
        """Return associations for *agent_id* (filtering by `is_open` if asked)."""
        async with db_registry.async_session() as session:
            conditions = [
                FileAgentModel.agent_id == agent_id,
                FileAgentModel.organization_id == actor.organization_id,
            ]
            if is_open_only:
                conditions.append(FileAgentModel.is_open.is_(True))

            rows = (await session.execute(select(FileAgentModel).where(and_(*conditions)))).scalars().all()

            if return_as_blocks:
                return [r.to_pydantic_block() for r in rows]
            else:
                return [r.to_pydantic() for r in rows]

    @enforce_types
    @trace_method
    async def list_agents_for_file(
        self,
        file_id: str,
        actor: PydanticUser,
        is_open_only: bool = False,
    ) -> List[PydanticFileAgent]:
        """Return associations for *file_id* (filtering by `is_open` if asked)."""
        async with db_registry.async_session() as session:
            conditions = [
                FileAgentModel.file_id == file_id,
                FileAgentModel.organization_id == actor.organization_id,
            ]
            if is_open_only:
                conditions.append(FileAgentModel.is_open.is_(True))

            rows = (await session.execute(select(FileAgentModel).where(and_(*conditions)))).scalars().all()
            return [r.to_pydantic() for r in rows]

    @enforce_types
    @trace_method
    async def mark_access(self, *, agent_id: str, file_id: str, actor: PydanticUser) -> None:
        """Update only `last_accessed_at = now()` without loading the row."""
        async with db_registry.async_session() as session:
            stmt = (
                update(FileAgentModel)
                .where(
                    FileAgentModel.agent_id == agent_id,
                    FileAgentModel.file_id == file_id,
                    FileAgentModel.organization_id == actor.organization_id,
                )
                .values(last_accessed_at=func.now())
            )
            await session.execute(stmt)
            await session.commit()

    @enforce_types
    @trace_method
    async def mark_access_bulk(self, *, agent_id: str, file_names: List[str], actor: PydanticUser) -> None:
        """Update `last_accessed_at = now()` for multiple files by name without loading rows."""
        if not file_names:
            return

        async with db_registry.async_session() as session:
            stmt = (
                update(FileAgentModel)
                .where(
                    FileAgentModel.agent_id == agent_id,
                    FileAgentModel.file_name.in_(file_names),
                    FileAgentModel.organization_id == actor.organization_id,
                )
                .values(last_accessed_at=func.now())
            )
            await session.execute(stmt)
            await session.commit()

    @enforce_types
    @trace_method
    async def close_all_other_files(self, *, agent_id: str, keep_file_names: List[str], actor: PydanticUser) -> List[str]:
        """Close every open file for this agent except those in keep_file_names.

        Args:
            agent_id: ID of the agent
            keep_file_names: List of file names to keep open
            actor: User performing the action

        Returns:
            List of file names that were closed
        """
        async with db_registry.async_session() as session:
            stmt = (
                update(FileAgentModel)
                .where(
                    and_(
                        FileAgentModel.agent_id == agent_id,
                        FileAgentModel.organization_id == actor.organization_id,
                        FileAgentModel.is_open.is_(True),
                        # Only add the NOT IN filter when there are names to keep
                        ~FileAgentModel.file_name.in_(keep_file_names) if keep_file_names else True,
                    )
                )
                .values(is_open=False, visible_content=None)
                .returning(FileAgentModel.file_name)  # Gets the names we closed
                .execution_options(synchronize_session=False)  # No need to sync ORM state
            )

            closed_file_names = [row.file_name for row in (await session.execute(stmt))]
            await session.commit()
            return closed_file_names

    @enforce_types
    @trace_method
    async def enforce_max_open_files_and_open(
        self, *, agent_id: str, file_id: str, file_name: str, actor: PydanticUser, visible_content: str
    ) -> tuple[List[str], bool]:
        """
        Efficiently handle LRU eviction and file opening in a single transaction.

        Args:
            agent_id: ID of the agent
            file_id: ID of the file to open
            file_name: Name of the file to open
            actor: User performing the action
            visible_content: Content to set for the opened file

        Returns:
            Tuple of (closed_file_names, file_was_already_open)
        """
        async with db_registry.async_session() as session:
            # Single query to get ALL open files for this agent, ordered by last_accessed_at (oldest first)
            open_files_query = (
                select(FileAgentModel)
                .where(
                    and_(
                        FileAgentModel.agent_id == agent_id,
                        FileAgentModel.organization_id == actor.organization_id,
                        FileAgentModel.is_open.is_(True),
                    )
                )
                .order_by(FileAgentModel.last_accessed_at.asc())  # Oldest first for LRU
            )

            all_open_files = (await session.execute(open_files_query)).scalars().all()

            # Check if the target file exists (open or closed)
            target_file_query = select(FileAgentModel).where(
                and_(
                    FileAgentModel.agent_id == agent_id,
                    FileAgentModel.organization_id == actor.organization_id,
                    FileAgentModel.file_name == file_name,
                )
            )
            file_to_open = await session.scalar(target_file_query)

            # Separate the file we're opening from others (only if it's currently open)
            other_open_files = []
            for file_agent in all_open_files:
                if file_agent.file_name != file_name:
                    other_open_files.append(file_agent)

            file_was_already_open = file_to_open is not None and file_to_open.is_open

            # Calculate how many files need to be closed
            current_other_count = len(other_open_files)
            target_other_count = MAX_FILES_OPEN - 1  # Reserve 1 slot for file we're opening

            closed_file_names = []
            if current_other_count > target_other_count:
                files_to_close_count = current_other_count - target_other_count
                files_to_close = other_open_files[:files_to_close_count]  # Take oldest

                # Bulk close files using a single UPDATE query
                file_ids_to_close = [f.file_id for f in files_to_close]
                closed_file_names = [f.file_name for f in files_to_close]

                if file_ids_to_close:
                    close_stmt = (
                        update(FileAgentModel)
                        .where(
                            and_(
                                FileAgentModel.agent_id == agent_id,
                                FileAgentModel.file_id.in_(file_ids_to_close),
                                FileAgentModel.organization_id == actor.organization_id,
                            )
                        )
                        .values(is_open=False, visible_content=None)
                    )
                    await session.execute(close_stmt)

            # Open the target file (update or create)
            now_ts = datetime.now(timezone.utc)

            if file_to_open:
                # Update existing file
                file_to_open.is_open = True
                file_to_open.visible_content = visible_content
                file_to_open.last_accessed_at = now_ts
                await file_to_open.update_async(session, actor=actor)
            else:
                # Create new file association
                new_file_agent = FileAgentModel(
                    agent_id=agent_id,
                    file_id=file_id,
                    file_name=file_name,
                    organization_id=actor.organization_id,
                    is_open=True,
                    visible_content=visible_content,
                    last_accessed_at=now_ts,
                )
                await new_file_agent.create_async(session, actor=actor)

            return closed_file_names, file_was_already_open

    async def _get_association_by_file_id(self, session, agent_id: str, file_id: str, actor: PydanticUser) -> FileAgentModel:
        q = select(FileAgentModel).where(
            and_(
                FileAgentModel.agent_id == agent_id,
                FileAgentModel.file_id == file_id,
                FileAgentModel.organization_id == actor.organization_id,
            )
        )
        assoc = await session.scalar(q)
        if not assoc:
            raise NoResultFound(f"FileAgent(agent_id={agent_id}, file_id={file_id}) not found in org {actor.organization_id}")
        return assoc

    async def _get_association_by_file_name(self, session, agent_id: str, file_name: str, actor: PydanticUser) -> FileAgentModel:
        q = select(FileAgentModel).where(
            and_(
                FileAgentModel.agent_id == agent_id,
                FileAgentModel.file_name == file_name,
                FileAgentModel.organization_id == actor.organization_id,
            )
        )
        assoc = await session.scalar(q)
        if not assoc:
            raise NoResultFound(f"FileAgent(agent_id={agent_id}, file_name={file_name}) not found in org {actor.organization_id}")
        return assoc
