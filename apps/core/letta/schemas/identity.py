from enum import Enum
from typing import List, Optional

from pydantic import Field

from letta.schemas.agent import AgentState
from letta.schemas.letta_base import LettaBase


class IdentityType(str, Enum):
    """
    Enum to represent the type of the identity.
    """

    org = "org"
    user = "user"
    other = "other"


class IdentityBase(LettaBase):
    __id_prefix__ = "identity"


class Identity(IdentityBase):
    id: str = Field(..., description="The internal id of the identity.")
    identifier_key: str = Field(..., description="External, user-generated identifier key of the identity.")
    name: str = Field(..., description="The name of the identity.")
    identity_type: IdentityType = Field(..., description="The type of the identity.")
    project_id: Optional[str] = Field(None, description="The project id of the identity, if applicable.")
    agents: List[AgentState] = Field(..., description="The ids of the agents associated with the identity.")
