import asyncio
from typing import List, Optional

from letta.orm.errors import NoResultFound
from letta.orm.source import Source as SourceModel
from letta.otel.tracing import trace_method
from letta.schemas.agent import AgentState as PydanticAgentState
from letta.schemas.source import Source as PydanticSource
from letta.schemas.source import SourceUpdate
from letta.schemas.user import User as PydanticUser
from letta.server.db import db_registry
from letta.utils import enforce_types, printd


class SourceManager:
    """Manager class to handle business logic related to Sources."""

    @enforce_types
    @trace_method
    async def create_source(self, source: PydanticSource, actor: PydanticUser) -> PydanticSource:
        """Create a new source based on the PydanticSource schema."""
        # Try getting the source first by id
        db_source = await self.get_source_by_id(source.id, actor=actor)
        if db_source:
            return db_source
        else:
            async with db_registry.async_session() as session:
                # Provide default embedding config if not given
                source.organization_id = actor.organization_id
                source = SourceModel(**source.model_dump(to_orm=True, exclude_none=True))
                await source.create_async(session, actor=actor)
                return source.to_pydantic()

    @enforce_types
    @trace_method
    async def update_source(self, source_id: str, source_update: SourceUpdate, actor: PydanticUser) -> PydanticSource:
        """Update a source by its ID with the given SourceUpdate object."""
        async with db_registry.async_session() as session:
            source = await SourceModel.read_async(db_session=session, identifier=source_id, actor=actor)

            # get update dictionary
            update_data = source_update.model_dump(to_orm=True, exclude_unset=True, exclude_none=True)
            # Remove redundant update fields
            update_data = {key: value for key, value in update_data.items() if getattr(source, key) != value}

            if update_data:
                for key, value in update_data.items():
                    setattr(source, key, value)
                await source.update_async(db_session=session, actor=actor)
            else:
                printd(
                    f"`update_source` was called with user_id={actor.id}, organization_id={actor.organization_id}, name={source.name}, but found existing source with nothing to update."
                )

            return source.to_pydantic()

    @enforce_types
    @trace_method
    async def delete_source(self, source_id: str, actor: PydanticUser) -> PydanticSource:
        """Delete a source by its ID."""
        async with db_registry.async_session() as session:
            source = await SourceModel.read_async(db_session=session, identifier=source_id)
            await source.hard_delete_async(db_session=session, actor=actor)
            return source.to_pydantic()

    @enforce_types
    @trace_method
    async def list_sources(
        self, actor: PydanticUser, after: Optional[str] = None, limit: Optional[int] = 50, **kwargs
    ) -> List[PydanticSource]:
        """List all sources with optional pagination."""
        async with db_registry.async_session() as session:
            sources = await SourceModel.list_async(
                db_session=session,
                after=after,
                limit=limit,
                organization_id=actor.organization_id,
                **kwargs,
            )
            return [source.to_pydantic() for source in sources]

    @enforce_types
    @trace_method
    async def size_async(self, actor: PydanticUser) -> int:
        """
        Get the total count of sources for the given user.
        """
        async with db_registry.async_session() as session:
            return await SourceModel.size_async(db_session=session, actor=actor)

    @enforce_types
    @trace_method
    async def list_attached_agents(self, source_id: str, actor: Optional[PydanticUser] = None) -> List[PydanticAgentState]:
        """
        Lists all agents that have the specified source attached.

        Args:
            source_id: ID of the source to find attached agents for
            actor: User performing the action (optional for now, following existing pattern)

        Returns:
            List[PydanticAgentState]: List of agents that have this source attached
        """
        async with db_registry.async_session() as session:
            # Verify source exists and user has permission to access it
            source = await SourceModel.read_async(db_session=session, identifier=source_id, actor=actor)

            # The agents relationship is already loaded due to lazy="selectin" in the Source model
            # and will be properly filtered by organization_id due to the OrganizationMixin
            agents_orm = source.agents
            return await asyncio.gather(*[agent.to_pydantic_async() for agent in agents_orm])

    # TODO: We make actor optional for now, but should most likely be enforced due to security reasons
    @enforce_types
    @trace_method
    async def get_source_by_id(self, source_id: str, actor: Optional[PydanticUser] = None) -> Optional[PydanticSource]:
        """Retrieve a source by its ID."""
        async with db_registry.async_session() as session:
            try:
                source = await SourceModel.read_async(db_session=session, identifier=source_id, actor=actor)
                return source.to_pydantic()
            except NoResultFound:
                return None

    @enforce_types
    @trace_method
    async def get_source_by_name(self, source_name: str, actor: PydanticUser) -> Optional[PydanticSource]:
        """Retrieve a source by its name."""
        async with db_registry.async_session() as session:
            sources = await SourceModel.list_async(
                db_session=session,
                name=source_name,
                organization_id=actor.organization_id,
                limit=1,
            )
            if not sources:
                return None
            else:
                return sources[0].to_pydantic()
