from typing import Optional

from pydantic import Field

from letta.schemas.letta_base import LettaBase, OrmMetadataBase


# Base Environment Variable
class EnvironmentVariableBase(OrmMetadataBase):
    id: str = Field(..., description="The unique identifier for the environment variable.")
    key: str = Field(..., description="The name of the environment variable.")
    value: str = Field(..., description="The value of the environment variable.")
    description: Optional[str] = Field(None, description="An optional description of the environment variable.")
    organization_id: Optional[str] = Field(None, description="The ID of the organization this environment variable belongs to.")


class EnvironmentVariableCreateBase(LettaBase):
    key: str = Field(..., description="The name of the environment variable.")
    value: str = Field(..., description="The value of the environment variable.")
    description: Optional[str] = Field(None, description="An optional description of the environment variable.")


class EnvironmentVariableUpdateBase(LettaBase):
    key: Optional[str] = Field(None, description="The name of the environment variable.")
    value: Optional[str] = Field(None, description="The value of the environment variable.")
    description: Optional[str] = Field(None, description="An optional description of the environment variable.")


# Environment Variable
class SandboxEnvironmentVariableBase(EnvironmentVariableBase):
    __id_prefix__ = "sandbox-env"
    sandbox_config_id: str = Field(..., description="The ID of the sandbox config this environment variable belongs to.")


class SandboxEnvironmentVariable(SandboxEnvironmentVariableBase):
    id: str = SandboxEnvironmentVariableBase.generate_id_field()


class SandboxEnvironmentVariableCreate(EnvironmentVariableCreateBase):
    pass


class SandboxEnvironmentVariableUpdate(EnvironmentVariableUpdateBase):
    pass


# Agent-Specific Environment Variable
class AgentEnvironmentVariableBase(EnvironmentVariableBase):
    __id_prefix__ = "agent-env"
    agent_id: str = Field(..., description="The ID of the agent this environment variable belongs to.")


class AgentEnvironmentVariable(AgentEnvironmentVariableBase):
    id: str = AgentEnvironmentVariableBase.generate_id_field()


class AgentEnvironmentVariableCreate(EnvironmentVariableCreateBase):
    pass


class AgentEnvironmentVariableUpdate(EnvironmentVariableUpdateBase):
    pass
