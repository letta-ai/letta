import json
import logging
from typing import Annotated, Any, Dict, List, Literal, Optional, Set, Union

from pydantic import BaseModel, Field, field_validator, model_validator

from letta.schemas.enums import PrimitiveType, ToolRuleType
from letta.schemas.letta_base import LettaBase

logger = logging.getLogger(__name__)


class BaseToolRule(LettaBase):
    __id_prefix__ = PrimitiveType.TOOL_RULE.value
    tool_name: str = Field(..., description="The name of the tool. Must exist in the database for the user's organization.")
    type: ToolRuleType = Field(..., description="The type of the message.")
    prompt_template: Optional[str] = Field(
        None,
        description="Optional template string (ignored). Rendering uses fast built-in formatting for performance.",
    )

    def __hash__(self):
        """Base hash using tool_name and type."""
        return hash((self.tool_name, self.type))

    def __eq__(self, other):
        """Base equality using tool_name and type."""
        if not isinstance(other, BaseToolRule):
            return False
        return self.tool_name == other.tool_name and self.type == other.type

    def get_valid_tools(self, tool_call_history: List[str], available_tools: Set[str], last_function_response: Optional[str]) -> set[str]:
        raise NotImplementedError

    def render_prompt(self) -> str | None:
        """Default implementation returns None. Subclasses provide optimized strings."""
        return None

    @property
    def requires_force_tool_call(self) -> bool:
        """Whether this tool rule requires forcing a tool call in the LLM request when active.
        When True, the LLM must use a tool; when False, tool use is optional.
        Default is False for most rules."""
        return False


class ToolCallNode(BaseModel):
    """Typed child override for prefilled arguments.

    When used in a ChildToolRule, if this child is selected next, its `args` will be
    applied as prefilled arguments (overriding overlapping LLM-provided values).
    """

    name: str = Field(..., description="The name of the child tool to invoke next.")
    args: Optional[Dict[str, Any]] = Field(
        default=None,
        description=(
            "Optional prefilled arguments for this child tool. Keys must match the tool's parameter names and values "
            "must satisfy the tool's JSON schema. Supports partial prefill; non-overlapping parameters are left to the model."
        ),
    )


class ChildToolRule(BaseToolRule):
    """
    A ToolRule represents a tool that can be invoked by the agent.
    """

    type: Literal[ToolRuleType.constrain_child_tools] = ToolRuleType.constrain_child_tools

    children: List[str] = Field(..., description="The children tools that can be invoked.")
    child_arg_nodes: Optional[List[ToolCallNode]] = Field(
        default=None,
        description=("Optional list of typed child argument overrides. Each node must reference a child in 'children'."),
    )
    prompt_template: Optional[str] = Field(
        default=None,
        description="Optional template string (ignored).",
    )

    @property
    def requires_force_tool_call(self) -> bool:
        """Child tool rules require forcing tool calls."""
        return True

    def __hash__(self):
        """Hash including children list (sorted for consistency)."""
        # Hash on child names only for stability
        child_names = tuple(sorted(self.children))
        return hash((self.tool_name, self.type, child_names))

    def __eq__(self, other):
        """Equality including children list."""
        if not isinstance(other, ChildToolRule):
            return False
        self_names = sorted(self.children)
        other_names = sorted(other.children)
        return self.tool_name == other.tool_name and self.type == other.type and self_names == other_names

    def get_child_names(self) -> List[str]:
        return list(self.children)

    def get_child_args_map(self) -> Dict[str, Dict[str, Any]]:
        mapping: Dict[str, Dict[str, Any]] = {}
        if self.child_arg_nodes:
            for node in self.child_arg_nodes:
                if node.args:
                    mapping[node.name] = dict(node.args)
        return mapping

    def get_valid_tools(self, tool_call_history: List[str], available_tools: Set[str], last_function_response: Optional[str]) -> Set[str]:
        last_tool = tool_call_history[-1] if tool_call_history else None
        return set(self.get_child_names()) if last_tool == self.tool_name else available_tools

    def render_prompt(self) -> str | None:
        children_str = ", ".join(self.get_child_names())
        return f"<tool_rule>\nAfter using {self.tool_name}, you must use one of these tools: {children_str}\n</tool_rule>"

    @model_validator(mode="after")
    def validate_child_arg_nodes(self):
        if self.child_arg_nodes:
            child_set = set(self.children)
            for node in self.child_arg_nodes:
                if node.name not in child_set:
                    raise ValueError(
                        f"ChildToolRule child_arg_nodes contains a node for '{node.name}' which is not in children {self.children}."
                    )
        return self


class ParentToolRule(BaseToolRule):
    """
    A ToolRule that only allows a child tool to be called if the parent has been called.
    """

    type: Literal[ToolRuleType.parent_last_tool] = ToolRuleType.parent_last_tool
    children: List[str] = Field(..., description="The children tools that can be invoked.")
    prompt_template: Optional[str] = Field(default=None, description="Optional template string (ignored).")

    @property
    def requires_force_tool_call(self) -> bool:
        """Parent tool rules require forcing tool calls."""
        return True

    def __hash__(self):
        """Hash including children list (sorted for consistency)."""
        return hash((self.tool_name, self.type, tuple(sorted(self.children))))

    def __eq__(self, other):
        """Equality including children list."""
        if not isinstance(other, ParentToolRule):
            return False
        return self.tool_name == other.tool_name and self.type == other.type and sorted(self.children) == sorted(other.children)

    def get_valid_tools(self, tool_call_history: List[str], available_tools: Set[str], last_function_response: Optional[str]) -> Set[str]:
        last_tool = tool_call_history[-1] if tool_call_history else None
        return set(self.children) if last_tool == self.tool_name else available_tools - set(self.children)

    def render_prompt(self) -> str | None:
        children_str = ", ".join(self.children)
        return f"<tool_rule>\n{children_str} can only be used after {self.tool_name}\n</tool_rule>"


class ConditionalToolRule(BaseToolRule):
    """
    A ToolRule that conditionally maps to different child tools based on the output.
    """

    type: Literal[ToolRuleType.conditional] = ToolRuleType.conditional
    default_child: Optional[str] = Field(None, description="The default child tool to be called. If None, any tool can be called.")
    child_output_mapping: Dict[Any, str] = Field(..., description="The output case to check for mapping")
    require_output_mapping: bool = Field(default=False, description="Whether to throw an error when output doesn't match any case")
    prompt_template: Optional[str] = Field(default=None, description="Optional template string (ignored).")

    @property
    def requires_force_tool_call(self) -> bool:
        """Conditional tool rules require forcing tool calls."""
        return True

    def __hash__(self):
        """Hash including all configuration fields."""
        # convert dict to sorted tuple of items for consistent hashing
        mapping_items = tuple(sorted(self.child_output_mapping.items()))
        return hash((self.tool_name, self.type, self.default_child, mapping_items, self.require_output_mapping))

    def __eq__(self, other):
        """Equality including all configuration fields."""
        if not isinstance(other, ConditionalToolRule):
            return False
        return (
            self.tool_name == other.tool_name
            and self.type == other.type
            and self.default_child == other.default_child
            and self.child_output_mapping == other.child_output_mapping
            and self.require_output_mapping == other.require_output_mapping
        )

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

    def render_prompt(self) -> str | None:
        return f"<tool_rule>\n{self.tool_name} will determine which tool to use next based on its output\n</tool_rule>"

    @field_validator("child_output_mapping")
    @classmethod
    def validate_child_output_mapping(cls, v):
        if len(v) == 0:
            raise ValueError("Conditional tool rule must have at least one child tool.")
        return v

    @staticmethod
    def _matches_key(function_output: str, key: Any) -> bool:
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
    args: Optional[Dict[str, Any]] = Field(
        default=None,
        description=(
            "Optional prefilled arguments for this tool. When present, these values will override any LLM-provided "
            "arguments with the same keys during invocation. Keys must match the tool's parameter names and values "
            "must satisfy the tool's JSON schema. Supports partial prefill; non-overlapping parameters are left to the model."
        ),
    )

    @property
    def requires_force_tool_call(self) -> bool:
        """Initial tool rules require forcing tool calls."""
        return True


class TerminalToolRule(BaseToolRule):
    """
    Represents a terminal tool rule configuration where if this tool gets called, it must end the agent loop.
    """

    type: Literal[ToolRuleType.exit_loop] = ToolRuleType.exit_loop
    prompt_template: Optional[str] = Field(default=None, description="Optional template string (ignored).")

    def render_prompt(self) -> str | None:
        return f"<tool_rule>\n{self.tool_name} ends your response (yields control) when called\n</tool_rule>"


class ContinueToolRule(BaseToolRule):
    """
    Represents a tool rule configuration where if this tool gets called, it must continue the agent loop.
    """

    type: Literal[ToolRuleType.continue_loop] = ToolRuleType.continue_loop
    prompt_template: Optional[str] = Field(default=None, description="Optional template string (ignored).")

    def render_prompt(self) -> str | None:
        return f"<tool_rule>\n{self.tool_name} requires continuing your response when called\n</tool_rule>"


class RequiredBeforeExitToolRule(BaseToolRule):
    """
    Represents a tool rule configuration where this tool must be called before the agent loop can exit.
    """

    type: Literal[ToolRuleType.required_before_exit] = ToolRuleType.required_before_exit
    prompt_template: Optional[str] = Field(default=None, description="Optional template string (ignored).")

    def get_valid_tools(self, tool_call_history: List[str], available_tools: Set[str], last_function_response: Optional[str]) -> Set[str]:
        """Returns all available tools - the logic for preventing exit is handled elsewhere."""
        return available_tools

    def render_prompt(self) -> str | None:
        return f"<tool_rule>{self.tool_name} must be called before ending the conversation</tool_rule>"


class MaxCountPerStepToolRule(BaseToolRule):
    """
    Represents a tool rule configuration which constrains the total number of times this tool can be invoked in a single step.
    """

    type: Literal[ToolRuleType.max_count_per_step] = ToolRuleType.max_count_per_step
    max_count_limit: int = Field(..., description="The max limit for the total number of times this tool can be invoked in a single step.")
    prompt_template: Optional[str] = Field(default=None, description="Optional template string (ignored).")

    def __hash__(self):
        """Hash including max_count_limit."""
        return hash((self.tool_name, self.type, self.max_count_limit))

    def __eq__(self, other):
        """Equality including max_count_limit."""
        if not isinstance(other, MaxCountPerStepToolRule):
            return False
        return self.tool_name == other.tool_name and self.type == other.type and self.max_count_limit == other.max_count_limit

    def get_valid_tools(self, tool_call_history: List[str], available_tools: Set[str], last_function_response: Optional[str]) -> Set[str]:
        """Restricts the tool if it has been called max_count_limit times in the current step."""
        count = tool_call_history.count(self.tool_name)

        # If the tool has been used max_count_limit times, it is no longer allowed
        if count >= self.max_count_limit:
            return available_tools - {self.tool_name}

        return available_tools

    def render_prompt(self) -> str | None:
        return f"<tool_rule>\n{self.tool_name}: at most {self.max_count_limit} use(s) per response\n</tool_rule>"


class RequiresApprovalToolRule(BaseToolRule):
    """
    Represents a tool rule configuration which requires approval before the tool can be invoked.
    """

    type: Literal[ToolRuleType.requires_approval] = ToolRuleType.requires_approval

    def get_valid_tools(self, tool_call_history: List[str], available_tools: Set[str], last_function_response: Optional[str]) -> Set[str]:
        """Does not enforce any restrictions on which tools are valid"""
        return available_tools


ToolRule = Annotated[
    Union[
        ChildToolRule,
        InitToolRule,
        TerminalToolRule,
        ConditionalToolRule,
        ContinueToolRule,
        RequiredBeforeExitToolRule,
        MaxCountPerStepToolRule,
        ParentToolRule,
        RequiresApprovalToolRule,
    ],
    Field(discriminator="type"),
]
