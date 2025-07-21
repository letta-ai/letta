from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import NoResultFound

from letta.orm.agent import Agent as AgentModel
from letta.orm.block import Block as BlockModel
from letta.orm.errors import UniqueConstraintViolationError
from letta.orm.identity import Identity as IdentityModel
from letta.otel.tracing import trace_method
from letta.schemas.identity import Identity as PydanticIdentity
from letta.schemas.identity import IdentityCreate, IdentityProperty, IdentityType, IdentityUpdate, IdentityUpsert
from letta.schemas.user import User as PydanticUser
from letta.server.db import db_registry
from letta.settings import DatabaseChoice, settings
from letta.utils import enforce_types


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
        actor: PydanticUser = None,
    ) -> list[PydanticIdentity]:
        async with db_registry.async_session() as session:
            filters = {"organization_id": actor.organization_id}
            if project_id:
                filters["project_id"] = project_id
            if identifier_key:
                filters["identifier_key"] = identifier_key
            if identity_type:
                filters["identity_type"] = identity_type
            identities = await IdentityModel.list_async(
                db_session=session,
                query_text=name,
                before=before,
                after=after,
                limit=limit,
                **filters,
            )
            return [identity.to_pydantic() for identity in identities]

    @enforce_types
    @trace_method
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
