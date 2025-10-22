from typing import TYPE_CHECKING, Optional

from sqlalchemy import JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from letta.functions.mcp_client.types import StdioServerConfig
from letta.orm.custom_columns import MCPStdioServerConfigColumn

# TODO everything in functions should live in this model
from letta.orm.mixins import OrganizationMixin
from letta.orm.sqlalchemy_base import SqlalchemyBase
from letta.schemas.enums import MCPServerType
from letta.schemas.mcp import MCPServer

if TYPE_CHECKING:
    pass


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


class MCPTools(SqlalchemyBase, OrganizationMixin):
    """Represents a mapping of MCP server ID to tool ID"""

    __tablename__ = "mcp_tools"

    mcp_server_id: Mapped[str] = mapped_column(String, doc="The ID of the MCP server")
    tool_id: Mapped[str] = mapped_column(String, doc="The ID of the tool")
