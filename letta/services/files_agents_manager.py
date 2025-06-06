from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import and_, func, select, update

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
    ) -> PydanticFileAgent:
        """
        Idempotently attach *file_id* to *agent_id*.

        • If the row already exists → update `is_open`, `visible_content`
          and always refresh `last_accessed_at`.
        • Otherwise create a brand-new association.
        """
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
                return existing.to_pydantic()

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
            return assoc.to_pydantic()

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
        self,
        agent_id: str,
        actor: PydanticUser,
        is_open_only: bool = False,
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
