import pytest

from letta.helpers import ToolRulesSolver
from letta.helpers.tool_rule_solver import ToolRuleValidationError
from letta.schemas.tool_rule import ChildToolRule, ConditionalToolRule, InitToolRule, MaxCountPerStepToolRule, TerminalToolRule

# Constants for tool names used in the tests
START_TOOL = "start_tool"
PREP_TOOL = "prep_tool"
NEXT_TOOL = "next_tool"
HELPER_TOOL = "helper_tool"
FINAL_TOOL = "final_tool"
END_TOOL = "end_tool"
UNRECOGNIZED_TOOL = "unrecognized_tool"


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

    solver.update_tool_usage(START_TOOL)
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

    solver.update_tool_usage(UNRECOGNIZED_TOOL)
    with pytest.raises(ValueError, match=f"No valid tools found based on tool rules."):
        solver.get_allowed_tool_names(set(), error_on_empty=True)


def test_update_tool_usage_and_get_allowed_tool_names_combined():
    init_rule = InitToolRule(tool_name=START_TOOL)
    rule_1 = ChildToolRule(tool_name=START_TOOL, children=[NEXT_TOOL])
    rule_2 = ChildToolRule(tool_name=NEXT_TOOL, children=[FINAL_TOOL])
    terminal_rule = TerminalToolRule(tool_name=FINAL_TOOL)
    solver = ToolRulesSolver(tool_rules=[init_rule, rule_1, rule_2, terminal_rule])

    assert solver.get_allowed_tool_names({START_TOOL}) == [START_TOOL], "Initial allowed tool should be 'start_tool'"

    solver.update_tool_usage(START_TOOL)
    assert solver.get_allowed_tool_names({NEXT_TOOL}) == [NEXT_TOOL], "After 'start_tool', should allow 'next_tool'"

    solver.update_tool_usage(NEXT_TOOL)
    assert solver.get_allowed_tool_names({FINAL_TOOL}) == [FINAL_TOOL], "After 'next_tool', should allow 'final_tool'"

    assert solver.is_terminal_tool(FINAL_TOOL) is True, "Should recognize 'final_tool' as terminal"


def test_conditional_tool_rule():
    init_rule = InitToolRule(tool_name=START_TOOL)
    terminal_rule = TerminalToolRule(tool_name=END_TOOL)
    rule = ConditionalToolRule(tool_name=START_TOOL, default_child=None, child_output_mapping={True: END_TOOL, False: START_TOOL})
    solver = ToolRulesSolver(tool_rules=[init_rule, rule, terminal_rule])

    assert solver.get_allowed_tool_names({START_TOOL}) == [START_TOOL], "Initial allowed tool should be 'start_tool'"

    solver.update_tool_usage(START_TOOL)
    assert solver.get_allowed_tool_names({END_TOOL}, last_function_response='{"message": "true"}') == [
        END_TOOL
    ], "After 'start_tool' returns true, should allow 'end_tool'"
    assert solver.get_allowed_tool_names({START_TOOL}, last_function_response='{"message": "false"}') == [
        START_TOOL
    ], "After 'start_tool' returns false, should allow 'start_tool'"

    assert solver.is_terminal_tool(END_TOOL) is True, "Should recognize 'end_tool' as terminal"


def test_invalid_conditional_tool_rule():
    init_rule = InitToolRule(tool_name=START_TOOL)
    terminal_rule = TerminalToolRule(tool_name=END_TOOL)
    invalid_rule_1 = ConditionalToolRule(tool_name=START_TOOL, default_child=END_TOOL, child_output_mapping={})

    with pytest.raises(ToolRuleValidationError, match="Conditional tool rule must have at least one child tool."):
        ToolRulesSolver(tool_rules=[init_rule, invalid_rule_1, terminal_rule])


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

    solver.update_tool_usage(START_TOOL)
    assert solver.get_allowed_tool_names({START_TOOL}) == [START_TOOL], "After first use, should still allow 'start_tool'"

    solver.update_tool_usage(START_TOOL)
    assert solver.get_allowed_tool_names({START_TOOL}) == [], "After reaching max count, 'start_tool' should no longer be allowed"


def test_max_count_per_step_tool_rule_allows_usage_up_to_limit():
    """Ensure the tool is allowed exactly max_count_limit times."""
    rule = MaxCountPerStepToolRule(tool_name=START_TOOL, max_count_limit=3)
    solver = ToolRulesSolver(tool_rules=[rule])

    assert solver.get_allowed_tool_names({START_TOOL}) == [START_TOOL], "Initially should allow 'start_tool'"

    solver.update_tool_usage(START_TOOL)
    assert solver.get_allowed_tool_names({START_TOOL}) == [START_TOOL], "Should still allow 'start_tool' after 1 use"

    solver.update_tool_usage(START_TOOL)
    assert solver.get_allowed_tool_names({START_TOOL}) == [START_TOOL], "Should still allow 'start_tool' after 2 uses"

    solver.update_tool_usage(START_TOOL)
    assert solver.get_allowed_tool_names({START_TOOL}) == [], "Should no longer allow 'start_tool' after 3 uses"


def test_max_count_per_step_tool_rule_does_not_affect_other_tools():
    """Ensure exceeding max count for one tool does not impact others."""
    rule = MaxCountPerStepToolRule(tool_name=START_TOOL, max_count_limit=2)
    another_tool_rules = ChildToolRule(tool_name=NEXT_TOOL, children=[HELPER_TOOL])
    solver = ToolRulesSolver(tool_rules=[rule, another_tool_rules])

    solver.update_tool_usage(START_TOOL)
    solver.update_tool_usage(START_TOOL)

    assert sorted(solver.get_allowed_tool_names({START_TOOL, NEXT_TOOL, HELPER_TOOL})) == sorted(
        [NEXT_TOOL, HELPER_TOOL]
    ), "Other tools should still be allowed even if 'start_tool' is over limit"


def test_max_count_per_step_tool_rule_resets_on_clear():
    """Ensure clearing tool history resets the rule's limit."""
    rule = MaxCountPerStepToolRule(tool_name=START_TOOL, max_count_limit=2)
    solver = ToolRulesSolver(tool_rules=[rule])

    solver.update_tool_usage(START_TOOL)
    solver.update_tool_usage(START_TOOL)

    assert solver.get_allowed_tool_names({START_TOOL}) == [], "Should not allow 'start_tool' after reaching limit"

    solver.clear_tool_history()

    assert solver.get_allowed_tool_names({START_TOOL}) == [START_TOOL], "Should allow 'start_tool' again after clearing history"
