from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy.exc import NoResultFound
from sqlalchemy.orm import Session

from letta.orm.agent import Agent as AgentModel
from letta.orm.block import Block as BlockModel
from letta.orm.identity import Identity as IdentityModel
from letta.schemas.identity import Identity as PydanticIdentity
from letta.schemas.identity import IdentityCreate, IdentityProperty, IdentityType, IdentityUpdate, IdentityUpsert
from letta.schemas.user import User as PydanticUser
from letta.utils import enforce_types


class IdentityManager:

    def __init__(self):
        from letta.server.db import db_context

        self.session_maker = db_context

    @enforce_types
    def list_identities(
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
        with self.session_maker() as session:
            filters = {"organization_id": actor.organization_id}
            if project_id:
                filters["project_id"] = project_id
            if identifier_key:
                filters["identifier_key"] = identifier_key
            if identity_type:
                filters["identity_type"] = identity_type
            identities = IdentityModel.list(
                db_session=session,
                query_text=name,
                before=before,
                after=after,
                limit=limit,
                **filters,
            )
            return [identity.to_pydantic() for identity in identities]

    @enforce_types
    def get_identity(self, identity_id: str, actor: PydanticUser) -> PydanticIdentity:
        with self.session_maker() as session:
            identity = IdentityModel.read(db_session=session, identifier=identity_id, actor=actor)
            return identity.to_pydantic()

    @enforce_types
    def create_identity(self, identity: IdentityCreate, actor: PydanticUser) -> PydanticIdentity:
        with self.session_maker() as session:
            new_identity = IdentityModel(**identity.model_dump(exclude={"agent_ids", "block_ids"}, exclude_unset=True))
            new_identity.organization_id = actor.organization_id
            self._process_relationship(
                session=session,
                identity=new_identity,
                relationship_name="agents",
                model_class=AgentModel,
                item_ids=identity.agent_ids,
                allow_partial=False,
            )
            self._process_relationship(
                session=session,
                identity=new_identity,
                relationship_name="blocks",
                model_class=BlockModel,
                item_ids=identity.block_ids,
                allow_partial=False,
            )
            new_identity.create(session, actor=actor)
            return new_identity.to_pydantic()

    @enforce_types
    def upsert_identity(self, identity: IdentityUpsert, actor: PydanticUser) -> PydanticIdentity:
        with self.session_maker() as session:
            existing_identity = IdentityModel.read(
                db_session=session,
                identifier_key=identity.identifier_key,
                project_id=identity.project_id,
                organization_id=actor.organization_id,
                actor=actor,
            )

        if existing_identity is None:
            return self.create_identity(identity=IdentityCreate(**identity.model_dump()), actor=actor)
        else:
            identity_update = IdentityUpdate(
                name=identity.name,
                identifier_key=identity.identifier_key,
                identity_type=identity.identity_type,
                agent_ids=identity.agent_ids,
                properties=identity.properties,
            )
            return self._update_identity(
                session=session, existing_identity=existing_identity, identity=identity_update, actor=actor, replace=True
            )

    @enforce_types
    def update_identity(self, identity_id: str, identity: IdentityUpdate, actor: PydanticUser, replace: bool = False) -> PydanticIdentity:
        with self.session_maker() as session:
            try:
                existing_identity = IdentityModel.read(db_session=session, identifier=identity_id, actor=actor)
            except NoResultFound:
                raise HTTPException(status_code=404, detail="Identity not found")
            if existing_identity.organization_id != actor.organization_id:
                raise HTTPException(status_code=403, detail="Forbidden")

            return self._update_identity(
                session=session, existing_identity=existing_identity, identity=identity, actor=actor, replace=replace
            )

    def _update_identity(
        self,
        session: Session,
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
            self._process_relationship(
                session=session,
                identity=existing_identity,
                relationship_name="agents",
                model_class=AgentModel,
                item_ids=identity.agent_ids,
                allow_partial=False,
                replace=replace,
            )
        if identity.block_ids is not None:
            self._process_relationship(
                session=session,
                identity=existing_identity,
                relationship_name="blocks",
                model_class=BlockModel,
                item_ids=identity.block_ids,
                allow_partial=False,
                replace=replace,
            )
        existing_identity.update(session, actor=actor)
        return existing_identity.to_pydantic()

    @enforce_types
    def upsert_identity_properties(self, identity_id: str, properties: List[IdentityProperty], actor: PydanticUser) -> PydanticIdentity:
        with self.session_maker() as session:
            existing_identity = IdentityModel.read(db_session=session, identifier=identity_id, actor=actor)
            if existing_identity is None:
                raise HTTPException(status_code=404, detail="Identity not found")
            return self._update_identity(
                session=session,
                existing_identity=existing_identity,
                identity=IdentityUpdate(properties=properties),
                actor=actor,
                replace=True,
            )

    @enforce_types
    def delete_identity(self, identity_id: str, actor: PydanticUser) -> None:
        with self.session_maker() as session:
            identity = IdentityModel.read(db_session=session, identifier=identity_id)
            if identity is None:
                raise HTTPException(status_code=404, detail="Identity not found")
            if identity.organization_id != actor.organization_id:
                raise HTTPException(status_code=403, detail="Forbidden")
            session.delete(identity)
            session.commit()

    def _process_relationship(
        self,
        session: Session,
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
        found_items = session.query(model_class).filter(model_class.id.in_(item_ids)).all()

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
