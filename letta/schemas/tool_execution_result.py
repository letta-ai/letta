from typing import Any, List, Literal, Optional

from pydantic import BaseModel, Field

from letta.schemas.agent import AgentState


class ToolExecutionResult(BaseModel):
    status: Literal["success", "error"] = Field(..., description="The status of the tool execution and return object")
    func_return: Optional[Any] = Field(None, description="The function return object")
    agent_state: Optional[AgentState] = Field(None, description="The agent state")
    stdout: Optional[List[str]] = Field(None, description="Captured stdout (prints, logs) from function invocation")
    stderr: Optional[List[str]] = Field(None, description="Captured stderr from the function invocation")
    sandbox_config_fingerprint: Optional[str] = Field(None, description="The fingerprint of the config for the sandbox")

    @property
    def success_flag(self) -> bool:
        return self.status == "success"
