from typing import Optional

from fastapi import HTTPException
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
    def get_identity_from_identifier_key(self, identifier_key: str) -> PydanticIdentity:
        with self.session_maker() as session:
            identity = IdentityModel.read(db_session=session, identifier_key=identifier_key)
            return identity.to_pydantic()

    @enforce_types
    def create_identity(self, identity: IdentityCreate, actor: PydanticUser) -> PydanticIdentity:
        with self.session_maker() as session:
            agents = self._get_agents_from_ids(session=session, agent_ids=identity.agent_ids, actor=actor)

            identity = IdentityModel.create(
                db_session=session,
                name=identity.name,
                identifier_key=identity.identifier_key,
                identity_type=identity.identity_type,
                project_id=identity.project_id,
                organization_id=actor.organization_id,
                agents=agents,
            )
            return identity.to_pydantic()

    @enforce_types
    def upsert_identity(self, identity: IdentityCreate, actor: PydanticUser) -> PydanticIdentity:
        with self.session_maker() as session:
            existing_identity = IdentityModel.read(db_session=session, identifier_key=identifier_key)
            if existing_identity is None:
                identity = self.create_identity(identity=identity, actor=actor)
            else:
                if existing_identity.identifier_key != identity.identifier_key:
                    raise HTTPException(status_code=400, detail="Identifier key is an immutable field")
                if existing_identity.project_id != identity.project_id:
                    raise HTTPException(status_code=400, detail="Project id is an immutable field")
                if existing_identity.organization_id != identity.organization_id:
                    raise HTTPException(status_code=400, detail="Organization id is an immutable field")
                identity_update = IdentityUpdate(name=identity.name, identity_type=identity.identity_type, agent_ids=identity.agent_ids)
                identity = self.update_identity_by_key(identity.identifier_key, identity_update, actor)
                identity.commit(session)
            return identity.to_pydantic()

    @enforce_types
    def update_identity_by_key(self, identifier_key: str, identity: IdentityUpdate, actor: PydanticUser) -> PydanticIdentity:
        with self.session_maker() as session:
            try:
                existing_identity = IdentityModel.read(db_session=session, identifier_key=identifier_key)
            except NoResultFound:
                raise HTTPException(status_code=404, detail="Identity not found")
            if identity.organization_id != existing_identity.organization_id or identity.organization_id != actor.organization_id:
                raise HTTPException(status_code=403, detail="Forbidden")

            agents = None
            if identity.agent_ids:
                agents = self._get_agents_from_ids(session=session, agent_ids=identity.agent_ids, actor=actor)

            existing_identity.name = identity.name if identity.name is not None else existing_identity.name
            existing_identity.identity_type = (
                identity.identity_type if identity.identity_type is not None else existing_identity.identity_type
            )
            existing_identity.agents = agents if agents is not None else existing_identity.agents
            existing_identity.commit(session)
            return existing_identity.to_pydantic()

    @enforce_types
    def delete_identity_by_key(self, identifier_key: str, actor: PydanticUser) -> None:
        with self.session_maker() as session:
            identity = IdentityModel.read(db_session=session, identifier_key=identifier_key)
            if identity is None:
                raise HTTPException(status_code=404, detail="Identity not found")
            if identity.organization_id != actor.organization_id:
                raise HTTPException(status_code=403, detail="Forbidden")
            session.delete(identity)

    def _get_agents_from_ids(self, session: Session, agent_ids: list[str], actor: PydanticUser) -> list[AgentModel]:
        """Helper method to get agents from their IDs and verify permissions.

        Args:
            session: The database session
            agent_ids: List of agent IDs to fetch
            actor: The user making the request

        Returns:
            List of agent models

        Raises:
            HTTPException: If agents not found or user doesn't have permission
        """
        agents = AgentModel.list(db_session=session, ids=agent_ids)
        if len(agents) != len(agent_ids):
            found_ids = {agent.id for agent in agents}
            missing_ids = [id for id in agent_ids if id not in found_ids]
            raise HTTPException(status_code=404, detail=f"Agents not found: {', '.join(missing_ids)}")

        if any(agent.organization_id != actor.organization_id for agent in agents):
            raise HTTPException(status_code=403, detail="Forbidden")

        return agents
