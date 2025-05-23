from typing import Any, Dict, Optional, Union

from pydantic import Field

from letta.functions.mcp_client.types import MCPServerType, SSEServerConfig, StdioServerConfig
from letta.schemas.letta_base import LettaBase


class BaseMCPServer(LettaBase):
    __id_prefix__ = "mcp_server"


class MCPServer(BaseMCPServer):
    id: str = BaseMCPServer.generate_id_field()
    server_type: MCPServerType = MCPServerType.SSE
    server_name: str = Field(..., description="The name of the server")

    # sse config
    server_url: Optional[str] = Field(None, description="The URL of the server (MCP SSE client will connect to this URL)")

    # stdio config
    stdio_config: Optional[StdioServerConfig] = Field(
        None, description="The configuration for the server (MCP 'local' client will run this command)"
    )

    organization_id: Optional[str] = Field(None, description="The unique identifier of the organization associated with the tool.")

    # metadata fields
    created_by_id: Optional[str] = Field(None, description="The id of the user that made this Tool.")
    last_updated_by_id: Optional[str] = Field(None, description="The id of the user that made this Tool.")
    metadata_: Optional[Dict[str, Any]] = Field(default_factory=dict, description="A dictionary of additional metadata for the tool.")

    # TODO: add tokens?

    def to_config(self) -> Union[SSEServerConfig, StdioServerConfig]:
        if self.server_type == MCPServerType.SSE:
            return SSEServerConfig(
                server_name=self.server_name,
                server_url=self.server_url,
            )
        elif self.server_type == MCPServerType.STDIO:
            return self.stdio_config


class RegisterSSEMCPServer(LettaBase):
    server_name: str = Field(..., description="The name of the server")
    server_type: MCPServerType = MCPServerType.SSE
    server_url: str = Field(..., description="The URL of the server (MCP SSE client will connect to this URL)")


class RegisterStdioMCPServer(LettaBase):
    server_name: str = Field(..., description="The name of the server")
    server_type: MCPServerType = MCPServerType.STDIO
    stdio_config: StdioServerConfig = Field(..., description="The configuration for the server (MCP 'local' client will run this command)")


class UpdateSSEMCPServer(LettaBase):
    """Update an SSE MCP server"""

    server_name: Optional[str] = Field(None, description="The name of the server")
    server_url: Optional[str] = Field(None, description="The URL of the server (MCP SSE client will connect to this URL)")


class UpdateStdioMCPServer(LettaBase):
    """Update a Stdio MCP server"""

    server_name: Optional[str] = Field(None, description="The name of the server")
    stdio_config: Optional[StdioServerConfig] = Field(
        None, description="The configuration for the server (MCP 'local' client will run this command)"
    )


UpdateMCPServer = Union[UpdateSSEMCPServer, UpdateStdioMCPServer]
RegisterMCPServer = Union[RegisterSSEMCPServer, RegisterStdioMCPServer]
