from typing import List, Optional, Set, Union

from pydantic import BaseModel, Field

from letta.schemas.enums import ToolRuleType
from letta.schemas.tool_rule import (
    BaseToolRule,
    ChildToolRule,
    ConditionalToolRule,
    ContinueToolRule,
    InitToolRule,
    MaxCountPerStepToolRule,
    ParentToolRule,
    TerminalToolRule,
)


class ToolRuleValidationError(Exception):
    """Custom exception for tool rule validation errors in ToolRulesSolver."""

    def __init__(self, message: str):
        super().__init__(f"ToolRuleValidationError: {message}")


class ToolRulesSolver(BaseModel):
    init_tool_rules: List[InitToolRule] = Field(
        default_factory=list, description="Initial tool rules to be used at the start of tool execution."
    )
    continue_tool_rules: List[ContinueToolRule] = Field(
        default_factory=list, description="Continue tool rules to be used to continue tool execution."
    )
    # TODO: This should be renamed?
    # TODO: These are tools that control the set of allowed functions in the next turn
    child_based_tool_rules: List[Union[ChildToolRule, ConditionalToolRule, MaxCountPerStepToolRule]] = Field(
        default_factory=list, description="Standard tool rules for controlling execution sequence and allowed transitions."
    )
    parent_tool_rules: List[ParentToolRule] = Field(
        default_factory=list, description="Filter tool rules to be used to filter out tools from the available set."
    )
    terminal_tool_rules: List[TerminalToolRule] = Field(
        default_factory=list, description="Terminal tool rules that end the agent loop if called."
    )
    tool_call_history: List[str] = Field(default_factory=list, description="History of tool calls, updated with each tool call.")

    def __init__(
        self,
        tool_rules: Optional[List[BaseToolRule]] = None,
        init_tool_rules: Optional[List[InitToolRule]] = None,
        continue_tool_rules: Optional[List[ContinueToolRule]] = None,
        child_based_tool_rules: Optional[List[Union[ChildToolRule, ConditionalToolRule, MaxCountPerStepToolRule]]] = None,
        parent_tool_rules: Optional[List[ParentToolRule]] = None,
        terminal_tool_rules: Optional[List[TerminalToolRule]] = None,
        tool_call_history: Optional[List[str]] = None,
        **kwargs,
    ):
        super().__init__(
            init_tool_rules=init_tool_rules or [],
            continue_tool_rules=continue_tool_rules or [],
            child_based_tool_rules=child_based_tool_rules or [],
            parent_tool_rules=parent_tool_rules or [],
            terminal_tool_rules=terminal_tool_rules or [],
            tool_call_history=tool_call_history or [],
            **kwargs,
        )

        if tool_rules:
            for rule in tool_rules:
                if rule.type == ToolRuleType.run_first:
                    assert isinstance(rule, InitToolRule)
                    self.init_tool_rules.append(rule)
                elif rule.type == ToolRuleType.constrain_child_tools:
                    assert isinstance(rule, ChildToolRule)
                    self.child_based_tool_rules.append(rule)
                elif rule.type == ToolRuleType.conditional:
                    assert isinstance(rule, ConditionalToolRule)
                    self.validate_conditional_tool(rule)
                    self.child_based_tool_rules.append(rule)
                elif rule.type == ToolRuleType.exit_loop:
                    assert isinstance(rule, TerminalToolRule)
                    self.terminal_tool_rules.append(rule)
                elif rule.type == ToolRuleType.continue_loop:
                    assert isinstance(rule, ContinueToolRule)
                    self.continue_tool_rules.append(rule)
                elif rule.type == ToolRuleType.max_count_per_step:
                    assert isinstance(rule, MaxCountPerStepToolRule)
                    self.child_based_tool_rules.append(rule)
                elif rule.type == ToolRuleType.parent_last_tool:
                    assert isinstance(rule, ParentToolRule)
                    self.parent_tool_rules.append(rule)

    def register_tool_call(self, tool_name: str):
        """Update the internal state to track tool call history."""
        self.tool_call_history.append(tool_name)

    def clear_tool_history(self):
        """Clear the history of tool calls."""
        self.tool_call_history.clear()

    def get_allowed_tool_names(
        self, available_tools: Set[str], error_on_empty: bool = False, last_function_response: Optional[str] = None
    ) -> List[str]:
        """Get a list of tool names allowed based on the last tool called."""
        # TODO: This piece of code here is quite ugly and deserves a refactor
        # TODO: There's some weird logic encoded here:
        # TODO: -> This only takes into consideration Init, and a set of Child/Conditional/MaxSteps tool rules
        # TODO: -> Init tool rules outputs are treated additively, Child/Conditional/MaxSteps are intersection based
        # TODO: -> Tool rules should probably be refactored to take in a set of tool names?
        # If no tool has been called yet, return InitToolRules additively
        if not self.tool_call_history:
            if self.init_tool_rules:
                # If there are init tool rules, only return those defined in the init tool rules
                return [rule.tool_name for rule in self.init_tool_rules]
            else:
                # Otherwise, return all tools besides those constrained by parent tool rules
                available_tools = available_tools - set.union(set(), *(set(rule.children) for rule in self.parent_tool_rules))
                return list(available_tools)
        else:
            # Collect valid tools from all child-based rules
            valid_tool_sets = [
                rule.get_valid_tools(self.tool_call_history, available_tools, last_function_response)
                for rule in self.child_based_tool_rules + self.parent_tool_rules
            ]

            # Compute intersection of all valid tool sets
            final_allowed_tools = set.intersection(*valid_tool_sets) if valid_tool_sets else available_tools

            if error_on_empty and not final_allowed_tools:
                raise ValueError("No valid tools found based on tool rules.")

            return list(final_allowed_tools)

    def is_terminal_tool(self, tool_name: str) -> bool:
        """Check if the tool is defined as a terminal tool in the terminal tool rules."""
        return any(rule.tool_name == tool_name for rule in self.terminal_tool_rules)

    def has_children_tools(self, tool_name):
        """Check if the tool has children tools"""
        return any(rule.tool_name == tool_name for rule in self.child_based_tool_rules)

    def is_continue_tool(self, tool_name):
        """Check if the tool is defined as a continue tool in the tool rules."""
        return any(rule.tool_name == tool_name for rule in self.continue_tool_rules)

    def validate_conditional_tool(self, rule: ConditionalToolRule):
        """
        Validate a conditional tool rule

        Args:
            rule (ConditionalToolRule): The conditional tool rule to validate

        Raises:
            ToolRuleValidationError: If the rule is invalid
        """
        if len(rule.child_output_mapping) == 0:
            raise ToolRuleValidationError("Conditional tool rule must have at least one child tool.")
        return True
