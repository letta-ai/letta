import json
from typing import Annotated, Any, Dict, List, Literal, Optional, Set, Union

from pydantic import Field

from letta.schemas.enums import ToolRuleType
from letta.schemas.letta_base import LettaBase


class BaseToolRule(LettaBase):
    __id_prefix__ = "tool_rule"
    tool_name: str = Field(..., description="The name of the tool. Must exist in the database for the user's organization.")
    type: ToolRuleType = Field(..., description="The type of the message.")

    def get_valid_tools(self, tool_call_history: List[str], available_tools: Set[str], last_function_response: Optional[str]) -> set[str]:
        raise NotImplementedError


class ChildToolRule(BaseToolRule):
    """
    A ToolRule represents a tool that can be invoked by the agent.
    """

    type: Literal[ToolRuleType.constrain_child_tools] = ToolRuleType.constrain_child_tools
    children: List[str] = Field(..., description="The children tools that can be invoked.")

    def get_valid_tools(self, tool_call_history: List[str], available_tools: Set[str], last_function_response: Optional[str]) -> Set[str]:
        last_tool = tool_call_history[-1] if tool_call_history else None
        return set(self.children) if last_tool == self.tool_name else available_tools


class ParentToolRule(BaseToolRule):
    """
    A ToolRule that only allows a child tool to be called if the parent has been called.
    """

    type: Literal[ToolRuleType.parent_last_tool] = ToolRuleType.parent_last_tool
    children: List[str] = Field(..., description="The children tools that can be invoked.")

    def get_valid_tools(self, tool_call_history: List[str], available_tools: Set[str], last_function_response: Optional[str]) -> Set[str]:
        last_tool = tool_call_history[-1] if tool_call_history else None
        return set(self.children) if last_tool == self.tool_name else available_tools - set(self.children)


class ConditionalToolRule(BaseToolRule):
    """
    A ToolRule that conditionally maps to different child tools based on the output.
    """

    type: Literal[ToolRuleType.conditional] = ToolRuleType.conditional
    default_child: Optional[str] = Field(None, description="The default child tool to be called. If None, any tool can be called.")
    child_output_mapping: Dict[Any, str] = Field(..., description="The output case to check for mapping")
    require_output_mapping: bool = Field(default=False, description="Whether to throw an error when output doesn't match any case")

    def get_valid_tools(self, tool_call_history: List[str], available_tools: Set[str], last_function_response: Optional[str]) -> Set[str]:
        """Determine valid tools based on function output mapping."""
        if not tool_call_history or tool_call_history[-1] != self.tool_name:
            return available_tools  # No constraints if this rule doesn't apply

        if not last_function_response:
            raise ValueError("Conditional tool rule requires an LLM response to determine which child tool to use")

        try:
            json_response = json.loads(last_function_response)
            function_output = json_response.get("message", "")
        except json.JSONDecodeError:
            if self.require_output_mapping:
                return set()  # Strict mode: Invalid response means no allowed tools
            return {self.default_child} if self.default_child else available_tools

        # Match function output to a mapped child tool
        for key, tool in self.child_output_mapping.items():
            if self._matches_key(function_output, key):
                return {tool}

        # If no match found, use default or allow all tools if no default is set
        if self.require_output_mapping:
            return set()  # Strict mode: No match means no valid tools

        return {self.default_child} if self.default_child else available_tools

    def _matches_key(self, function_output: str, key: Any) -> bool:
        """Helper function to determine if function output matches a mapping key."""
        if isinstance(key, bool):
            return function_output.lower() == "true" if key else function_output.lower() == "false"
        elif isinstance(key, int):
            try:
                return int(function_output) == key
            except ValueError:
                return False
        elif isinstance(key, float):
            try:
                return float(function_output) == key
            except ValueError:
                return False
        else:  # Assume string
            return str(function_output) == str(key)


class InitToolRule(BaseToolRule):
    """
    Represents the initial tool rule configuration.
    """

    type: Literal[ToolRuleType.run_first] = ToolRuleType.run_first


class TerminalToolRule(BaseToolRule):
    """
    Represents a terminal tool rule configuration where if this tool gets called, it must end the agent loop.
    """

    type: Literal[ToolRuleType.exit_loop] = ToolRuleType.exit_loop


class ContinueToolRule(BaseToolRule):
    """
    Represents a tool rule configuration where if this tool gets called, it must continue the agent loop.
    """

    type: Literal[ToolRuleType.continue_loop] = ToolRuleType.continue_loop


class MaxCountPerStepToolRule(BaseToolRule):
    """
    Represents a tool rule configuration which constrains the total number of times this tool can be invoked in a single step.
    """

    type: Literal[ToolRuleType.max_count_per_step] = ToolRuleType.max_count_per_step
    max_count_limit: int = Field(..., description="The max limit for the total number of times this tool can be invoked in a single step.")

    def get_valid_tools(self, tool_call_history: List[str], available_tools: Set[str], last_function_response: Optional[str]) -> Set[str]:
        """Restricts the tool if it has been called max_count_limit times in the current step."""
        count = tool_call_history.count(self.tool_name)

        # If the tool has been used max_count_limit times, it is no longer allowed
        if count >= self.max_count_limit:
            return available_tools - {self.tool_name}

        return available_tools


ToolRule = Annotated[
    Union[ChildToolRule, InitToolRule, TerminalToolRule, ConditionalToolRule, ContinueToolRule, MaxCountPerStepToolRule, ParentToolRule],
    Field(discriminator="type"),
]
