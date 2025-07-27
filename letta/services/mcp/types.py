from enum import Enum
from typing import List, Optional

from mcp import Tool
from pydantic import BaseModel, Field


class MCPTool(Tool):
    """A simple wrapper around MCP's tool definition (to avoid conflict with our own)"""


class MCPServerType(str, Enum):
    SSE = "sse"
    STDIO = "stdio"


class BaseServerConfig(BaseModel):
    server_name: str = Field(..., description="The name of the server")
    type: MCPServerType


class SSEServerConfig(BaseServerConfig):
    type: MCPServerType = MCPServerType.SSE
    server_url: str = Field(..., description="The URL of the server (MCP SSE client will connect to this URL)")

    def to_dict(self) -> dict:
        values = {
            "transport": "sse",
            "url": self.server_url,
        }
        return values


class StdioServerConfig(BaseServerConfig):
    type: MCPServerType = MCPServerType.STDIO
    command: str = Field(..., description="The command to run (MCP 'local' client will run this command)")
    args: List[str] = Field(..., description="The arguments to pass to the command")
    env: Optional[dict[str, str]] = Field(None, description="Environment variables to set")

    def to_dict(self) -> dict:
        values = {
            "transport": "stdio",
            "command": self.command,
            "args": self.args,
        }
        if self.env is not None:
            values["env"] = self.env
        return values
