from typing import Optional

from pydantic import Field, model_validator

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

    # TODO: remove this in favor of value_enc, this is a bad pattern but need to support for now given our agent state dependency
    # Note: DB writes are protected by managers which explicitly write value="" to DB.
    # This validator syncs `value` and `value_enc` for backward compatibility:
    # - If `value_enc` is set but `value` is empty -> populate `value` from decrypted `value_enc`
    # - If `value` is set but `value_enc` is empty -> populate `value_enc` from encrypted `value`
    @model_validator(mode="after")
    def sync_value_and_value_enc(self):
        """Sync deprecated `value` field with `value_enc` for backward compatibility."""
        if self.value_enc and not self.value:
            # Decrypt value_enc -> value (for API responses)
            plaintext = self.value_enc.get_plaintext()
            if plaintext:
                self.value = plaintext
        elif self.value and not self.value_enc:
            # Encrypt value -> value_enc (for backward compat when value is provided directly)
            self.value_enc = Secret.from_plaintext(self.value)
        return self


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


class AgentEnvironmentVariableCreate(EnvironmentVariableCreateBase):
    pass


class AgentEnvironmentVariableUpdate(EnvironmentVariableUpdateBase):
    pass
