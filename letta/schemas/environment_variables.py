from typing import Optional

from pydantic import Field, model_validator

from letta.schemas.enums import PrimitiveType
from letta.schemas.letta_base import LettaBase, OrmMetadataBase
from letta.schemas.secret import Secret
from letta.settings import settings


# Base Environment Variable
class EnvironmentVariableBase(OrmMetadataBase):
    id: str = Field(..., description="The unique identifier for the environment variable.")
    key: str = Field(..., description="The name of the environment variable.")
    value: str = Field(..., description="The value of the environment variable.")
    description: Optional[str] = Field(None, description="An optional description of the environment variable.")
    organization_id: Optional[str] = Field(None, description="The ID of the organization this environment variable belongs to.")

    # Encrypted field (stored as Secret object, serialized to string for DB)
    # Secret class handles validation and serialization automatically via __get_pydantic_core_schema__
    value_enc: Secret | None = Field(None, description="Encrypted value as Secret object")

    # TODO: deprecate value and use value_enc
    @model_validator(mode="after")
    def populate_value_from_encrypted(self) -> "EnvironmentVariableBase":
        """Populate value field from value_enc if value is empty but value_enc exists.

        This ensures API responses include the decrypted value in the `value` field
        for backwards compatibility with clients that read from `value`.
        """
        if (not self.value or self.value == "") and self.value_enc is not None:
            self.value = self.value_enc.get_plaintext() or ""
        return self

    def get_value_secret(self) -> Secret:
        """Get the value as a Secret object. Prefers encrypted, falls back to plaintext with error logging."""
        # If value_enc is already a Secret, return it
        if self.value_enc is not None:
            return self.value_enc
        # Fallback to plaintext with error logging via Secret.from_db()
        return Secret.from_db(encrypted_value=None, plaintext_value=self.value)

    def set_value_secret(self, secret: Secret) -> None:
        """Set value from a Secret object, directly storing the Secret."""
        self.value_enc = secret
        # Also update plaintext field for dual-write during migration
        secret_dict = secret.to_dict()
        if not secret.was_encrypted:
            self.value = secret_dict["plaintext"]
        else:
            self.value = None


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
