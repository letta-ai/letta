class MCPTimeoutError(RuntimeError):
    """Custom exception raised when an MCP operation times out."""

    def __init__(self, operation: str, server_name: str, timeout: float):
        message = f"Timed out while {operation} for MCP server {server_name} (timeout={timeout}s)."
        super().__init__(message)
