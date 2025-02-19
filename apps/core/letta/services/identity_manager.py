from typing import Optional

from letta.orm.identity import Identity as IdentityModel
from letta.schemas.identity import Identity as PydanticIdentity
from letta.schemas.identity import IdentityType
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
