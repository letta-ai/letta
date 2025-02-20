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
    id: str = IdentityBase.generate_id_field()
    identifier_key: str = Field(..., description="External, user-generated identifier key of the identity.")
    name: str = Field(..., description="The name of the identity.")
    identity_type: IdentityType = Field(..., description="The type of the identity.")
    project_id: Optional[str] = Field(None, description="The project id of the identity, if applicable.")
    agents: List[AgentState] = Field(..., description="The agents associated with the identity.")


class IdentityCreate(LettaBase):
    identifier_key: str = Field(..., description="External, user-generated identifier key of the identity.")
    name: str = Field(..., description="The name of the identity.")
    identity_type: IdentityType = Field(..., description="The type of the identity.")
    project_id: Optional[str] = Field(None, description="The project id of the identity, if applicable.")
    agent_ids: Optional[List[str]] = Field(None, description="The agent ids that are associated with the identity.")


class IdentityUpdate(LettaBase):
    name: Optional[str] = Field(None, description="The name of the identity.")
    identity_type: Optional[IdentityType] = Field(None, description="The type of the identity.")
    agent_ids: Optional[List[str]] = Field(None, description="The agent ids that are associated with the identity.")
