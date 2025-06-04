import uuid
from typing import TYPE_CHECKING, Dict, List, Optional

from sqlalchemy import JSON
from sqlalchemy import Enum as SqlEnum
from sqlalchemy import Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from letta.orm.mixins import AgentMixin, OrganizationMixin, SandboxConfigMixin
from letta.orm.sqlalchemy_base import SqlalchemyBase
from letta.schemas.environment_variables import SandboxEnvironmentVariable as PydanticSandboxEnvironmentVariable
from letta.schemas.sandbox_config import SandboxConfig as PydanticSandboxConfig
from letta.schemas.sandbox_config import SandboxType

if TYPE_CHECKING:
    from letta.orm.agent import Agent
    from letta.orm.organization import Organization


class SandboxConfig(SqlalchemyBase, OrganizationMixin):
    """ORM model for sandbox configurations with JSON storage for arbitrary config data."""

    __tablename__ = "sandbox_configs"
    __pydantic_model__ = PydanticSandboxConfig

    # For now, we only allow one type of sandbox config per organization
    __table_args__ = (UniqueConstraint("type", "organization_id", name="uix_type_organization"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, nullable=False)
    type: Mapped[SandboxType] = mapped_column(SqlEnum(SandboxType), nullable=False, doc="The type of sandbox.")
    config: Mapped[Dict] = mapped_column(JSON, nullable=False, doc="The JSON configuration data.")

    # relationships
    organization: Mapped["Organization"] = relationship("Organization", back_populates="sandbox_configs")
    sandbox_environment_variables: Mapped[List["SandboxEnvironmentVariable"]] = relationship(
        "SandboxEnvironmentVariable", back_populates="sandbox_config", cascade="all, delete-orphan"
    )


class SandboxEnvironmentVariable(SqlalchemyBase, OrganizationMixin, SandboxConfigMixin):
    """ORM model for environment variables associated with sandboxes."""

    __tablename__ = "sandbox_environment_variables"
    __pydantic_model__ = PydanticSandboxEnvironmentVariable

    # We cannot have duplicate key names in the same sandbox, the env var would get overwritten
    __table_args__ = (UniqueConstraint("key", "sandbox_config_id", name="uix_key_sandbox_config"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, nullable=False)
    key: Mapped[str] = mapped_column(String, nullable=False, doc="The name of the environment variable.")
    value: Mapped[str] = mapped_column(String, nullable=False, doc="The value of the environment variable.")
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True, doc="An optional description of the environment variable.")

    # relationships
    organization: Mapped["Organization"] = relationship("Organization", back_populates="sandbox_environment_variables")
    sandbox_config: Mapped["SandboxConfig"] = relationship("SandboxConfig", back_populates="sandbox_environment_variables")


class AgentEnvironmentVariable(SqlalchemyBase, OrganizationMixin, AgentMixin):
    """ORM model for environment variables associated with agents."""

    __tablename__ = "agent_environment_variables"
    # We cannot have duplicate key names for the same agent, the env var would get overwritten
    __table_args__ = (
        UniqueConstraint("key", "agent_id", name="uix_key_agent"),
        Index("idx_agent_environment_variables_agent_id", "agent_id"),
    )

    # agent_env_var generates its own id
    # TODO: We want to migrate all the ORM models to do this, so we will need to move this to the SqlalchemyBase
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"agent-env-{uuid.uuid4()}")
    key: Mapped[str] = mapped_column(String, nullable=False, doc="The name of the environment variable.")
    value: Mapped[str] = mapped_column(String, nullable=False, doc="The value of the environment variable.")
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True, doc="An optional description of the environment variable.")

    organization: Mapped["Organization"] = relationship("Organization", back_populates="agent_environment_variables")
    agent: Mapped[List["Agent"]] = relationship("Agent", back_populates="tool_exec_environment_variables")
