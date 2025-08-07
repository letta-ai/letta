from typing import List, Optional

from sqlalchemy import select

from letta.log import get_logger
from letta.orm import ArchivalPassage
from letta.orm import Archive as ArchiveModel
from letta.orm import ArchivesAgents
from letta.schemas.archive import Archive as PydanticArchive
from letta.schemas.user import User as PydanticUser
from letta.server.db import db_registry
from letta.utils import enforce_types

logger = get_logger(__name__)


class ArchiveManager:
    """Manager class to handle business logic related to Archives."""

    @enforce_types
    def create_archive(
        self,
        name: str,
        description: Optional[str] = None,
        actor: PydanticUser = None,
    ) -> PydanticArchive:
        """Create a new archive."""
        try:
            with db_registry.session() as session:
                archive = ArchiveModel(
                    name=name,
                    description=description,
                    organization_id=actor.organization_id,
                )
                archive.create(session, actor=actor)
                return archive.to_pydantic()
        except Exception as e:
            logger.exception(f"Failed to create archive {name}. error={e}")
            raise

    @enforce_types
    async def create_archive_async(
        self,
        name: str,
        description: Optional[str] = None,
        actor: PydanticUser = None,
    ) -> PydanticArchive:
        """Create a new archive."""
        try:
            async with db_registry.async_session() as session:
                archive = ArchiveModel(
                    name=name,
                    description=description,
                    organization_id=actor.organization_id,
                )
                await archive.create_async(session, actor=actor)
                return archive.to_pydantic()
        except Exception as e:
            logger.exception(f"Failed to create archive {name}. error={e}")
            raise

    @enforce_types
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
    async def get_or_create_default_archive_for_agent_async(
        self,
        agent_id: str,
        agent_name: Optional[str] = None,
        actor: PydanticUser = None,
    ) -> PydanticArchive:
        """Get the agent's default archive, creating one if it doesn't exist."""
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

        # Create a default archive for this agent
        archive_name = f"{agent_name or f'Agent {agent_id}'}'s Archive"
        archive = await self.create_archive_async(
            name=archive_name,
            description="Default archive created automatically",
            actor=actor,
        )

        # Attach the agent to the archive as owner
        await self.attach_agent_to_archive_async(
            agent_id=agent_id,
            archive_id=archive.id,
            is_owner=True,
            actor=actor,
        )

        return archive

    @enforce_types
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
