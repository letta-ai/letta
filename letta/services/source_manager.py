import asyncio
from typing import List, Optional, Union

from sqlalchemy import and_, exists, select

from letta.helpers.pinecone_utils import should_use_pinecone
from letta.helpers.tpuf_client import should_use_tpuf
from letta.orm import Agent as AgentModel
from letta.orm.errors import NoResultFound
from letta.orm.source import Source as SourceModel
from letta.orm.sources_agents import SourcesAgents
from letta.otel.tracing import trace_method
from letta.schemas.agent import AgentState as PydanticAgentState
from letta.schemas.enums import PrimitiveType, VectorDBProvider
from letta.schemas.source import Source as PydanticSource, SourceUpdate
from letta.schemas.user import User as PydanticUser
from letta.server.db import db_registry
from letta.utils import enforce_types, printd
from letta.validators import raise_on_invalid_id


class SourceManager:
    def _get_vector_db_provider(self) -> VectorDBProvider:
        """
        determine which vector db provider to use based on configuration.
        turbopuffer takes precedence when available.
        """
        if should_use_tpuf():
            return VectorDBProvider.TPUF
        elif should_use_pinecone():
            return VectorDBProvider.PINECONE
        else:
            return VectorDBProvider.NATIVE

    """Manager class to handle business logic related to Sources."""

    @trace_method
    async def _validate_source_exists_async(self, session, source_id: str, actor: PydanticUser) -> None:
        """
        Validate that a source exists and user has access to it using raw SQL for efficiency.

        Args:
            session: Database session
            source_id: ID of the source to validate
            actor: User performing the action

        Raises:
            NoResultFound: If source doesn't exist or user doesn't have access
        """
        source_exists_query = select(
            exists().where(
                and_(SourceModel.id == source_id, SourceModel.organization_id == actor.organization_id, SourceModel.is_deleted == False)
            )
        )

        result = await session.execute(source_exists_query)

        if not result.scalar():
            raise NoResultFound(f"Source with ID {source_id} not found")

    @enforce_types
    @trace_method
    async def create_source(self, source: PydanticSource, actor: PydanticUser) -> PydanticSource:
        """Create a new source based on the PydanticSource schema."""
        try:
            db_source = await self.get_source_by_id(source.id, actor=actor)
        except NoResultFound:
            db_source = None

        if db_source:
            return db_source
        else:
            vector_db_provider = self._get_vector_db_provider()

            async with db_registry.async_session() as session:
                # Provide default embedding config if not given
                source.organization_id = actor.organization_id
                source.vector_db_provider = vector_db_provider
                source = SourceModel(**source.model_dump(to_orm=True, exclude_none=True))
                await source.create_async(session, actor=actor)
                return source.to_pydantic()

    @enforce_types
    @trace_method
    async def bulk_upsert_sources_async(self, pydantic_sources: List[PydanticSource], actor: PydanticUser) -> List[PydanticSource]:
        """
        Bulk create or update multiple sources in a single database transaction.

        Uses optimized PostgreSQL bulk upsert when available, falls back to individual
        upserts for SQLite. This is much more efficient than calling create_source
        in a loop.

        IMPORTANT BEHAVIOR NOTES:
        - Sources are matched by (name, organization_id) unique constraint, NOT by ID
        - If a source with the same name already exists for the organization, it will be updated
          regardless of any ID provided in the input source
        - The existing source's ID is preserved during updates
        - If you provide a source with an explicit ID but a name that matches an existing source,
          the existing source will be updated and the provided ID will be ignored
        - This matches the behavior of create_source which also checks by ID first

        PostgreSQL optimization:
        - Uses native ON CONFLICT (name, organization_id) DO UPDATE for atomic upserts
        - All sources are processed in a single SQL statement for maximum efficiency

        SQLite fallback:
        - Falls back to individual create_source calls
        - Still benefits from batched transaction handling

        Args:
            pydantic_sources: List of sources to create or update
            actor: User performing the action

        Returns:
            List of created/updated sources
        """
        vector_db_provider = self._get_vector_db_provider()
        for pydantic_source in pydantic_sources:
            pydantic_source.vector_db_provider = vector_db_provider

        if not pydantic_sources:
            return []

        from letta.settings import settings

        if settings.letta_pg_uri_no_default:
            # use optimized postgresql bulk upsert
            async with db_registry.async_session() as session:
                return await self._bulk_upsert_postgresql(session, pydantic_sources, actor)
        else:
            # fallback to individual upserts for sqlite
            return await self._upsert_sources_individually(pydantic_sources, actor)

    @trace_method
    async def _bulk_upsert_postgresql(self, session, source_data_list: List[PydanticSource], actor: PydanticUser) -> List[PydanticSource]:
        """Hyper-optimized PostgreSQL bulk upsert using ON CONFLICT DO UPDATE."""
        from sqlalchemy import func, select
        from sqlalchemy.dialects.postgresql import insert

        # prepare data for bulk insert
        table = SourceModel.__table__
        valid_columns = {col.name for col in table.columns}

        insert_data = []
        for source in source_data_list:
            source_dict = source.model_dump(to_orm=True)
            # set created/updated by fields

            if actor:
                source_dict["_created_by_id"] = actor.id
                source_dict["_last_updated_by_id"] = actor.id
                source_dict["organization_id"] = actor.organization_id

            # filter to only include columns that exist in the table
            filtered_dict = {k: v for k, v in source_dict.items() if k in valid_columns}
            insert_data.append(filtered_dict)

        # use postgresql's native bulk upsert
        stmt = insert(table).values(insert_data)

        # on conflict, update all columns except id, created_at, and _created_by_id
        excluded = stmt.excluded
        update_dict = {}
        for col in table.columns:
            if col.name not in ("id", "created_at", "_created_by_id"):
                if col.name == "updated_at":
                    update_dict[col.name] = func.now()
                else:
                    update_dict[col.name] = excluded[col.name]

        upsert_stmt = stmt.on_conflict_do_update(index_elements=["name", "organization_id"], set_=update_dict)
        await session.execute(upsert_stmt)
        await session.commit()

        # fetch results
        source_names = [source.name for source in source_data_list]
        result_query = select(SourceModel).where(
            SourceModel.name.in_(source_names), SourceModel.organization_id == actor.organization_id, SourceModel.is_deleted == False
        )
        result = await session.execute(result_query)
        return [source.to_pydantic() for source in result.scalars()]

    @trace_method
    async def _upsert_sources_individually(self, source_data_list: List[PydanticSource], actor: PydanticUser) -> List[PydanticSource]:
        """Fallback to individual upserts for SQLite."""
        sources = []
        for source in source_data_list:
            # try to get existing source by name
            existing_source = await self.get_source_by_name(source.name, actor)
            if existing_source:
                # update existing source
                from letta.schemas.source import SourceUpdate

                update_data = source.model_dump(exclude={"id", "vector_db_provider"}, exclude_none=True)
                updated_source = await self.update_source(existing_source.id, SourceUpdate(**update_data), actor)
                sources.append(updated_source)
            else:
                # create new source
                created_source = await self.create_source(source, actor)
                sources.append(created_source)
        return sources

    @enforce_types
    @trace_method
    @raise_on_invalid_id(param_name="source_id", expected_prefix=PrimitiveType.SOURCE)
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
    @raise_on_invalid_id(param_name="source_id", expected_prefix=PrimitiveType.SOURCE)
    async def delete_source(self, source_id: str, actor: PydanticUser) -> PydanticSource:
        """Delete a source by its ID."""
        async with db_registry.async_session() as session:
            source = await SourceModel.read_async(db_session=session, identifier=source_id)
            await source.hard_delete_async(db_session=session, actor=actor)
            return source.to_pydantic()

    @enforce_types
    @trace_method
    async def list_sources(
        self,
        actor: PydanticUser,
        before: Optional[str] = None,
        after: Optional[str] = None,
        limit: Optional[int] = 50,
        ascending: bool = True,
        name: Optional[str] = None,
        **kwargs,
    ) -> List[PydanticSource]:
        """List all sources with optional pagination."""
        async with db_registry.async_session() as session:
            sources = await SourceModel.list_async(
                db_session=session,
                before=before,
                after=after,
                limit=limit,
                ascending=ascending,
                organization_id=actor.organization_id,
                query_text=name,
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
    @raise_on_invalid_id(param_name="source_id", expected_prefix=PrimitiveType.SOURCE)
    async def list_attached_agents(
        self, source_id: str, actor: PydanticUser, ids_only: bool = False
    ) -> Union[List[PydanticAgentState], List[str]]:
        """
        Lists all agents that have the specified source attached.

        Args:
            source_id: ID of the source to find attached agents for
            actor: User performing the action
            ids_only: If True, return only agent IDs instead of full agent states

        Returns:
            List[PydanticAgentState] | List[str]: List of agents or agent IDs that have this source attached
        """
        async with db_registry.async_session() as session:
            # Verify source exists and user has permission to access it
            await self._validate_source_exists_async(session, source_id, actor)

            if ids_only:
                # Query only agent IDs for performance
                query = (
                    select(AgentModel.id)
                    .join(SourcesAgents, AgentModel.id == SourcesAgents.agent_id)
                    .where(
                        SourcesAgents.source_id == source_id,
                        AgentModel.organization_id == actor.organization_id,
                        AgentModel.is_deleted == False,
                    )
                    .order_by(AgentModel.created_at.desc(), AgentModel.id)
                )

                result = await session.execute(query)
                return list(result.scalars().all())
            else:
                # Use junction table query instead of relationship to avoid performance issues
                query = (
                    select(AgentModel)
                    .join(SourcesAgents, AgentModel.id == SourcesAgents.agent_id)
                    .where(
                        SourcesAgents.source_id == source_id,
                        AgentModel.organization_id == actor.organization_id,
                        AgentModel.is_deleted == False,
                    )
                    .order_by(AgentModel.created_at.desc(), AgentModel.id)
                )

                result = await session.execute(query)
                agents_orm = result.scalars().all()

                return await asyncio.gather(*[agent.to_pydantic_async() for agent in agents_orm])

    @enforce_types
    @trace_method
    @raise_on_invalid_id(param_name="source_id", expected_prefix=PrimitiveType.SOURCE)
    async def get_agents_for_source_id(
        self,
        source_id: str,
        actor: PydanticUser,
        before: Optional[str] = None,
        after: Optional[str] = None,
        limit: Optional[int] = 50,
        ascending: bool = True,
    ) -> List[str]:
        """
        Get all agent IDs associated with a given source ID.

        Args:
            source_id: ID of the source to find agents for
            actor: User performing the action
            before: Agent ID cursor for pagination (upper bound)
            after: Agent ID cursor for pagination (lower bound)
            limit: Maximum number of agent IDs to return
            ascending: Sort direction by creation time

        Returns:
            List[str]: List of agent IDs that have this source attached
        """
        async with db_registry.async_session() as session:
            # Verify source exists and user has permission to access it
            await self._validate_source_exists_async(session, source_id, actor)

            # Get reference objects for pagination
            before_obj = None
            after_obj = None

            if before:
                before_obj = await session.get(AgentModel, before)
                if not before_obj:
                    from letta.orm.errors import NoResultFound

                    raise NoResultFound(f"No Agent found with id {before}")

            if after:
                after_obj = await session.get(AgentModel, after)
                if not after_obj:
                    from letta.orm.errors import NoResultFound

                    raise NoResultFound(f"No Agent found with id {after}")

            # Build query with join to AgentModel for ordering and pagination
            query = (
                select(AgentModel.id)
                .join(SourcesAgents, AgentModel.id == SourcesAgents.agent_id)
                .where(
                    SourcesAgents.source_id == source_id,
                    AgentModel.organization_id == actor.organization_id,
                    AgentModel.is_deleted == False,
                )
            )

            # Apply pagination conditions
            if before_obj or after_obj:
                from sqlalchemy import and_, or_

                conditions = []

                if before_obj and after_obj:
                    # Window-based query
                    conditions.append(
                        or_(
                            AgentModel.created_at < before_obj.created_at,
                            and_(AgentModel.created_at == before_obj.created_at, AgentModel.id < before_obj.id),
                        )
                    )
                    conditions.append(
                        or_(
                            AgentModel.created_at > after_obj.created_at,
                            and_(AgentModel.created_at == after_obj.created_at, AgentModel.id > after_obj.id),
                        )
                    )
                else:
                    if before_obj:
                        conditions.append(
                            or_(
                                AgentModel.created_at < before_obj.created_at
                                if ascending
                                else AgentModel.created_at > before_obj.created_at,
                                and_(AgentModel.created_at == before_obj.created_at, AgentModel.id < before_obj.id),
                            )
                        )
                    if after_obj:
                        conditions.append(
                            or_(
                                AgentModel.created_at > after_obj.created_at if ascending else AgentModel.created_at < after_obj.created_at,
                                and_(AgentModel.created_at == after_obj.created_at, AgentModel.id > after_obj.id),
                            )
                        )

                if conditions:
                    query = query.where(and_(*conditions))

            # Apply ordering
            if ascending:
                query = query.order_by(AgentModel.created_at.asc(), AgentModel.id.asc())
            else:
                query = query.order_by(AgentModel.created_at.desc(), AgentModel.id.desc())

            # Apply limit
            query = query.limit(limit)

            result = await session.execute(query)
            agent_ids = result.scalars().all()

            return list(agent_ids)

    # TODO: We make actor optional for now, but should most likely be enforced due to security reasons
    @enforce_types
    @trace_method
    @raise_on_invalid_id(param_name="source_id", expected_prefix=PrimitiveType.SOURCE)
    async def get_source_by_id(self, source_id: str, actor: Optional[PydanticUser] = None) -> Optional[PydanticSource]:
        """Retrieve a source by its ID."""
        async with db_registry.async_session() as session:
            source = await SourceModel.read_async(db_session=session, identifier=source_id, actor=actor)
            return source.to_pydantic()

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
                raise NoResultFound(f"Source with name={source_name} not found.")
            else:
                return sources[0].to_pydantic()

    @enforce_types
    @trace_method
    async def get_sources_by_ids_async(self, source_ids: List[str], actor: PydanticUser) -> List[PydanticSource]:
        """
        Get multiple sources by their IDs in a single query.

        Args:
            source_ids: List of source IDs to retrieve
            actor: User performing the action

        Returns:
            List[PydanticSource]: List of sources (may be fewer than requested if some don't exist)
        """
        if not source_ids:
            return []

        async with db_registry.async_session() as session:
            query = select(SourceModel).where(
                SourceModel.id.in_(source_ids), SourceModel.organization_id == actor.organization_id, SourceModel.is_deleted == False
            )

            result = await session.execute(query)
            sources_orm = result.scalars().all()

            return [source.to_pydantic() for source in sources_orm]

    @enforce_types
    @trace_method
    async def get_sources_for_agents_async(self, agent_ids: List[str], actor: PydanticUser) -> List[PydanticSource]:
        """
        Get all sources associated with the given agents via sources-agents relationships.

        Args:
            agent_ids: List of agent IDs to find sources for
            actor: User performing the action

        Returns:
            List[PydanticSource]: List of unique sources associated with these agents
        """
        if not agent_ids:
            return []

        async with db_registry.async_session() as session:
            # Join through sources-agents junction table
            query = (
                select(SourceModel)
                .join(SourcesAgents, SourceModel.id == SourcesAgents.source_id)
                .where(
                    SourcesAgents.agent_id.in_(agent_ids),
                    SourceModel.organization_id == actor.organization_id,
                    SourceModel.is_deleted == False,
                )
                .distinct()  # Ensure we don't get duplicate sources
            )

            result = await session.execute(query)
            sources_orm = result.scalars().all()

            return [source.to_pydantic() for source in sources_orm]

    @enforce_types
    @trace_method
    async def get_existing_source_names(self, source_names: List[str], actor: PydanticUser) -> set[str]:
        """
        Fast batch check to see which source names already exist for the organization.

        Args:
            source_names: List of source names to check
            actor: User performing the action

        Returns:
            Set of source names that already exist
        """
        if not source_names:
            return set()

        async with db_registry.async_session() as session:
            query = select(SourceModel.name).where(
                SourceModel.name.in_(source_names), SourceModel.organization_id == actor.organization_id, SourceModel.is_deleted == False
            )

            result = await session.execute(query)
            existing_names = result.scalars().all()

            return set(existing_names)
