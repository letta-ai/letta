import json
from typing import TYPE_CHECKING, Optional

from sqlalchemy import JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from letta.functions.mcp_client.types import StdioServerConfig
from letta.orm.custom_columns import MCPStdioServerConfigColumn

# TODO everything in functions should live in this model
from letta.orm.mixins import OrganizationMixin
from letta.orm.sqlalchemy_base import SqlalchemyBase
from letta.schemas.enums import MCPServerType
from letta.schemas.mcp import MCPServer
from letta.schemas.secret import Secret

if TYPE_CHECKING:
    from letta.orm.organization import Organization


class MCPServer(SqlalchemyBase, OrganizationMixin):
    """Represents a registered MCP server"""

    __tablename__ = "mcp_server"
    __pydantic_model__ = MCPServer

    # Add unique constraint on (name, _organization_id)
    # An organization should not have multiple tools with the same name
    __table_args__ = (UniqueConstraint("server_name", "organization_id", name="uix_name_organization_mcp_server"),)

    server_name: Mapped[str] = mapped_column(doc="The display name of the MCP server")
    server_type: Mapped[MCPServerType] = mapped_column(
        String, default=MCPServerType.SSE, doc="The type of the MCP server. Only SSE is supported for remote servers."
    )

    # sse server
    server_url: Mapped[Optional[str]] = mapped_column(
        String, nullable=True, doc="The URL of the server (MCP SSE client will connect to this URL)"
    )

    # access token / api key for MCP servers that require authentication
    token: Mapped[Optional[str]] = mapped_column(String, nullable=True, doc="The access token or api key for the MCP server")

    # encrypted access token or api key for the MCP server
    token_enc: Mapped[Optional[str]] = mapped_column(Text, nullable=True, doc="Encrypted access token or api key for the MCP server")

    # custom headers for authentication (key-value pairs)
    custom_headers: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, doc="Custom authentication headers as key-value pairs")

    # encrypted custom headers for authentication (key-value pairs)
    custom_headers_enc: Mapped[Optional[str]] = mapped_column(Text, nullable=True, doc="Encrypted custom authentication headers")

    # stdio server
    stdio_config: Mapped[Optional[StdioServerConfig]] = mapped_column(
        MCPStdioServerConfigColumn, nullable=True, doc="The configuration for the stdio server"
    )

    metadata_: Mapped[Optional[dict]] = mapped_column(
        JSON, default=lambda: {}, doc="A dictionary of additional metadata for the MCP server."
    )

    # relationships
    organization: Mapped["Organization"] = relationship("Organization", back_populates="mcp_servers")

    def to_pydantic(self):
        """Convert ORM model to Pydantic model, handling encrypted fields."""
        # Parse custom_headers from JSON if stored as string
        return self.__pydantic_model__(
            id=self.id,
            server_type=self.server_type,
            server_name=self.server_name,
            server_url=self.server_url,
            token_enc=Secret.from_encrypted(self.token_enc) if self.token_enc else None,
            custom_headers_enc=Secret.from_encrypted(self.custom_headers_enc) if self.custom_headers_enc else None,
            stdio_config=self.stdio_config,
            organization_id=self.organization_id,
            created_by_id=self.created_by_id,
            last_updated_by_id=self.last_updated_by_id,
            metadata_=self.metadata_,
        )


class MCPTools(SqlalchemyBase, OrganizationMixin):
    """Represents a mapping of MCP server ID to tool ID"""

    __tablename__ = "mcp_tools"

    mcp_server_id: Mapped[str] = mapped_column(String, doc="The ID of the MCP server")
    tool_id: Mapped[str] = mapped_column(String, doc="The ID of the tool")
