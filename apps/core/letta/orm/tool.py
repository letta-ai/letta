from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import JSON, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

# TODO everything in functions should live in this model
from letta.orm.enums import ToolSourceType, ToolType
from letta.orm.mixins import OrganizationMixin
from letta.orm.sqlalchemy_base import SqlalchemyBase
from letta.schemas.tool import Tool as PydanticTool

if TYPE_CHECKING:
    from letta.orm.organization import Organization


class Tool(SqlalchemyBase, OrganizationMixin):
    """Represents an available tool that the LLM can invoke.

    NOTE: polymorphic inheritance makes more sense here as a TODO. We want a superset of tools
    that are always available, and a subset scoped to the organization. Alternatively, we could use the apply_access_predicate to build
    more granular permissions.
    """

    __tablename__ = "tools"
    __pydantic_model__ = PydanticTool

    # Add unique constraint on (name, _organization_id)
    # An organization should not have multiple tools with the same name
    __table_args__ = (
        UniqueConstraint("name", "organization_id", name="uix_name_organization"),
        Index("ix_tools_created_at_name", "created_at", "name"),
    )

    name: Mapped[str] = mapped_column(doc="The display name of the tool.")
    tool_type: Mapped[ToolType] = mapped_column(
        String,
        default=ToolType.CUSTOM,
        doc="The type of tool. This affects whether or not we generate json_schema and source_code on the fly.",
    )
    return_char_limit: Mapped[int] = mapped_column(nullable=True, doc="The maximum number of characters the tool can return.")
    description: Mapped[Optional[str]] = mapped_column(nullable=True, doc="The description of the tool.")
    tags: Mapped[List] = mapped_column(JSON, doc="Metadata tags used to filter tools.")
    source_type: Mapped[ToolSourceType] = mapped_column(String, doc="The type of the source code.", default=ToolSourceType.json)
    source_code: Mapped[Optional[str]] = mapped_column(String, doc="The source code of the function.")
    json_schema: Mapped[Optional[dict]] = mapped_column(JSON, default=lambda: {}, doc="The OAI compatable JSON schema of the function.")
    args_json_schema: Mapped[Optional[dict]] = mapped_column(JSON, default=lambda: {}, doc="The JSON schema of the function arguments.")
    pip_requirements: Mapped[Optional[List]] = mapped_column(
        JSON, nullable=True, doc="Optional list of pip packages required by this tool."
    )
    metadata_: Mapped[Optional[dict]] = mapped_column(JSON, default=lambda: {}, doc="A dictionary of additional metadata for the tool.")
    # relationships
    organization: Mapped["Organization"] = relationship("Organization", back_populates="tools", lazy="selectin")
