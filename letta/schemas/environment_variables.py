from typing import Optional

from pydantic import Field

from letta.schemas.enums import PrimitiveType
from letta.schemas.letta_base import LettaBase, OrmMetadataBase
from letta.schemas.secret import Secret


# Base Environment Variable
class EnvironmentVariableBase(OrmMetadataBase):
    id: str = Field(..., description="The unique identifier for the environment variable.")
    key: str = Field(..., description="The name of the environment variable.")
    value: str = Field(..., description="The value of the environment variable.", repr=False)
    description: Optional[str] = Field(None, description="An optional description of the environment variable.")
    organization_id: Optional[str] = Field(None, description="The ID of the organization this environment variable belongs to.")

    # Encrypted field (stored as Secret object, serialized to string for DB)
    # Secret class handles validation and serialization automatically via __get_pydantic_core_schema__
    value_enc: Secret | None = Field(None, description="Encrypted value as Secret object")


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
    __id_prefix__ = PrimitiveType.SANDBOX_ENV.value
    sandbox_config_id: str = Field(..., description="The ID of the sandbox config this environment variable belongs to.")


class SandboxEnvironmentVariable(SandboxEnvironmentVariableBase):
    id: str = SandboxEnvironmentVariableBase.generate_id_field()

    @classmethod
    async def from_orm_async(cls, orm_obj) -> "SandboxEnvironmentVariable":
        """
        Create Pydantic model from ORM with async decryption.

        This pre-decrypts value_enc asynchronously before model creation,
        avoiding the synchronous decryption in the model validator.
        """
        data = {
            "id": orm_obj.id,
            "key": orm_obj.key,
            "description": orm_obj.description,
            "organization_id": orm_obj.organization_id,
            "sandbox_config_id": orm_obj.sandbox_config_id,
            "value": "",
            "value_enc": None,
        }

        if orm_obj.value_enc:
            secret = Secret.from_encrypted(orm_obj.value_enc)
            data["value"] = await secret.get_plaintext_async() or ""
            data["value_enc"] = secret
        elif orm_obj.value:
            data["value"] = orm_obj.value

        return cls.model_validate(data)


class SandboxEnvironmentVariableCreate(EnvironmentVariableCreateBase):
    pass


class SandboxEnvironmentVariableUpdate(EnvironmentVariableUpdateBase):
    pass


# Agent-Specific Environment Variable
class AgentEnvironmentVariableBase(EnvironmentVariableBase):
    __id_prefix__ = PrimitiveType.AGENT_ENV.value
    agent_id: str = Field(..., description="The ID of the agent this environment variable belongs to.")


class AgentEnvironmentVariable(AgentEnvironmentVariableBase):
    id: str = AgentEnvironmentVariableBase.generate_id_field()

    @classmethod
    async def from_orm_async(cls, orm_obj) -> "AgentEnvironmentVariable":
        """
        Create Pydantic model from ORM with async decryption.

        This pre-decrypts value_enc asynchronously before model creation,
        avoiding the synchronous decryption in the model validator.
        """
        data = {
            "id": orm_obj.id,
            "key": orm_obj.key,
            "description": orm_obj.description,
            "organization_id": orm_obj.organization_id,
            "agent_id": orm_obj.agent_id,
            "value": "",
            "value_enc": None,
        }

        if orm_obj.value_enc:
            secret = Secret.from_encrypted(orm_obj.value_enc)
            data["value"] = await secret.get_plaintext_async() or ""
            data["value_enc"] = secret
        elif orm_obj.value:
            data["value"] = orm_obj.value

        return cls.model_validate(data)


class AgentEnvironmentVariableCreate(EnvironmentVariableCreateBase):
    pass


class AgentEnvironmentVariableUpdate(EnvironmentVariableUpdateBase):
    pass
