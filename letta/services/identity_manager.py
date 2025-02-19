from letta.orm.identity import Identity as IdentityModel
from letta.schemas.identity import Identity as PydanticIdentity
from letta.utils import enforce_types


class IdentityManager:

    def __init__(self):
        from letta.server.db import db_context

        self.session_maker = db_context

    @enforce_types
    def get_identity_from_identifier_key(self, identifier_key: str) -> PydanticIdentity:
        with self.session_maker() as session:
            identity = IdentityModel.read(db_session=session, identifier_key=identifier_key)
            return identity.to_pydantic()
