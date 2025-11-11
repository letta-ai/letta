import asyncio
from datetime import datetime
from typing import Dict, List, Optional

from sqlalchemy import delete, or_, select

from letta.helpers.tpuf_client import should_use_tpuf
from letta.log import get_logger
from letta.orm import ArchivalPassage, Archive as ArchiveModel, ArchivesAgents
from letta.otel.tracing import trace_method
from letta.schemas.agent import AgentState as PydanticAgentState
from letta.schemas.archive import Archive as PydanticArchive
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import PrimitiveType, VectorDBProvider
from letta.schemas.passage import Passage as PydanticPassage
from letta.schemas.user import User as PydanticUser
from letta.server.db import db_registry
from letta.services.helpers.agent_manager_helper import validate_agent_exists_async
from letta.settings import DatabaseChoice, settings
from letta.utils import enforce_types
from letta.validators import raise_on_invalid_id

logger = get_logger(__name__)


class ArchiveManager:
    """Manager class to handle business logic related to Archives."""

    @enforce_types
    @trace_method
    async def create_archive_async(
        self,
        name: str,
        embedding_config: EmbeddingConfig,
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
                    embedding_config=embedding_config,
                )
                await archive.create_async(session, actor=actor)
                return archive.to_pydantic()
        except Exception as e:
            logger.exception(f"Failed to create archive {name}. error={e}")
            raise

    @enforce_types
    @trace_method
    @raise_on_invalid_id(param_name="archive_id", expected_prefix=PrimitiveType.ARCHIVE)
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
    @raise_on_invalid_id(param_name="archive_id", expected_prefix=PrimitiveType.ARCHIVE)
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
    @raise_on_invalid_id(param_name="agent_id", expected_prefix=PrimitiveType.AGENT)
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
            if agent_id:
                await validate_agent_exists_async(session, agent_id, actor)

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
    @raise_on_invalid_id(param_name="agent_id", expected_prefix=PrimitiveType.AGENT)
    @raise_on_invalid_id(param_name="archive_id", expected_prefix=PrimitiveType.ARCHIVE)
    async def attach_agent_to_archive_async(
        self,
        agent_id: str,
        archive_id: str,
        is_owner: bool = False,
        actor: PydanticUser = None,
    ) -> None:
        """Attach an agent to an archive."""
        async with db_registry.async_session() as session:
            # Verify agent exists and user has access to it
            await validate_agent_exists_async(session, agent_id, actor)

            # Verify archive exists and user has access to it
            await ArchiveModel.read_async(db_session=session, identifier=archive_id, actor=actor)

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
    @raise_on_invalid_id(param_name="agent_id", expected_prefix=PrimitiveType.AGENT)
    @raise_on_invalid_id(param_name="archive_id", expected_prefix=PrimitiveType.ARCHIVE)
    async def detach_agent_from_archive_async(
        self,
        agent_id: str,
        archive_id: str,
        actor: PydanticUser = None,
    ) -> None:
        """Detach an agent from an archive."""
        async with db_registry.async_session() as session:
            # Verify agent exists and user has access to it
            await validate_agent_exists_async(session, agent_id, actor)

            # Verify archive exists and user has access to it
            await ArchiveModel.read_async(db_session=session, identifier=archive_id, actor=actor)

            # Delete the relationship directly
            result = await session.execute(
                delete(ArchivesAgents).where(
                    ArchivesAgents.agent_id == agent_id,
                    ArchivesAgents.archive_id == archive_id,
                )
            )

            if result.rowcount == 0:
                logger.warning(f"Attempted to detach unattached agent {agent_id} from archive {archive_id}")
            else:
                logger.info(f"Detached agent {agent_id} from archive {archive_id}")

            await session.commit()

    @enforce_types
    @trace_method
    @raise_on_invalid_id(param_name="agent_id", expected_prefix=PrimitiveType.AGENT)
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
    @raise_on_invalid_id(param_name="archive_id", expected_prefix=PrimitiveType.ARCHIVE)
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
    @raise_on_invalid_id(param_name="archive_id", expected_prefix=PrimitiveType.ARCHIVE)
    async def create_passage_in_archive_async(
        self,
        archive_id: str,
        text: str,
        metadata: Dict = None,
        tags: List[str] = None,
        actor: PydanticUser = None,
    ) -> PydanticPassage:
        """Create a passage in an archive.

        Args:
            archive_id: ID of the archive to add the passage to
            text: The text content of the passage
            metadata: Optional metadata for the passage
            tags: Optional tags for categorizing the passage
            actor: User performing the operation

        Returns:
            The created passage

        Raises:
            NoResultFound: If archive not found
        """
        from letta.llm_api.llm_client import LLMClient
        from letta.services.passage_manager import PassageManager

        # Verify the archive exists and user has access
        archive = await self.get_archive_by_id_async(archive_id=archive_id, actor=actor)

        # Generate embeddings for the text
        embedding_client = LLMClient.create(
            provider_type=archive.embedding_config.embedding_endpoint_type,
            actor=actor,
        )
        embeddings = await embedding_client.request_embeddings([text], archive.embedding_config)
        embedding = embeddings[0] if embeddings else None

        # Create the passage object with embedding
        passage = PydanticPassage(
            text=text,
            archive_id=archive_id,
            organization_id=actor.organization_id,
            metadata=metadata or {},
            tags=tags,
            embedding_config=archive.embedding_config,
            embedding=embedding,
        )

        # Use PassageManager to create the passage
        passage_manager = PassageManager()
        created_passage = await passage_manager.create_agent_passage_async(
            pydantic_passage=passage,
            actor=actor,
        )

        logger.info(f"Created passage {created_passage.id} in archive {archive_id}")
        return created_passage

    @enforce_types
    @trace_method
    @raise_on_invalid_id(param_name="archive_id", expected_prefix=PrimitiveType.ARCHIVE)
    @raise_on_invalid_id(param_name="passage_id", expected_prefix=PrimitiveType.PASSAGE)
    async def delete_passage_from_archive_async(
        self,
        archive_id: str,
        passage_id: str,
        actor: PydanticUser = None,
        strict_mode: bool = False,
    ) -> None:
        """Delete a passage from an archive.

        Args:
            archive_id: ID of the archive containing the passage
            passage_id: ID of the passage to delete
            actor: User performing the operation
            strict_mode: If True, raise errors on Turbopuffer failures

        Raises:
            NoResultFound: If archive or passage not found
            ValueError: If passage does not belong to the specified archive
        """
        from letta.services.passage_manager import PassageManager

        await self.get_archive_by_id_async(archive_id=archive_id, actor=actor)

        passage_manager = PassageManager()
        passage = await passage_manager.get_agent_passage_by_id_async(passage_id=passage_id, actor=actor)

        if passage.archive_id != archive_id:
            raise ValueError(f"Passage {passage_id} does not belong to archive {archive_id}")

        await passage_manager.delete_agent_passage_by_id_async(
            passage_id=passage_id,
            actor=actor,
            strict_mode=strict_mode,
        )
        logger.info(f"Deleted passage {passage_id} from archive {archive_id}")

    @enforce_types
    @trace_method
    async def get_or_create_default_archive_for_agent_async(
        self,
        agent_state: PydanticAgentState,
        actor: PydanticUser = None,
    ) -> PydanticArchive:
        """Get the agent's default archive, creating one if it doesn't exist."""
        # First check if agent has any archives
        from sqlalchemy.exc import IntegrityError

        from letta.services.agent_manager import AgentManager

        agent_manager = AgentManager()

        archive_ids = await agent_manager.get_agent_archive_ids_async(
            agent_id=agent_state.id,
            actor=actor,
        )

        if archive_ids:
            # TODO: Remove this check once we support multiple archives per agent
            if len(archive_ids) > 1:
                raise ValueError(f"Agent {agent_state.id} has multiple archives, which is not yet supported")
            # Get the archive
            archive = await self.get_archive_by_id_async(
                archive_id=archive_ids[0],
                actor=actor,
            )
            return archive

        # Create a default archive for this agent
        archive_name = f"{agent_state.name}'s Archive"
        archive = await self.create_archive_async(
            name=archive_name,
            embedding_config=agent_state.embedding_config,
            description="Default archive created automatically",
            actor=actor,
        )

        try:
            # Attach the agent to the archive as owner
            await self.attach_agent_to_archive_async(
                agent_id=agent_state.id,
                archive_id=archive.id,
                is_owner=True,
                actor=actor,
            )
            return archive
        except IntegrityError:
            # race condition: another concurrent request already created and attached an archive
            # clean up the orphaned archive we just created
            logger.info(f"Race condition detected for agent {agent_state.id}, cleaning up orphaned archive {archive.id}")
            await self.delete_archive_async(archive_id=archive.id, actor=actor)

            # fetch the existing archive that was created by the concurrent request
            archive_ids = await agent_manager.get_agent_archive_ids_async(
                agent_id=agent_state.id,
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
    @raise_on_invalid_id(param_name="archive_id", expected_prefix=PrimitiveType.ARCHIVE)
    async def get_agents_for_archive_async(
        self,
        archive_id: str,
        actor: PydanticUser,
        before: Optional[str] = None,
        after: Optional[str] = None,
        limit: Optional[int] = 50,
        ascending: bool = False,
        include: List[str] = [],
    ) -> List[PydanticAgentState]:
        """Get agents that have access to an archive with pagination support.

        Uses a subquery approach to avoid expensive JOINs.
        """
        from letta.orm import Agent as AgentModel

        async with db_registry.async_session() as session:
            # Start with a basic query using subquery instead of JOIN
            query = (
                select(AgentModel)
                .where(AgentModel.id.in_(select(ArchivesAgents.agent_id).where(ArchivesAgents.archive_id == archive_id)))
                .where(AgentModel.organization_id == actor.organization_id)
            )

            # Apply pagination using cursor-based approach
            if after:
                result = (await session.execute(select(AgentModel.created_at, AgentModel.id).where(AgentModel.id == after))).first()
                if result:
                    after_sort_value, after_id = result
                    # SQLite does not support as granular timestamping, so we need to round the timestamp
                    if settings.database_engine is DatabaseChoice.SQLITE and isinstance(after_sort_value, datetime):
                        after_sort_value = after_sort_value.strftime("%Y-%m-%d %H:%M:%S")

                    if ascending:
                        query = query.where(
                            AgentModel.created_at > after_sort_value,
                            or_(AgentModel.created_at == after_sort_value, AgentModel.id > after_id),
                        )
                    else:
                        query = query.where(
                            AgentModel.created_at < after_sort_value,
                            or_(AgentModel.created_at == after_sort_value, AgentModel.id < after_id),
                        )

            if before:
                result = (await session.execute(select(AgentModel.created_at, AgentModel.id).where(AgentModel.id == before))).first()
                if result:
                    before_sort_value, before_id = result
                    # SQLite does not support as granular timestamping, so we need to round the timestamp
                    if settings.database_engine is DatabaseChoice.SQLITE and isinstance(before_sort_value, datetime):
                        before_sort_value = before_sort_value.strftime("%Y-%m-%d %H:%M:%S")

                    if ascending:
                        query = query.where(
                            AgentModel.created_at < before_sort_value,
                            or_(AgentModel.created_at == before_sort_value, AgentModel.id < before_id),
                        )
                    else:
                        query = query.where(
                            AgentModel.created_at > before_sort_value,
                            or_(AgentModel.created_at == before_sort_value, AgentModel.id > before_id),
                        )

            # Apply sorting
            if ascending:
                query = query.order_by(AgentModel.created_at.asc(), AgentModel.id.asc())
            else:
                query = query.order_by(AgentModel.created_at.desc(), AgentModel.id.desc())

            # Apply limit
            if limit:
                query = query.limit(limit)

            # Execute the query
            result = await session.execute(query)
            agents_orm = result.scalars().all()

            agents = await asyncio.gather(*[agent.to_pydantic_async(include_relationships=[], include=include) for agent in agents_orm])
            return agents

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
    @raise_on_invalid_id(param_name="archive_id", expected_prefix=PrimitiveType.ARCHIVE)
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
