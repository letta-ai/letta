from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy.exc import NoResultFound
from sqlalchemy.orm import Session

from letta.orm.agent import Agent as AgentModel
from letta.orm.identity import Identity as IdentityModel
from letta.schemas.identity import Identity as PydanticIdentity
from letta.schemas.identity import IdentityCreate, IdentityType, IdentityUpdate
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
            new_identity = IdentityModel(**identity.model_dump(exclude={"agent_ids"}, exclude_unset=True))
            new_identity.organization_id = actor.organization_id
            self._process_agent_relationship(session=session, identity=new_identity, agent_ids=identity.agent_ids, allow_partial=False)
            new_identity.create(session, actor=actor)
            return new_identity.to_pydantic()

    @enforce_types
    def upsert_identity(self, identity: IdentityCreate, actor: PydanticUser) -> PydanticIdentity:
        with self.session_maker() as session:
            existing_identity = IdentityModel.read(
                db_session=session,
                identifier_key=identity.identifier_key,
                project_id=identity.project_id,
                organization_id=actor.organization_id,
                actor=actor,
            )

        if existing_identity is None:
            return self.create_identity(identity=identity, actor=actor)
        else:
            identity_update = IdentityUpdate(name=identity.name, identity_type=identity.identity_type, agent_ids=identity.agent_ids)
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
                new_properties = existing_identity.properties + [prop.model_dump() for prop in identity.properties]
                existing_identity.properties = new_properties

        self._process_agent_relationship(
            session=session, identity=existing_identity, agent_ids=identity.agent_ids, allow_partial=False, replace=replace
        )
        existing_identity.update(session, actor=actor)
        return existing_identity.to_pydantic()

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

    def _process_agent_relationship(
        self, session: Session, identity: IdentityModel, agent_ids: List[str], allow_partial=False, replace=True
    ):
        current_relationship = getattr(identity, "agents", [])
        if not agent_ids:
            if replace:
                setattr(identity, "agents", [])
            return

        # Retrieve models for the provided IDs
        found_items = session.query(AgentModel).filter(AgentModel.id.in_(agent_ids)).all()

        # Validate all items are found if allow_partial is False
        if not allow_partial and len(found_items) != len(agent_ids):
            missing = set(agent_ids) - {item.id for item in found_items}
            raise NoResultFound(f"Items not found in agents: {missing}")

        if replace:
            # Replace the relationship
            setattr(identity, "agents", found_items)
        else:
            # Extend the relationship (only add new items)
            current_ids = {item.id for item in current_relationship}
            new_items = [item for item in found_items if item.id not in current_ids]
            current_relationship.extend(new_items)
