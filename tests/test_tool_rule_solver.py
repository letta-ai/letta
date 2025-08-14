import pytest

from letta.helpers import ToolRulesSolver
from letta.schemas.tool_rule import (
    ChildToolRule,
    ConditionalToolRule,
    InitToolRule,
    MaxCountPerStepToolRule,
    RequiredBeforeExitToolRule,
    TerminalToolRule,
)

# Constants for tool names used in the tests
START_TOOL = "start_tool"
PREP_TOOL = "prep_tool"
NEXT_TOOL = "next_tool"
HELPER_TOOL = "helper_tool"
FINAL_TOOL = "final_tool"
END_TOOL = "end_tool"
UNRECOGNIZED_TOOL = "unrecognized_tool"
REQUIRED_TOOL_1 = "required_tool_1"
REQUIRED_TOOL_2 = "required_tool_2"
SAVE_TOOL = "save_tool"


def test_get_allowed_tool_names_with_init_rules():
    init_rule_1 = InitToolRule(tool_name=START_TOOL)
    init_rule_2 = InitToolRule(tool_name=PREP_TOOL)
    solver = ToolRulesSolver(tool_rules=[init_rule_1, init_rule_2])

    allowed_tools = solver.get_allowed_tool_names(set())

    assert allowed_tools == [START_TOOL, PREP_TOOL], "Should allow only InitToolRule tools at the start"


def test_get_allowed_tool_names_with_subsequent_rule():
    init_rule = InitToolRule(tool_name=START_TOOL)
    rule_1 = ChildToolRule(tool_name=START_TOOL, children=[NEXT_TOOL, HELPER_TOOL])
    solver = ToolRulesSolver(tool_rules=[init_rule, rule_1])

    solver.register_tool_call(START_TOOL)
    allowed_tools = solver.get_allowed_tool_names({START_TOOL, NEXT_TOOL, HELPER_TOOL})

    assert sorted(allowed_tools) == sorted([NEXT_TOOL, HELPER_TOOL]), "Should allow only children of the last tool used"


def test_is_terminal_tool():
    init_rule = InitToolRule(tool_name=START_TOOL)
    terminal_rule = TerminalToolRule(tool_name=END_TOOL)
    solver = ToolRulesSolver(tool_rules=[init_rule, terminal_rule])

    assert solver.is_terminal_tool(END_TOOL) is True, "Should recognize 'end_tool' as a terminal tool"
    assert solver.is_terminal_tool(START_TOOL) is False, "Should not recognize 'start_tool' as a terminal tool"


def test_get_allowed_tool_names_no_matching_rule_error():
    init_rule = InitToolRule(tool_name=START_TOOL)
    solver = ToolRulesSolver(tool_rules=[init_rule])

    solver.register_tool_call(UNRECOGNIZED_TOOL)
    with pytest.raises(ValueError, match="No valid tools found based on tool rules."):
        solver.get_allowed_tool_names(set(), error_on_empty=True)


def test_update_tool_usage_and_get_allowed_tool_names_combined():
    init_rule = InitToolRule(tool_name=START_TOOL)
    rule_1 = ChildToolRule(tool_name=START_TOOL, children=[NEXT_TOOL])
    rule_2 = ChildToolRule(tool_name=NEXT_TOOL, children=[FINAL_TOOL])
    terminal_rule = TerminalToolRule(tool_name=FINAL_TOOL)
    solver = ToolRulesSolver(tool_rules=[init_rule, rule_1, rule_2, terminal_rule])

    assert solver.get_allowed_tool_names({START_TOOL}) == [START_TOOL], "Initial allowed tool should be 'start_tool'"

    solver.register_tool_call(START_TOOL)
    assert solver.get_allowed_tool_names({NEXT_TOOL}) == [NEXT_TOOL], "After 'start_tool', should allow 'next_tool'"

    solver.register_tool_call(NEXT_TOOL)
    assert solver.get_allowed_tool_names({FINAL_TOOL}) == [FINAL_TOOL], "After 'next_tool', should allow 'final_tool'"

    assert solver.is_terminal_tool(FINAL_TOOL) is True, "Should recognize 'final_tool' as terminal"


def test_conditional_tool_rule():
    init_rule = InitToolRule(tool_name=START_TOOL)
    terminal_rule = TerminalToolRule(tool_name=END_TOOL)
    rule = ConditionalToolRule(tool_name=START_TOOL, default_child=None, child_output_mapping={True: END_TOOL, False: START_TOOL})
    solver = ToolRulesSolver(tool_rules=[init_rule, rule, terminal_rule])

    assert solver.get_allowed_tool_names({START_TOOL}) == [START_TOOL], "Initial allowed tool should be 'start_tool'"

    solver.register_tool_call(START_TOOL)
    assert solver.get_allowed_tool_names({END_TOOL}, last_function_response='{"message": "true"}') == [
        END_TOOL
    ], "After 'start_tool' returns true, should allow 'end_tool'"
    assert solver.get_allowed_tool_names({START_TOOL}, last_function_response='{"message": "false"}') == [
        START_TOOL
    ], "After 'start_tool' returns false, should allow 'start_tool'"

    assert solver.is_terminal_tool(END_TOOL) is True, "Should recognize 'end_tool' as terminal"


def test_invalid_conditional_tool_rule():
    with pytest.raises(ValueError, match="Conditional tool rule must have at least one child tool."):
        ConditionalToolRule(tool_name=START_TOOL, default_child=END_TOOL, child_output_mapping={})


def test_tool_rules_with_invalid_path():
    init_rule = InitToolRule(tool_name=START_TOOL)
    rule_1 = ChildToolRule(tool_name=START_TOOL, children=[NEXT_TOOL])
    rule_2 = ChildToolRule(tool_name=NEXT_TOOL, children=[HELPER_TOOL])
    rule_3 = ChildToolRule(tool_name=HELPER_TOOL, children=[START_TOOL])
    rule_4 = ChildToolRule(tool_name=FINAL_TOOL, children=[END_TOOL])
    terminal_rule = TerminalToolRule(tool_name=END_TOOL)

    ToolRulesSolver(tool_rules=[init_rule, rule_1, rule_2, rule_3, rule_4, terminal_rule])

    rule_5 = ConditionalToolRule(
        tool_name=HELPER_TOOL,
        default_child=FINAL_TOOL,
        child_output_mapping={True: START_TOOL, False: FINAL_TOOL},
    )
    ToolRulesSolver(tool_rules=[init_rule, rule_1, rule_2, rule_3, rule_4, rule_5, terminal_rule])


def test_max_count_per_step_tool_rule():
    init_rule = InitToolRule(tool_name=START_TOOL)
    rule_1 = MaxCountPerStepToolRule(tool_name=START_TOOL, max_count_limit=2)
    solver = ToolRulesSolver(tool_rules=[init_rule, rule_1])

    assert solver.get_allowed_tool_names({START_TOOL}) == [START_TOOL], "Initially should allow 'start_tool'"

    solver.register_tool_call(START_TOOL)
    assert solver.get_allowed_tool_names({START_TOOL}) == [START_TOOL], "After first use, should still allow 'start_tool'"

    solver.register_tool_call(START_TOOL)
    assert (
        solver.get_allowed_tool_names({START_TOOL}, error_on_empty=False) == []
    ), "After reaching max count, 'start_tool' should no longer be allowed"


def test_max_count_per_step_tool_rule_allows_usage_up_to_limit():
    """Ensure the tool is allowed exactly max_count_limit times."""
    rule = MaxCountPerStepToolRule(tool_name=START_TOOL, max_count_limit=3)
    solver = ToolRulesSolver(tool_rules=[rule])

    assert solver.get_allowed_tool_names({START_TOOL}) == [START_TOOL], "Initially should allow 'start_tool'"

    solver.register_tool_call(START_TOOL)
    assert solver.get_allowed_tool_names({START_TOOL}) == [START_TOOL], "Should still allow 'start_tool' after 1 use"

    solver.register_tool_call(START_TOOL)
    assert solver.get_allowed_tool_names({START_TOOL}) == [START_TOOL], "Should still allow 'start_tool' after 2 uses"

    solver.register_tool_call(START_TOOL)
    assert solver.get_allowed_tool_names({START_TOOL}, error_on_empty=False) == [], "Should no longer allow 'start_tool' after 3 uses"


def test_max_count_per_step_tool_rule_does_not_affect_other_tools():
    """Ensure exceeding max count for one tool does not impact others."""
    rule = MaxCountPerStepToolRule(tool_name=START_TOOL, max_count_limit=2)
    another_tool_rules = ChildToolRule(tool_name=NEXT_TOOL, children=[HELPER_TOOL])
    solver = ToolRulesSolver(tool_rules=[rule, another_tool_rules])

    solver.register_tool_call(START_TOOL)
    solver.register_tool_call(START_TOOL)

    assert sorted(solver.get_allowed_tool_names({START_TOOL, NEXT_TOOL, HELPER_TOOL})) == sorted(
        [NEXT_TOOL, HELPER_TOOL]
    ), "Other tools should still be allowed even if 'start_tool' is over limit"


def test_max_count_per_step_tool_rule_resets_on_clear():
    """Ensure clearing tool history resets the rule's limit."""
    rule = MaxCountPerStepToolRule(tool_name=START_TOOL, max_count_limit=2)
    solver = ToolRulesSolver(tool_rules=[rule])

    solver.register_tool_call(START_TOOL)
    solver.register_tool_call(START_TOOL)

    assert solver.get_allowed_tool_names({START_TOOL}, error_on_empty=False) == [], "Should not allow 'start_tool' after reaching limit"

    solver.clear_tool_history()

    assert solver.get_allowed_tool_names({START_TOOL}) == [START_TOOL], "Should allow 'start_tool' again after clearing history"


def test_required_before_exit_tool_rule_has_required_tools_been_called():
    """Test has_required_tools_been_called() with no required tools."""
    solver = ToolRulesSolver(tool_rules=[])

    assert solver.has_required_tools_been_called(set()) is True, "Should return True when no required tools are defined"


def test_required_before_exit_tool_rule_single_required_tool():
    """Test with a single required-before-exit tool."""
    required_rule = RequiredBeforeExitToolRule(tool_name=SAVE_TOOL)
    solver = ToolRulesSolver(tool_rules=[required_rule])

    assert solver.has_required_tools_been_called({SAVE_TOOL}) is False, "Should return False when required tool hasn't been called"
    assert solver.get_uncalled_required_tools({SAVE_TOOL}) == [SAVE_TOOL], "Should return list with uncalled required tool"

    solver.register_tool_call(SAVE_TOOL)

    assert solver.has_required_tools_been_called({SAVE_TOOL}) is True, "Should return True after required tool is called"
    assert solver.get_uncalled_required_tools({SAVE_TOOL}) == [], "Should return empty list after required tool is called"


def test_required_before_exit_tool_rule_multiple_required_tools():
    """Test with multiple required-before-exit tools."""
    required_rule_1 = RequiredBeforeExitToolRule(tool_name=REQUIRED_TOOL_1)
    required_rule_2 = RequiredBeforeExitToolRule(tool_name=REQUIRED_TOOL_2)
    solver = ToolRulesSolver(tool_rules=[required_rule_1, required_rule_2])

    assert (
        solver.has_required_tools_been_called({REQUIRED_TOOL_1, REQUIRED_TOOL_2}) is False
    ), "Should return False when no required tools have been called"
    uncalled_tools = solver.get_uncalled_required_tools({REQUIRED_TOOL_1, REQUIRED_TOOL_2})
    assert set(uncalled_tools) == {REQUIRED_TOOL_1, REQUIRED_TOOL_2}, "Should return both uncalled required tools"

    # Call first required tool
    solver.register_tool_call(REQUIRED_TOOL_1)

    assert (
        solver.has_required_tools_been_called({REQUIRED_TOOL_1, REQUIRED_TOOL_2}) is False
    ), "Should return False when only one required tool has been called"
    assert solver.get_uncalled_required_tools({REQUIRED_TOOL_1, REQUIRED_TOOL_2}) == [
        REQUIRED_TOOL_2
    ], "Should return remaining uncalled required tool"

    # Call second required tool
    solver.register_tool_call(REQUIRED_TOOL_2)

    assert (
        solver.has_required_tools_been_called({REQUIRED_TOOL_1, REQUIRED_TOOL_2}) is True
    ), "Should return True when all required tools have been called"
    assert (
        solver.get_uncalled_required_tools({REQUIRED_TOOL_1, REQUIRED_TOOL_2}) == []
    ), "Should return empty list when all required tools have been called"


def test_required_before_exit_tool_rule_mixed_with_other_tools():
    """Test required-before-exit tools mixed with other tool calls."""
    required_rule = RequiredBeforeExitToolRule(tool_name=SAVE_TOOL)
    solver = ToolRulesSolver(tool_rules=[required_rule])

    # Call other tools first
    solver.register_tool_call(START_TOOL)
    solver.register_tool_call(HELPER_TOOL)

    assert solver.has_required_tools_been_called({SAVE_TOOL}) is False, "Should return False even after calling other tools"
    assert solver.get_uncalled_required_tools({SAVE_TOOL}) == [SAVE_TOOL], "Should still show required tool as uncalled"

    # Call required tool
    solver.register_tool_call(SAVE_TOOL)

    assert solver.has_required_tools_been_called({SAVE_TOOL}) is True, "Should return True after required tool is called"
    assert solver.get_uncalled_required_tools({SAVE_TOOL}) == [], "Should return empty list after required tool is called"


def test_required_before_exit_tool_rule_clear_history():
    """Test that clearing history resets the required tools state."""
    required_rule = RequiredBeforeExitToolRule(tool_name=SAVE_TOOL)
    solver = ToolRulesSolver(tool_rules=[required_rule])

    # Call required tool
    solver.register_tool_call(SAVE_TOOL)
    assert solver.has_required_tools_been_called({SAVE_TOOL}) is True, "Should return True after required tool is called"

    # Clear history
    solver.clear_tool_history()

    assert solver.has_required_tools_been_called({SAVE_TOOL}) is False, "Should return False after clearing history"
    assert solver.get_uncalled_required_tools({SAVE_TOOL}) == [SAVE_TOOL], "Should show required tool as uncalled after clearing history"
