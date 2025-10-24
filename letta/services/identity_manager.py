import asyncio
from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import NoResultFound

from letta.orm.agent import Agent as AgentModel
from letta.orm.block import Block as BlockModel
from letta.orm.errors import UniqueConstraintViolationError
from letta.orm.identity import Identity as IdentityModel
from letta.otel.tracing import trace_method
from letta.schemas.agent import AgentState
from letta.schemas.block import Block
from letta.schemas.enums import PrimitiveType
from letta.schemas.identity import (
    Identity as PydanticIdentity,
    IdentityCreate,
    IdentityProperty,
    IdentityType,
    IdentityUpdate,
    IdentityUpsert,
)
from letta.schemas.user import User as PydanticUser
from letta.server.db import db_registry
from letta.settings import DatabaseChoice, settings
from letta.utils import enforce_types
from letta.validators import raise_on_invalid_id


class IdentityManager:
    @enforce_types
    @trace_method
    async def list_identities_async(
        self,
        name: Optional[str] = None,
        project_id: Optional[str] = None,
        identifier_key: Optional[str] = None,
        identity_type: Optional[IdentityType] = None,
        before: Optional[str] = None,
        after: Optional[str] = None,
        limit: Optional[int] = 50,
        ascending: bool = False,
        actor: PydanticUser = None,
    ) -> tuple[list[PydanticIdentity], Optional[str], bool]:
        """
        List identities with pagination metadata.

        Returns:
            Tuple of (identities, next_cursor, has_more)
        """
        async with db_registry.async_session() as session:
            filters = {"organization_id": actor.organization_id}
            if project_id:
                filters["project_id"] = project_id
            if identifier_key:
                filters["identifier_key"] = identifier_key
            if identity_type:
                filters["identity_type"] = identity_type

            # Request one more than limit to check if there are more pages
            query_limit = limit + 1 if limit else None

            identities = await IdentityModel.list_async(
                db_session=session,
                query_text=name,
                before=before,
                after=after,
                limit=query_limit,
                ascending=ascending,
                **filters,
            )

            # Check if we got more records than requested (meaning there are more pages)
            has_more = len(identities) > limit if limit else False
            if has_more:
                # Trim back to the requested limit
                identities = identities[:limit]

            # Get cursor for next page (ID of last item in current page)
            next_cursor = identities[-1].id if identities else None

            return [identity.to_pydantic() for identity in identities], next_cursor, has_more

    @enforce_types
    @trace_method
    @raise_on_invalid_id(param_name="identity_id", expected_prefix=PrimitiveType.IDENTITY)
    async def get_identity_async(self, identity_id: str, actor: PydanticUser) -> PydanticIdentity:
        async with db_registry.async_session() as session:
            identity = await IdentityModel.read_async(db_session=session, identifier=identity_id, actor=actor)
            return identity.to_pydantic()

    @enforce_types
    @trace_method
    async def create_identity_async(self, identity: IdentityCreate, actor: PydanticUser) -> PydanticIdentity:
        async with db_registry.async_session() as session:
            return await self._create_identity_async(db_session=session, identity=identity, actor=actor)

    async def _create_identity_async(self, db_session, identity: IdentityCreate, actor: PydanticUser) -> PydanticIdentity:
        new_identity = IdentityModel(**identity.model_dump(exclude={"agent_ids", "block_ids"}, exclude_unset=True))
        new_identity.organization_id = actor.organization_id

        # For SQLite compatibility: check for unique constraint violation manually
        # since SQLite doesn't support postgresql_nulls_not_distinct=True
        if settings.database_engine is DatabaseChoice.SQLITE:
            # Check if an identity with the same identifier_key, project_id, and organization_id exists
            query = select(IdentityModel).where(
                IdentityModel.identifier_key == new_identity.identifier_key,
                IdentityModel.project_id == new_identity.project_id,
                IdentityModel.organization_id == new_identity.organization_id,
            )
            result = await db_session.execute(query)
            existing_identity = result.scalar_one_or_none()
            if existing_identity is not None:
                raise UniqueConstraintViolationError(
                    f"A unique constraint was violated for Identity. "
                    f"An identity with identifier_key='{new_identity.identifier_key}', "
                    f"project_id='{new_identity.project_id}', and "
                    f"organization_id='{new_identity.organization_id}' already exists."
                )

        await self._process_relationship_async(
            db_session=db_session,
            identity=new_identity,
            relationship_name="agents",
            model_class=AgentModel,
            item_ids=identity.agent_ids,
            allow_partial=False,
        )
        await self._process_relationship_async(
            db_session=db_session,
            identity=new_identity,
            relationship_name="blocks",
            model_class=BlockModel,
            item_ids=identity.block_ids,
            allow_partial=False,
        )
        await new_identity.create_async(db_session=db_session, actor=actor)
        return new_identity.to_pydantic()

    @enforce_types
    @trace_method
    async def upsert_identity_async(self, identity: IdentityUpsert, actor: PydanticUser) -> PydanticIdentity:
        async with db_registry.async_session() as session:
            existing_identity = await IdentityModel.read_async(
                db_session=session,
                identifier_key=identity.identifier_key,
                project_id=identity.project_id,
                organization_id=actor.organization_id,
                actor=actor,
            )

            if existing_identity is None:
                return await self._create_identity_async(db_session=session, identity=IdentityCreate(**identity.model_dump()), actor=actor)
            else:
                identity_update = IdentityUpdate(
                    name=identity.name,
                    identifier_key=identity.identifier_key,
                    identity_type=identity.identity_type,
                    agent_ids=identity.agent_ids,
                    properties=identity.properties,
                )
                return await self._update_identity_async(
                    db_session=session, existing_identity=existing_identity, identity=identity_update, actor=actor, replace=True
                )

    @enforce_types
    @trace_method
    @raise_on_invalid_id(param_name="identity_id", expected_prefix=PrimitiveType.IDENTITY)
    async def update_identity_async(
        self, identity_id: str, identity: IdentityUpdate, actor: PydanticUser, replace: bool = False
    ) -> PydanticIdentity:
        async with db_registry.async_session() as session:
            try:
                existing_identity = await IdentityModel.read_async(db_session=session, identifier=identity_id, actor=actor)
            except NoResultFound:
                raise HTTPException(status_code=404, detail="Identity not found")
            if existing_identity.organization_id != actor.organization_id:
                raise HTTPException(status_code=403, detail="Forbidden")

            return await self._update_identity_async(
                db_session=session, existing_identity=existing_identity, identity=identity, actor=actor, replace=replace
            )

    async def _update_identity_async(
        self,
        db_session,
        existing_identity: IdentityModel,
        identity: IdentityUpdate,
        actor: PydanticUser,
        replace: bool = False,
    ) -> PydanticIdentity:
        if identity.identifier_key is not None:
            existing_identity.identifier_key = identity.identifier_key
        if identity.name is not None:
            existing_identity.name = identity.name
        if identity.identity_type is not None:
            existing_identity.identity_type = identity.identity_type
        if identity.properties is not None:
            if replace:
                existing_identity.properties = [prop.model_dump() for prop in identity.properties]
            else:
                new_properties = {old_prop["key"]: old_prop for old_prop in existing_identity.properties} | {
                    new_prop.key: new_prop.model_dump() for new_prop in identity.properties
                }
                existing_identity.properties = list(new_properties.values())

        if identity.agent_ids is not None:
            await self._process_relationship_async(
                db_session=db_session,
                identity=existing_identity,
                relationship_name="agents",
                model_class=AgentModel,
                item_ids=identity.agent_ids,
                allow_partial=False,
                replace=replace,
            )
        if identity.block_ids is not None:
            await self._process_relationship_async(
                db_session=db_session,
                identity=existing_identity,
                relationship_name="blocks",
                model_class=BlockModel,
                item_ids=identity.block_ids,
                allow_partial=False,
                replace=replace,
            )
        await existing_identity.update_async(db_session=db_session, actor=actor)
        return existing_identity.to_pydantic()

    @enforce_types
    @trace_method
    @raise_on_invalid_id(param_name="identity_id", expected_prefix=PrimitiveType.IDENTITY)
    async def upsert_identity_properties_async(
        self, identity_id: str, properties: List[IdentityProperty], actor: PydanticUser
    ) -> PydanticIdentity:
        async with db_registry.async_session() as session:
            existing_identity = await IdentityModel.read_async(db_session=session, identifier=identity_id, actor=actor)
            if existing_identity is None:
                raise HTTPException(status_code=404, detail="Identity not found")
            return await self._update_identity_async(
                db_session=session,
                existing_identity=existing_identity,
                identity=IdentityUpdate(properties=properties),
                actor=actor,
                replace=True,
            )

    @enforce_types
    @trace_method
    @raise_on_invalid_id(param_name="identity_id", expected_prefix=PrimitiveType.IDENTITY)
    async def delete_identity_async(self, identity_id: str, actor: PydanticUser) -> None:
        async with db_registry.async_session() as session:
            identity = await IdentityModel.read_async(db_session=session, identifier=identity_id, actor=actor)
            if identity is None:
                raise HTTPException(status_code=404, detail="Identity not found")
            if identity.organization_id != actor.organization_id:
                raise HTTPException(status_code=403, detail="Forbidden")
            await session.delete(identity)
            await session.commit()

    @enforce_types
    @trace_method
    async def size_async(
        self,
        actor: PydanticUser,
    ) -> int:
        """
        Get the total count of identities for the given user.
        """
        async with db_registry.async_session() as session:
            return await IdentityModel.size_async(db_session=session, actor=actor)

    async def _process_relationship_async(
        self,
        db_session,
        identity: PydanticIdentity,
        relationship_name: str,
        model_class,
        item_ids: List[str],
        allow_partial=False,
        replace=True,
    ):
        current_relationship = getattr(identity, relationship_name, [])
        if not item_ids:
            if replace:
                setattr(identity, relationship_name, [])
            return

        # Retrieve models for the provided IDs
        found_items = (await db_session.execute(select(model_class).where(model_class.id.in_(item_ids)))).scalars().all()

        # Validate all items are found if allow_partial is False
        if not allow_partial and len(found_items) != len(item_ids):
            missing = set(item_ids) - {item.id for item in found_items}
            raise NoResultFound(f"Items not found in agents: {missing}")

        if replace:
            # Replace the relationship
            setattr(identity, relationship_name, found_items)
        else:
            # Extend the relationship (only add new items)
            current_ids = {item.id for item in current_relationship}
            new_items = [item for item in found_items if item.id not in current_ids]
            current_relationship.extend(new_items)

    @enforce_types
    @trace_method
    @raise_on_invalid_id(param_name="identity_id", expected_prefix=PrimitiveType.IDENTITY)
    async def list_agents_for_identity_async(
        self,
        identity_id: str,
        before: Optional[str] = None,
        after: Optional[str] = None,
        limit: Optional[int] = 50,
        ascending: bool = False,
        include: List[str] = [],
        actor: PydanticUser = None,
    ) -> List[AgentState]:
        """
        Get all agents associated with the specified identity.
        """
        async with db_registry.async_session() as session:
            # First verify the identity exists and belongs to the user
            identity = await IdentityModel.read_async(db_session=session, identifier=identity_id, actor=actor)
            if identity is None:
                raise HTTPException(status_code=404, detail=f"Identity with id={identity_id} not found")

            # Get agents associated with this identity with pagination
            agents = await AgentModel.list_async(
                db_session=session,
                before=before,
                after=after,
                limit=limit,
                ascending=ascending,
                identity_id=identity.id,
            )
            return await asyncio.gather(*[agent.to_pydantic_async(include_relationships=[], include=include) for agent in agents])

    @enforce_types
    @trace_method
    @raise_on_invalid_id(param_name="identity_id", expected_prefix=PrimitiveType.IDENTITY)
    async def list_blocks_for_identity_async(
        self,
        identity_id: str,
        before: Optional[str] = None,
        after: Optional[str] = None,
        limit: Optional[int] = 50,
        ascending: bool = False,
        actor: PydanticUser = None,
    ) -> List[Block]:
        """
        Get all blocks associated with the specified identity.
        """
        async with db_registry.async_session() as session:
            # First verify the identity exists and belongs to the user
            identity = await IdentityModel.read_async(db_session=session, identifier=identity_id, actor=actor)
            if identity is None:
                raise HTTPException(status_code=404, detail=f"Identity with id={identity_id} not found")

            # Get blocks associated with this identity with pagination
            blocks = await BlockModel.list_async(
                db_session=session,
                before=before,
                after=after,
                limit=limit,
                ascending=ascending,
                identity_id=identity.id,
            )
            return [block.to_pydantic() for block in blocks]

    @enforce_types
    @trace_method
    @raise_on_invalid_id(param_name="identity_id", expected_prefix=PrimitiveType.IDENTITY)
    @raise_on_invalid_id(param_name="agent_id", expected_prefix=PrimitiveType.AGENT)
    async def attach_agent_async(self, identity_id: str, agent_id: str, actor: PydanticUser) -> None:
        """
        Attach an agent to an identity.
        """
        async with db_registry.async_session() as session:
            identity = await IdentityModel.read_async(db_session=session, identifier=identity_id, actor=actor)

            agent = await AgentModel.read_async(db_session=session, identifier=agent_id, actor=actor)

            # Add agent to identity if not already attached
            if agent not in identity.agents:
                identity.agents.append(agent)
                await identity.update_async(db_session=session, actor=actor)

    @enforce_types
    @trace_method
    @raise_on_invalid_id(param_name="identity_id", expected_prefix=PrimitiveType.IDENTITY)
    @raise_on_invalid_id(param_name="agent_id", expected_prefix=PrimitiveType.AGENT)
    async def detach_agent_async(self, identity_id: str, agent_id: str, actor: PydanticUser) -> None:
        """
        Detach an agent from an identity.
        """
        async with db_registry.async_session() as session:
            identity = await IdentityModel.read_async(db_session=session, identifier=identity_id, actor=actor)

            agent = await AgentModel.read_async(db_session=session, identifier=agent_id, actor=actor)

            # Remove agent from identity if attached
            if agent in identity.agents:
                identity.agents.remove(agent)
                await identity.update_async(db_session=session, actor=actor)

    @enforce_types
    @trace_method
    @raise_on_invalid_id(param_name="identity_id", expected_prefix=PrimitiveType.IDENTITY)
    @raise_on_invalid_id(param_name="block_id", expected_prefix=PrimitiveType.BLOCK)
    async def attach_block_async(self, identity_id: str, block_id: str, actor: PydanticUser) -> None:
        """
        Attach a block to an identity.
        """
        async with db_registry.async_session() as session:
            identity = await IdentityModel.read_async(db_session=session, identifier=identity_id, actor=actor)

            block = await BlockModel.read_async(db_session=session, identifier=block_id, actor=actor)

            # Add block to identity if not already attached
            if block not in identity.blocks:
                identity.blocks.append(block)
                await identity.update_async(db_session=session, actor=actor)

    @enforce_types
    @trace_method
    @raise_on_invalid_id(param_name="identity_id", expected_prefix=PrimitiveType.IDENTITY)
    @raise_on_invalid_id(param_name="block_id", expected_prefix=PrimitiveType.BLOCK)
    async def detach_block_async(self, identity_id: str, block_id: str, actor: PydanticUser) -> None:
        """
        Detach a block from an identity.
        """
        async with db_registry.async_session() as session:
            identity = await IdentityModel.read_async(db_session=session, identifier=identity_id, actor=actor)

            block = await BlockModel.read_async(db_session=session, identifier=block_id, actor=actor)

            # Remove block from identity if attached
            if block in identity.blocks:
                identity.blocks.remove(block)
                await identity.update_async(db_session=session, actor=actor)
