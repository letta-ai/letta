from typing import List, Optional

from sqlalchemy import select

from letta.helpers.tpuf_client import should_use_tpuf
from letta.log import get_logger
from letta.orm import ArchivalPassage, Archive as ArchiveModel, ArchivesAgents
from letta.otel.tracing import trace_method
from letta.schemas.archive import Archive as PydanticArchive
from letta.schemas.enums import VectorDBProvider
from letta.schemas.user import User as PydanticUser
from letta.server.db import db_registry
from letta.settings import settings
from letta.utils import enforce_types

logger = get_logger(__name__)


class ArchiveManager:
    """Manager class to handle business logic related to Archives."""

    @enforce_types
    @trace_method
    def create_archive(
        self,
        name: str,
        description: Optional[str] = None,
        actor: PydanticUser = None,
    ) -> PydanticArchive:
        """Create a new archive."""
        try:
            with db_registry.session() as session:
                # determine vector db provider based on settings
                vector_db_provider = VectorDBProvider.TPUF if should_use_tpuf() else VectorDBProvider.NATIVE

                archive = ArchiveModel(
                    name=name,
                    description=description,
                    organization_id=actor.organization_id,
                    vector_db_provider=vector_db_provider,
                )
                archive.create(session, actor=actor)
                return archive.to_pydantic()
        except Exception as e:
            logger.exception(f"Failed to create archive {name}. error={e}")
            raise

    @enforce_types
    @trace_method
    async def create_archive_async(
        self,
        name: str,
        description: Optional[str] = None,
        actor: PydanticUser = None,
    ) -> PydanticArchive:
        """Create a new archive."""
        try:
            async with db_registry.async_session() as session:
                # determine vector db provider based on settings
                vector_db_provider = VectorDBProvider.TPUF if should_use_tpuf() else VectorDBProvider.NATIVE

                archive = ArchiveModel(
                    name=name,
                    description=description,
                    organization_id=actor.organization_id,
                    vector_db_provider=vector_db_provider,
                )
                await archive.create_async(session, actor=actor)
                return archive.to_pydantic()
        except Exception as e:
            logger.exception(f"Failed to create archive {name}. error={e}")
            raise

    @enforce_types
    @trace_method
    async def get_archive_by_id_async(
        self,
        archive_id: str,
        actor: PydanticUser,
    ) -> PydanticArchive:
        """Get an archive by ID."""
        async with db_registry.async_session() as session:
            archive = await ArchiveModel.read_async(
                db_session=session,
                identifier=archive_id,
                actor=actor,
            )
            return archive.to_pydantic()

    @enforce_types
    @trace_method
    async def update_archive_async(
        self,
        archive_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        actor: PydanticUser = None,
    ) -> PydanticArchive:
        """Update archive name and/or description."""
        async with db_registry.async_session() as session:
            archive = await ArchiveModel.read_async(
                db_session=session,
                identifier=archive_id,
                actor=actor,
                check_is_deleted=True,
            )

            if name is not None:
                archive.name = name
            if description is not None:
                archive.description = description

            await archive.update_async(session, actor=actor)
            return archive.to_pydantic()

    @enforce_types
    @trace_method
    async def list_archives_async(
        self,
        *,
        actor: PydanticUser,
        before: Optional[str] = None,
        after: Optional[str] = None,
        limit: Optional[int] = 50,
        ascending: bool = False,
        name: Optional[str] = None,
        agent_id: Optional[str] = None,
    ) -> List[PydanticArchive]:
        """List archives with pagination and optional filters.

        Filters:
        - name: exact match on name
        - agent_id: only archives attached to given agent
        """
        filter_kwargs = {}
        if name is not None:
            filter_kwargs["name"] = name

        join_model = None
        join_conditions = None
        if agent_id is not None:
            join_model = ArchivesAgents
            join_conditions = [
                ArchivesAgents.archive_id == ArchiveModel.id,
                ArchivesAgents.agent_id == agent_id,
            ]

        async with db_registry.async_session() as session:
            archives = await ArchiveModel.list_async(
                db_session=session,
                before=before,
                after=after,
                limit=limit,
                ascending=ascending,
                actor=actor,
                check_is_deleted=True,
                join_model=join_model,
                join_conditions=join_conditions,
                **filter_kwargs,
            )
            return [a.to_pydantic() for a in archives]

    @enforce_types
    @trace_method
    def attach_agent_to_archive(
        self,
        agent_id: str,
        archive_id: str,
        is_owner: bool,
        actor: PydanticUser,
    ) -> None:
        """Attach an agent to an archive."""
        with db_registry.session() as session:
            # Check if already attached
            existing = session.query(ArchivesAgents).filter_by(agent_id=agent_id, archive_id=archive_id).first()

            if existing:
                # Update ownership if needed
                if existing.is_owner != is_owner:
                    existing.is_owner = is_owner
                    session.commit()
                return

            # Create new relationship
            archives_agents = ArchivesAgents(
                agent_id=agent_id,
                archive_id=archive_id,
                is_owner=is_owner,
            )
            session.add(archives_agents)
            session.commit()

    @enforce_types
    @trace_method
    async def attach_agent_to_archive_async(
        self,
        agent_id: str,
        archive_id: str,
        is_owner: bool = False,
        actor: PydanticUser = None,
    ) -> None:
        """Attach an agent to an archive."""
        async with db_registry.async_session() as session:
            # Check if relationship already exists
            existing = await session.execute(
                select(ArchivesAgents).where(
                    ArchivesAgents.agent_id == agent_id,
                    ArchivesAgents.archive_id == archive_id,
                )
            )
            existing_record = existing.scalar_one_or_none()

            if existing_record:
                # Update ownership if needed
                if existing_record.is_owner != is_owner:
                    existing_record.is_owner = is_owner
                    await session.commit()
                return

            # Create the relationship
            archives_agents = ArchivesAgents(
                agent_id=agent_id,
                archive_id=archive_id,
                is_owner=is_owner,
            )
            session.add(archives_agents)
            await session.commit()

    @enforce_types
    @trace_method
    async def get_default_archive_for_agent_async(
        self,
        agent_id: str,
        actor: PydanticUser = None,
    ) -> Optional[PydanticArchive]:
        """Get the agent's default archive if it exists, return None otherwise."""
        # First check if agent has any archives
        from letta.services.agent_manager import AgentManager

        agent_manager = AgentManager()

        archive_ids = await agent_manager.get_agent_archive_ids_async(
            agent_id=agent_id,
            actor=actor,
        )

        if archive_ids:
            # TODO: Remove this check once we support multiple archives per agent
            if len(archive_ids) > 1:
                raise ValueError(f"Agent {agent_id} has multiple archives, which is not yet supported")
            # Get the archive
            archive = await self.get_archive_by_id_async(
                archive_id=archive_ids[0],
                actor=actor,
            )
            return archive

        # No archive found, return None
        return None

    @enforce_types
    @trace_method
    async def delete_archive_async(
        self,
        archive_id: str,
        actor: PydanticUser = None,
    ) -> None:
        """Delete an archive permanently."""
        async with db_registry.async_session() as session:
            archive_model = await ArchiveModel.read_async(
                db_session=session,
                identifier=archive_id,
                actor=actor,
            )
            await archive_model.hard_delete_async(session, actor=actor)
            logger.info(f"Deleted archive {archive_id}")

    @enforce_types
    @trace_method
    async def get_or_create_default_archive_for_agent_async(
        self,
        agent_id: str,
        agent_name: Optional[str] = None,
        actor: PydanticUser = None,
    ) -> PydanticArchive:
        """Get the agent's default archive, creating one if it doesn't exist."""
        # First check if agent has any archives
        from sqlalchemy.exc import IntegrityError

        from letta.services.agent_manager import AgentManager

        agent_manager = AgentManager()

        archive_ids = await agent_manager.get_agent_archive_ids_async(
            agent_id=agent_id,
            actor=actor,
        )

        if archive_ids:
            # TODO: Remove this check once we support multiple archives per agent
            if len(archive_ids) > 1:
                raise ValueError(f"Agent {agent_id} has multiple archives, which is not yet supported")
            # Get the archive
            archive = await self.get_archive_by_id_async(
                archive_id=archive_ids[0],
                actor=actor,
            )
            return archive

        # Create a default archive for this agent
        archive_name = f"{agent_name or f'Agent {agent_id}'}'s Archive"
        archive = await self.create_archive_async(
            name=archive_name,
            description="Default archive created automatically",
            actor=actor,
        )

        try:
            # Attach the agent to the archive as owner
            await self.attach_agent_to_archive_async(
                agent_id=agent_id,
                archive_id=archive.id,
                is_owner=True,
                actor=actor,
            )
            return archive
        except IntegrityError:
            # race condition: another concurrent request already created and attached an archive
            # clean up the orphaned archive we just created
            logger.info(f"Race condition detected for agent {agent_id}, cleaning up orphaned archive {archive.id}")
            await self.delete_archive_async(archive_id=archive.id, actor=actor)

            # fetch the existing archive that was created by the concurrent request
            archive_ids = await agent_manager.get_agent_archive_ids_async(
                agent_id=agent_id,
                actor=actor,
            )
            if archive_ids:
                archive = await self.get_archive_by_id_async(
                    archive_id=archive_ids[0],
                    actor=actor,
                )
                return archive
            else:
                # this shouldn't happen, but if it does, re-raise
                raise

    @enforce_types
    @trace_method
    def get_or_create_default_archive_for_agent(
        self,
        agent_id: str,
        agent_name: Optional[str] = None,
        actor: PydanticUser = None,
    ) -> PydanticArchive:
        """Get the agent's default archive, creating one if it doesn't exist."""
        with db_registry.session() as session:
            # First check if agent has any archives
            query = select(ArchivesAgents.archive_id).where(ArchivesAgents.agent_id == agent_id)
            result = session.execute(query)
            archive_ids = [row[0] for row in result.fetchall()]

            if archive_ids:
                # TODO: Remove this check once we support multiple archives per agent
                if len(archive_ids) > 1:
                    raise ValueError(f"Agent {agent_id} has multiple archives, which is not yet supported")
                # Get the archive
                archive = ArchiveModel.read(db_session=session, identifier=archive_ids[0], actor=actor)
                return archive.to_pydantic()

            # Create a default archive for this agent
            archive_name = f"{agent_name or f'Agent {agent_id}'}'s Archive"

            # Create the archive
            archive_model = ArchiveModel(
                name=archive_name,
                description="Default archive created automatically",
                organization_id=actor.organization_id,
            )
            archive_model.create(session, actor=actor)

        # Attach the agent to the archive as owner
        self.attach_agent_to_archive(
            agent_id=agent_id,
            archive_id=archive_model.id,
            is_owner=True,
            actor=actor,
        )

        return archive_model.to_pydantic()

    @enforce_types
    @trace_method
    async def get_agents_for_archive_async(
        self,
        archive_id: str,
        actor: PydanticUser,
    ) -> List[str]:
        """Get all agent IDs that have access to an archive."""
        async with db_registry.async_session() as session:
            result = await session.execute(select(ArchivesAgents.agent_id).where(ArchivesAgents.archive_id == archive_id))
            return [row[0] for row in result.fetchall()]

    @enforce_types
    @trace_method
    async def get_agent_from_passage_async(
        self,
        passage_id: str,
        actor: PydanticUser,
    ) -> Optional[str]:
        """Get the agent ID that owns a passage (through its archive).

        Returns the first agent found (for backwards compatibility).
        Returns None if no agent found.
        """
        async with db_registry.async_session() as session:
            # First get the passage to find its archive_id
            passage = await ArchivalPassage.read_async(
                db_session=session,
                identifier=passage_id,
                actor=actor,
            )

            # Then find agents connected to that archive
            result = await session.execute(select(ArchivesAgents.agent_id).where(ArchivesAgents.archive_id == passage.archive_id))
            agent_ids = [row[0] for row in result.fetchall()]

            if not agent_ids:
                return None

            # For now, return the first agent (backwards compatibility)
            return agent_ids[0]

    @enforce_types
    @trace_method
    async def get_or_set_vector_db_namespace_async(
        self,
        archive_id: str,
    ) -> str:
        """Get the vector database namespace for an archive, creating it if it doesn't exist."""
        from sqlalchemy import update

        async with db_registry.async_session() as session:
            # check if namespace already exists
            result = await session.execute(select(ArchiveModel._vector_db_namespace).where(ArchiveModel.id == archive_id))
            row = result.fetchone()

            if row and row[0]:
                return row[0]

            # generate namespace name using same logic as tpuf_client
            environment = settings.environment
            if environment:
                namespace_name = f"archive_{archive_id}_{environment.lower()}"
            else:
                namespace_name = f"archive_{archive_id}"

            # update the archive with the namespace
            await session.execute(update(ArchiveModel).where(ArchiveModel.id == archive_id).values(_vector_db_namespace=namespace_name))
            await session.commit()

            return namespace_name
