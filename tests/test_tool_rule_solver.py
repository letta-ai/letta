import pytest

from letta.agents.helpers import merge_and_validate_prefilled_args
from letta.helpers import ToolRulesSolver
from letta.schemas.enums import ToolType
from letta.schemas.tool import Tool
from letta.schemas.tool_rule import (
    ChildToolRule,
    ConditionalToolRule,
    ContinueToolRule,
    InitToolRule,
    MaxCountPerStepToolRule,
    ParentToolRule,
    RequiredBeforeExitToolRule,
    RequiresApprovalToolRule,
    TerminalToolRule,
    ToolCallNode,
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
REQUIRES_APPROVAL_TOOL = "requires_approval_tool"


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


def test_is_requires_approval_tool():
    init_rule = InitToolRule(tool_name=START_TOOL)
    terminal_rule = TerminalToolRule(tool_name=END_TOOL)
    requires_approval_tool = RequiresApprovalToolRule(tool_name=REQUIRES_APPROVAL_TOOL)
    solver = ToolRulesSolver(tool_rules=[init_rule, terminal_rule, requires_approval_tool])

    assert solver.is_requires_approval_tool(START_TOOL) is False, "Should not recognize 'start_tool' as a requires approval tool"
    assert solver.is_requires_approval_tool(END_TOOL) is False, "Should not recognize 'end_tool' as a requires approval tool"
    assert solver.is_requires_approval_tool(REQUIRES_APPROVAL_TOOL) is True, "Should recognize 'requires_approval_tool' as a terminal tool"


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
    assert solver.get_allowed_tool_names({END_TOOL}, last_function_response='{"message": "true"}') == [END_TOOL], (
        "After 'start_tool' returns true, should allow 'end_tool'"
    )
    assert solver.get_allowed_tool_names({START_TOOL}, last_function_response='{"message": "false"}') == [START_TOOL], (
        "After 'start_tool' returns false, should allow 'start_tool'"
    )

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
    assert solver.get_allowed_tool_names({START_TOOL}, error_on_empty=False) == [], (
        "After reaching max count, 'start_tool' should no longer be allowed"
    )


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

    assert sorted(solver.get_allowed_tool_names({START_TOOL, NEXT_TOOL, HELPER_TOOL})) == sorted([NEXT_TOOL, HELPER_TOOL]), (
        "Other tools should still be allowed even if 'start_tool' is over limit"
    )


def test_max_count_per_step_tool_rule_resets_on_clear():
    """Ensure clearing tool history resets the rule's limit."""
    rule = MaxCountPerStepToolRule(tool_name=START_TOOL, max_count_limit=2)
    solver = ToolRulesSolver(tool_rules=[rule])

    solver.register_tool_call(START_TOOL)
    solver.register_tool_call(START_TOOL)

    assert solver.get_allowed_tool_names({START_TOOL}, error_on_empty=False) == [], "Should not allow 'start_tool' after reaching limit"

    solver.clear_tool_history()

    assert solver.get_allowed_tool_names({START_TOOL}) == [START_TOOL], "Should allow 'start_tool' again after clearing history"


def test_tool_rule_equality_and_hashing():
    """Test __eq__ and __hash__ methods for all tool rule types."""

    # test InitToolRule equality
    rule1 = InitToolRule(tool_name="test_tool")
    rule2 = InitToolRule(tool_name="test_tool")
    rule3 = InitToolRule(tool_name="different_tool")

    assert rule1 == rule2, "InitToolRules with same tool_name should be equal"
    assert rule1 != rule3, "InitToolRules with different tool_name should not be equal"
    assert hash(rule1) == hash(rule2), "Equal InitToolRules should have same hash"
    assert hash(rule1) != hash(rule3), "Different InitToolRules should have different hash"

    # test ChildToolRule equality
    child_rule1 = ChildToolRule(tool_name="parent", children=["child1", "child2"])
    child_rule2 = ChildToolRule(tool_name="parent", children=["child2", "child1"])  # different order
    child_rule3 = ChildToolRule(tool_name="parent", children=["child1"])
    child_rule4 = ChildToolRule(tool_name="different_parent", children=["child1", "child2"])

    assert child_rule1 == child_rule2, "ChildToolRules with same children (different order) should be equal"
    assert child_rule1 != child_rule3, "ChildToolRules with different children should not be equal"
    assert child_rule1 != child_rule4, "ChildToolRules with different tool_name should not be equal"
    assert hash(child_rule1) == hash(child_rule2), "Equal ChildToolRules should have same hash"
    assert hash(child_rule1) != hash(child_rule3), "Different ChildToolRules should have different hash"

    # test ConditionalToolRule equality
    cond_rule1 = ConditionalToolRule(
        tool_name="conditional", child_output_mapping={"yes": "tool1", "no": "tool2"}, default_child="tool3", require_output_mapping=True
    )
    cond_rule2 = ConditionalToolRule(
        tool_name="conditional",
        child_output_mapping={"no": "tool2", "yes": "tool1"},  # different order
        default_child="tool3",
        require_output_mapping=True,
    )
    cond_rule3 = ConditionalToolRule(
        tool_name="conditional",
        child_output_mapping={"yes": "tool1", "no": "tool2"},
        default_child="different_tool",
        require_output_mapping=True,
    )
    cond_rule4 = ConditionalToolRule(
        tool_name="conditional",
        child_output_mapping={"yes": "tool1", "no": "tool2"},
        default_child="tool3",
        require_output_mapping=False,  # different require_output_mapping
    )

    assert cond_rule1 == cond_rule2, "ConditionalToolRules with same mapping (different order) should be equal"
    assert cond_rule1 != cond_rule3, "ConditionalToolRules with different default_child should not be equal"
    assert cond_rule1 != cond_rule4, "ConditionalToolRules with different require_output_mapping should not be equal"
    assert hash(cond_rule1) == hash(cond_rule2), "Equal ConditionalToolRules should have same hash"
    assert hash(cond_rule1) != hash(cond_rule3), "Different ConditionalToolRules should have different hash"

    # test MaxCountPerStepToolRule equality
    max_rule1 = MaxCountPerStepToolRule(tool_name="limited_tool", max_count_limit=3)
    max_rule2 = MaxCountPerStepToolRule(tool_name="limited_tool", max_count_limit=3)
    max_rule3 = MaxCountPerStepToolRule(tool_name="limited_tool", max_count_limit=5)
    max_rule4 = MaxCountPerStepToolRule(tool_name="different_tool", max_count_limit=3)

    assert max_rule1 == max_rule2, "MaxCountPerStepToolRules with same limit should be equal"
    assert max_rule1 != max_rule3, "MaxCountPerStepToolRules with different limit should not be equal"
    assert max_rule1 != max_rule4, "MaxCountPerStepToolRules with different tool_name should not be equal"
    assert hash(max_rule1) == hash(max_rule2), "Equal MaxCountPerStepToolRules should have same hash"
    assert hash(max_rule1) != hash(max_rule3), "Different MaxCountPerStepToolRules should have different hash"

    # test TerminalToolRule equality
    term_rule1 = TerminalToolRule(tool_name="exit_tool")
    term_rule2 = TerminalToolRule(tool_name="exit_tool")
    term_rule3 = TerminalToolRule(tool_name="different_exit_tool")

    assert term_rule1 == term_rule2, "TerminalToolRules with same tool_name should be equal"
    assert term_rule1 != term_rule3, "TerminalToolRules with different tool_name should not be equal"
    assert hash(term_rule1) == hash(term_rule2), "Equal TerminalToolRules should have same hash"

    # test RequiredBeforeExitToolRule equality
    req_rule1 = RequiredBeforeExitToolRule(tool_name="required_tool")
    req_rule2 = RequiredBeforeExitToolRule(tool_name="required_tool")
    req_rule3 = RequiredBeforeExitToolRule(tool_name="different_required_tool")

    assert req_rule1 == req_rule2, "RequiredBeforeExitToolRules with same tool_name should be equal"
    assert req_rule1 != req_rule3, "RequiredBeforeExitToolRules with different tool_name should not be equal"
    assert hash(req_rule1) == hash(req_rule2), "Equal RequiredBeforeExitToolRules should have same hash"

    # test cross-type inequality
    assert rule1 != child_rule1, "Different rule types should never be equal"
    assert child_rule1 != cond_rule1, "Different rule types should never be equal"
    assert max_rule1 != term_rule1, "Different rule types should never be equal"


def test_tool_rule_deduplication_in_set():
    """Test that duplicate tool rules are properly deduplicated when used in sets."""

    # create duplicate rules
    rule1 = InitToolRule(tool_name="start")
    rule2 = InitToolRule(tool_name="start")  # duplicate
    rule3 = InitToolRule(tool_name="different_start")

    child1 = ChildToolRule(tool_name="parent", children=["a", "b"])
    child2 = ChildToolRule(tool_name="parent", children=["b", "a"])  # duplicate (different order)
    child3 = ChildToolRule(tool_name="parent", children=["a", "b", "c"])  # different

    max1 = MaxCountPerStepToolRule(tool_name="limited", max_count_limit=2)
    max2 = MaxCountPerStepToolRule(tool_name="limited", max_count_limit=2)  # duplicate
    max3 = MaxCountPerStepToolRule(tool_name="limited", max_count_limit=3)  # different

    # test set deduplication
    rules_set = {rule1, rule2, rule3, child1, child2, child3, max1, max2, max3}
    assert len(rules_set) == 6, "Set should contain only unique rules"

    # test list deduplication using dict.fromkeys
    rules_list = [rule1, rule2, rule3, child1, child2, child3, max1, max2, max3]
    deduplicated = list(dict.fromkeys(rules_list))
    assert len(deduplicated) == 6, "dict.fromkeys should deduplicate rules"
    assert deduplicated[0] == rule1, "Order should be preserved"
    assert deduplicated[1] == rule3, "Order should be preserved"
    assert deduplicated[2] == child1, "Order should be preserved"
    assert deduplicated[3] == child3, "Order should be preserved"
    assert deduplicated[4] == max1, "Order should be preserved"
    assert deduplicated[5] == max3, "Order should be preserved"


def test_parent_tool_rule_equality():
    """Test ParentToolRule equality and hashing."""
    parent_rule1 = ParentToolRule(tool_name="parent", children=["child1", "child2"])
    parent_rule2 = ParentToolRule(tool_name="parent", children=["child2", "child1"])  # different order
    parent_rule3 = ParentToolRule(tool_name="parent", children=["child1"])
    parent_rule4 = ParentToolRule(tool_name="different_parent", children=["child1", "child2"])

    assert parent_rule1 == parent_rule2, "ParentToolRules with same children (different order) should be equal"
    assert parent_rule1 != parent_rule3, "ParentToolRules with different children should not be equal"
    assert parent_rule1 != parent_rule4, "ParentToolRules with different tool_name should not be equal"
    assert hash(parent_rule1) == hash(parent_rule2), "Equal ParentToolRules should have same hash"
    assert hash(parent_rule1) != hash(parent_rule3), "Different ParentToolRules should have different hash"


def test_continue_tool_rule_equality_and_hashing():
    r1 = ContinueToolRule(tool_name="go_on")
    r2 = ContinueToolRule(tool_name="go_on")
    r3 = ContinueToolRule(tool_name="different")

    assert r1 == r2
    assert hash(r1) == hash(r2)
    assert r1 != r3
    assert hash(r1) != hash(r3)


@pytest.mark.parametrize(
    "rule_factory, kwargs_a, kwargs_b",
    [
        (lambda **kw: InitToolRule(**kw), dict(tool_name="t"), dict(tool_name="t")),
        (lambda **kw: TerminalToolRule(**kw), dict(tool_name="t"), dict(tool_name="t")),
        (lambda **kw: ContinueToolRule(**kw), dict(tool_name="t"), dict(tool_name="t")),
        (lambda **kw: RequiredBeforeExitToolRule(**kw), dict(tool_name="t"), dict(tool_name="t")),
        (lambda **kw: MaxCountPerStepToolRule(**kw), dict(tool_name="t", max_count_limit=2), dict(tool_name="t", max_count_limit=2)),
        (lambda **kw: ChildToolRule(**kw), dict(tool_name="t", children=["a", "b"]), dict(tool_name="t", children=["a", "b"])),
        (lambda **kw: ParentToolRule(**kw), dict(tool_name="t", children=["a", "b"]), dict(tool_name="t", children=["a", "b"])),
        (
            lambda **kw: ConditionalToolRule(**kw),
            dict(tool_name="t", child_output_mapping={"x": "a"}, default_child=None, require_output_mapping=False),
            dict(tool_name="t", child_output_mapping={"x": "a"}, default_child=None, require_output_mapping=False),
        ),
    ],
)
def test_prompt_template_ignored(rule_factory, kwargs_a, kwargs_b):
    r1 = rule_factory(**kwargs_a, prompt_template="<tool_rule>A</tool_rule>")
    r2 = rule_factory(**kwargs_b, prompt_template="<tool_rule>B</tool_rule>")
    assert r1 == r2, f"{type(r1).__name__} should ignore prompt_template in equality"
    assert hash(r1) == hash(r2), f"{type(r1).__name__} should ignore prompt_template in hash"


@pytest.mark.parametrize(
    "a,b",
    [
        (InitToolRule(tool_name="same"), TerminalToolRule(tool_name="same")),
        (ContinueToolRule(tool_name="same"), RequiredBeforeExitToolRule(tool_name="same")),
        (ChildToolRule(tool_name="same", children=["x"]), ParentToolRule(tool_name="same", children=["x"])),
    ],
)
def test_cross_type_hash_distinguishes_types(a, b):
    assert a != b
    assert hash(a) != hash(b)


@pytest.mark.parametrize(
    "rule",
    [
        InitToolRule(tool_name="x"),
        TerminalToolRule(tool_name="x"),
        ContinueToolRule(tool_name="x"),
        RequiredBeforeExitToolRule(tool_name="x"),
        MaxCountPerStepToolRule(tool_name="x", max_count_limit=1),
        ChildToolRule(tool_name="x", children=["a"]),
        ParentToolRule(tool_name="x", children=["a"]),
        ConditionalToolRule(tool_name="x", child_output_mapping={"k": "a"}, default_child=None, require_output_mapping=False),
    ],
)
def test_equality_with_non_rule_objects(rule):
    assert rule != object()
    assert rule != None  # noqa: E711


def test_conditional_tool_rule_mapping_order_and_hash():
    r1 = ConditionalToolRule(
        tool_name="cond", child_output_mapping={"yes": "tool1", "no": "tool2"}, default_child="tool3", require_output_mapping=True
    )
    r2 = ConditionalToolRule(
        tool_name="cond", child_output_mapping={"no": "tool2", "yes": "tool1"}, default_child="tool3", require_output_mapping=True
    )
    assert r1 == r2
    assert hash(r1) == hash(r2)


def test_conditional_tool_rule_mapping_numeric_and_bool_keys_equivalence_current_behavior():
    # NOTE: Python dict equality treats True == 1 and 1 == 1.0 as equal keys.
    # This test documents current behavior of __eq__ on mapping equality.
    r_bool = ConditionalToolRule(tool_name="cond", child_output_mapping={True: "A"}, default_child=None, require_output_mapping=False)
    r_int = ConditionalToolRule(tool_name="cond", child_output_mapping={1: "A"}, default_child=None, require_output_mapping=False)
    r_float = ConditionalToolRule(tool_name="cond", child_output_mapping={1.0: "A"}, default_child=None, require_output_mapping=False)
    # Document current semantics: these are equal under Python's dict equality.
    assert r_bool == r_int
    assert r_int == r_float
    assert hash(r_bool) == hash(r_int) == hash(r_float)


def test_conditional_tool_rule_mapping_string_vs_numeric_not_equal():
    r_num = ConditionalToolRule(tool_name="cond", child_output_mapping={1: "A"}, default_child=None, require_output_mapping=False)
    r_str = ConditionalToolRule(tool_name="cond", child_output_mapping={"1": "A"}, default_child=None, require_output_mapping=False)
    assert r_num != r_str
    assert hash(r_num) != hash(r_str)


def test_child_and_parent_order_invariance_multiple_permutations():
    pass
    # permute a few ways
    variants = [
        ["a", "b", "c"],
        ["b", "c", "a"],
        ["c", "a", "b"],
    ]
    child_rules = [ChildToolRule(tool_name="t", children=ch) for ch in variants]
    parent_rules = [ParentToolRule(tool_name="t", children=ch) for ch in variants]

    # All child rules equal and same hash
    for r in child_rules[1:]:
        assert child_rules[0] == r
        assert hash(child_rules[0]) == hash(r)

    # All parent rules equal and same hash
    for r in parent_rules[1:]:
        assert parent_rules[0] == r
        assert hash(parent_rules[0]) == hash(r)


def test_conditional_order_invariance_multiple_permutations():
    maps = [
        {"x": "a", "y": "b", "z": "c"},
        {"z": "c", "y": "b", "x": "a"},
        {"y": "b", "x": "a", "z": "c"},
    ]
    rules = [ConditionalToolRule(tool_name="t", child_output_mapping=m, default_child=None, require_output_mapping=False) for m in maps]
    for r in rules[1:]:
        assert rules[0] == r
        assert hash(rules[0]) == hash(r)


# ---------- 7) Dict/dedup across all types including ContinueToolRule ----------


def test_dedup_in_set_with_continue_and_required_and_terminal():
    s = {
        ContinueToolRule(tool_name="x"),
        ContinueToolRule(tool_name="x"),  # dup
        RequiredBeforeExitToolRule(tool_name="y"),
        RequiredBeforeExitToolRule(tool_name="y"),  # dup
        TerminalToolRule(tool_name="z"),
        TerminalToolRule(tool_name="z"),  # dup
    }
    assert len(s) == 3


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

    assert solver.has_required_tools_been_called({REQUIRED_TOOL_1, REQUIRED_TOOL_2}) is False, (
        "Should return False when no required tools have been called"
    )
    uncalled_tools = solver.get_uncalled_required_tools({REQUIRED_TOOL_1, REQUIRED_TOOL_2})
    assert set(uncalled_tools) == {REQUIRED_TOOL_1, REQUIRED_TOOL_2}, "Should return both uncalled required tools"

    # Call first required tool
    solver.register_tool_call(REQUIRED_TOOL_1)

    assert solver.has_required_tools_been_called({REQUIRED_TOOL_1, REQUIRED_TOOL_2}) is False, (
        "Should return False when only one required tool has been called"
    )
    assert solver.get_uncalled_required_tools({REQUIRED_TOOL_1, REQUIRED_TOOL_2}) == [REQUIRED_TOOL_2], (
        "Should return remaining uncalled required tool"
    )

    # Call second required tool
    solver.register_tool_call(REQUIRED_TOOL_2)

    assert solver.has_required_tools_been_called({REQUIRED_TOOL_1, REQUIRED_TOOL_2}) is True, (
        "Should return True when all required tools have been called"
    )
    assert solver.get_uncalled_required_tools({REQUIRED_TOOL_1, REQUIRED_TOOL_2}) == [], (
        "Should return empty list when all required tools have been called"
    )


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


def test_should_force_tool_call_no_rules():
    """Test should_force_tool_call with no tool rules."""
    solver = ToolRulesSolver(tool_rules=[])
    assert solver.should_force_tool_call() is False, "Should return False when no tool rules are present"


def test_should_force_tool_call_init_rule_no_history():
    """Test should_force_tool_call with InitToolRule and no history."""
    init_rule = InitToolRule(tool_name=START_TOOL)
    solver = ToolRulesSolver(tool_rules=[init_rule])
    assert solver.should_force_tool_call() is True, "Should return True when InitToolRule is present and no history"


def test_should_force_tool_call_init_rule_after_first_call():
    """Test should_force_tool_call with InitToolRule after first tool call."""
    init_rule = InitToolRule(tool_name=START_TOOL)
    solver = ToolRulesSolver(tool_rules=[init_rule])

    solver.register_tool_call(START_TOOL)
    assert solver.should_force_tool_call() is False, "Should return False after first tool call"


def test_should_force_tool_call_child_rule_active():
    """Test should_force_tool_call when ChildToolRule is active."""
    child_rule = ChildToolRule(tool_name=START_TOOL, children=[NEXT_TOOL, HELPER_TOOL])
    solver = ToolRulesSolver(tool_rules=[child_rule])

    solver.register_tool_call(START_TOOL)
    assert solver.should_force_tool_call() is True, "Should return True when last tool matches ChildToolRule"


def test_should_force_tool_call_child_rule_inactive():
    """Test should_force_tool_call when ChildToolRule is not active."""
    child_rule = ChildToolRule(tool_name=START_TOOL, children=[NEXT_TOOL, HELPER_TOOL])
    solver = ToolRulesSolver(tool_rules=[child_rule])

    solver.register_tool_call(HELPER_TOOL)
    assert solver.should_force_tool_call() is False, "Should return False when last tool doesn't match ChildToolRule"


def test_should_force_tool_call_conditional_rule_active():
    """Test should_force_tool_call when ConditionalToolRule is active."""
    conditional_rule = ConditionalToolRule(
        tool_name=START_TOOL, child_output_mapping={True: END_TOOL, False: NEXT_TOOL}, default_child=None
    )
    solver = ToolRulesSolver(tool_rules=[conditional_rule])

    solver.register_tool_call(START_TOOL)
    assert solver.should_force_tool_call() is True, "Should return True when last tool matches ConditionalToolRule"


def test_should_force_tool_call_parent_rule_active():
    """Test should_force_tool_call when ParentToolRule is active."""
    parent_rule = ParentToolRule(tool_name=START_TOOL, children=[NEXT_TOOL, HELPER_TOOL])
    solver = ToolRulesSolver(tool_rules=[parent_rule])

    solver.register_tool_call(START_TOOL)
    assert solver.should_force_tool_call() is True, "Should return True when last tool matches ParentToolRule"


def test_should_force_tool_call_max_count_rule():
    """Test should_force_tool_call with MaxCountPerStepToolRule (non-constraining)."""
    max_count_rule = MaxCountPerStepToolRule(tool_name=START_TOOL, max_count_limit=2)
    solver = ToolRulesSolver(tool_rules=[max_count_rule])

    solver.register_tool_call(START_TOOL)
    assert solver.should_force_tool_call() is False, "Should return False for MaxCountPerStepToolRule (not a constraining rule)"


def test_should_force_tool_call_terminal_rule():
    """Test should_force_tool_call with TerminalToolRule."""
    terminal_rule = TerminalToolRule(tool_name=END_TOOL)
    solver = ToolRulesSolver(tool_rules=[terminal_rule])

    solver.register_tool_call(END_TOOL)
    assert solver.should_force_tool_call() is False, "Should return False for TerminalToolRule"


def test_should_force_tool_call_continue_rule():
    """Test should_force_tool_call with ContinueToolRule."""
    continue_rule = ContinueToolRule(tool_name=NEXT_TOOL)
    solver = ToolRulesSolver(tool_rules=[continue_rule])

    solver.register_tool_call(NEXT_TOOL)
    assert solver.should_force_tool_call() is False, "Should return False for ContinueToolRule"


def test_should_force_tool_call_required_before_exit_rule():
    """Test should_force_tool_call with RequiredBeforeExitToolRule."""
    required_rule = RequiredBeforeExitToolRule(tool_name=SAVE_TOOL)
    solver = ToolRulesSolver(tool_rules=[required_rule])

    solver.register_tool_call(SAVE_TOOL)
    assert solver.should_force_tool_call() is False, "Should return False for RequiredBeforeExitToolRule"


def test_should_force_tool_call_requires_approval_rule():
    """Test should_force_tool_call with RequiresApprovalToolRule."""
    approval_rule = RequiresApprovalToolRule(tool_name=REQUIRES_APPROVAL_TOOL)
    solver = ToolRulesSolver(tool_rules=[approval_rule])

    solver.register_tool_call(REQUIRES_APPROVAL_TOOL)
    assert solver.should_force_tool_call() is False, "Should return False for RequiresApprovalToolRule"


def test_should_force_tool_call_multiple_constrained_rules_one_active():
    """Test should_force_tool_call with multiple constrained rules where one is active."""
    child_rule_1 = ChildToolRule(tool_name=START_TOOL, children=[NEXT_TOOL])
    child_rule_2 = ChildToolRule(tool_name=NEXT_TOOL, children=[FINAL_TOOL])
    parent_rule = ParentToolRule(tool_name=PREP_TOOL, children=[HELPER_TOOL])
    solver = ToolRulesSolver(tool_rules=[child_rule_1, child_rule_2, parent_rule])

    solver.register_tool_call(START_TOOL)
    assert solver.should_force_tool_call() is True, "Should return True when one constrained rule is active"

    solver.register_tool_call(NEXT_TOOL)
    assert solver.should_force_tool_call() is True, "Should return True when a different constrained rule becomes active"

    solver.register_tool_call(FINAL_TOOL)
    assert solver.should_force_tool_call() is False, "Should return False when no constrained rules are active"


def test_should_force_tool_call_after_clear_with_init_rule():
    """Test should_force_tool_call after clearing history with InitToolRule."""
    init_rule = InitToolRule(tool_name=START_TOOL)
    child_rule = ChildToolRule(tool_name=START_TOOL, children=[NEXT_TOOL])
    solver = ToolRulesSolver(tool_rules=[init_rule, child_rule])

    assert solver.should_force_tool_call() is True, "Should return True initially with InitToolRule"

    solver.register_tool_call(START_TOOL)
    assert solver.should_force_tool_call() is True, "Should return True when ChildToolRule is active"

    solver.clear_tool_history()
    assert solver.should_force_tool_call() is True, "Should return True again after clearing history with InitToolRule"


def test_should_force_tool_call_mixed_rules():
    """Test should_force_tool_call with a mix of constraining and non-constraining rules."""
    init_rule = InitToolRule(tool_name=START_TOOL)
    child_rule = ChildToolRule(tool_name=START_TOOL, children=[NEXT_TOOL])
    terminal_rule = TerminalToolRule(tool_name=END_TOOL)
    continue_rule = ContinueToolRule(tool_name=HELPER_TOOL)
    max_count_rule = MaxCountPerStepToolRule(tool_name=NEXT_TOOL, max_count_limit=2)
    solver = ToolRulesSolver(tool_rules=[init_rule, child_rule, terminal_rule, continue_rule, max_count_rule])

    assert solver.should_force_tool_call() is True, "Should return True with InitToolRule at start"

    solver.register_tool_call(START_TOOL)
    assert solver.should_force_tool_call() is True, "Should return True when ChildToolRule is active"

    solver.register_tool_call(NEXT_TOOL)
    assert solver.should_force_tool_call() is False, "Should return False when no constraining rules are active"


def make_tool(name: str, properties: dict) -> Tool:
    """Helper to build a minimal custom Tool with a JSON schema."""
    return Tool(
        name=name,
        tool_type=ToolType.CUSTOM,
        json_schema={
            "name": name,
            "parameters": {
                "type": "object",
                "properties": properties,
                "required": [],
                "additionalProperties": False,
            },
        },
    )


def test_init_rule_args_are_cached_in_solver():
    solver = ToolRulesSolver(tool_rules=[InitToolRule(tool_name="alpha", args={"x": 1, "y": "s"})])
    allowed = solver.get_allowed_tool_names(available_tools={"alpha", "beta"})

    assert set(allowed) == {"alpha"}
    # Cached mappings
    assert solver.last_prefilled_args_by_tool == {"alpha": {"x": 1, "y": "s"}}
    assert solver.last_prefilled_args_provenance.get("alpha") == "InitToolRule(alpha)"


def test_cached_provenance_format():
    solver = ToolRulesSolver(tool_rules=[InitToolRule(tool_name="tool_one", args={"a": 123})])
    _ = solver.get_allowed_tool_names(available_tools={"tool_one"})
    prov = solver.last_prefilled_args_provenance.get("tool_one")
    assert prov.startswith("InitToolRule(") and prov.endswith(")") and "tool_one" in prov


def test_cache_empty_when_no_args():
    solver = ToolRulesSolver(tool_rules=[InitToolRule(tool_name="alpha")])
    allowed = solver.get_allowed_tool_names(available_tools={"alpha", "beta"})

    assert set(allowed) == {"alpha"}
    assert solver.last_prefilled_args_by_tool == {}
    assert solver.last_prefilled_args_provenance == {}


def test_cache_recomputed_on_next_call():
    # First call caches args for init tool
    solver = ToolRulesSolver(tool_rules=[InitToolRule(tool_name="alpha", args={"p": 5})])
    _ = solver.get_allowed_tool_names(available_tools={"alpha", "beta"})
    assert solver.last_prefilled_args_by_tool == {"alpha": {"p": 5}}

    # After a tool call, init rules no longer apply; next computation should clear caches
    solver.register_tool_call("alpha")
    _ = solver.get_allowed_tool_names(available_tools={"alpha", "beta"})
    assert solver.last_prefilled_args_by_tool == {}
    assert solver.last_prefilled_args_provenance == {}


def test_merge_and_validate_prefilled_args_overrides_llm_values():
    tool = make_tool("my_tool", properties={"a": {"type": "integer"}, "b": {"type": "string"}})
    llm_args = {"a": 1, "b": "hello"}
    prefilled = {"a": 42}

    merged = merge_and_validate_prefilled_args(tool, llm_args, prefilled)
    assert merged == {"a": 42, "b": "hello"}


def test_merge_and_validate_prefilled_args_type_validation():
    tool = make_tool("typed_tool", properties={"a": {"type": "integer"}})
    llm_args = {"a": 1}
    prefilled = {"a": "not-an-int"}

    with pytest.raises(ValueError) as ei:
        _ = merge_and_validate_prefilled_args(tool, llm_args, prefilled)
    assert "Invalid value for 'a'" in str(ei.value)
    assert "integer" in str(ei.value)


def test_merge_and_validate_prefilled_args_unknown_key_fails():
    tool = make_tool("limited_tool", properties={"a": {"type": "integer"}})
    with pytest.raises(ValueError) as ei:
        _ = merge_and_validate_prefilled_args(tool, llm_args={}, prefilled_args={"z": 3})
    assert "Unknown argument 'z'" in str(ei.value)


def test_merge_and_validate_prefilled_args_enum_const_anyof_oneof():
    tool = make_tool(
        "rich_tool",
        properties={
            "c": {"enum": ["x", "y"]},
            "d": {"const": 5},
            "e": {"anyOf": [{"type": "string"}, {"type": "integer"}]},
            "f": {"oneOf": [{"type": "string"}, {"type": "integer"}]},
            "g": {"type": "number"},
        },
    )

    # Valid cases
    merged = merge_and_validate_prefilled_args(tool, {}, {"c": "x"})
    assert merged["c"] == "x"

    merged = merge_and_validate_prefilled_args(tool, {}, {"d": 5})
    assert merged["d"] == 5

    merged = merge_and_validate_prefilled_args(tool, {}, {"e": 7})
    assert merged["e"] == 7

    merged = merge_and_validate_prefilled_args(tool, {}, {"f": "hello"})
    assert merged["f"] == "hello"

    merged = merge_and_validate_prefilled_args(tool, {}, {"g": 3.14})
    assert merged["g"] == 3.14

    merged = merge_and_validate_prefilled_args(tool, {}, {"g": 3})
    assert merged["g"] == 3

    # Invalid cases
    with pytest.raises(ValueError):
        _ = merge_and_validate_prefilled_args(tool, {}, {"c": "z"})  # enum fail

    with pytest.raises(ValueError):
        _ = merge_and_validate_prefilled_args(tool, {}, {"d": 6})  # const fail

    with pytest.raises(ValueError):
        _ = merge_and_validate_prefilled_args(tool, {}, {"e": []})  # anyOf none match

    with pytest.raises(ValueError):
        _ = merge_and_validate_prefilled_args(tool, {}, {"f": []})  # oneOf none match

    with pytest.raises(ValueError):
        _ = merge_and_validate_prefilled_args(tool, {}, {"g": True})  # bool not a number


def test_merge_and_validate_prefilled_args_union_with_null():
    tool = make_tool("union_tool", properties={"h": {"type": ["string", "null"]}})

    merged = merge_and_validate_prefilled_args(tool, {}, {"h": None})
    assert "h" in merged and merged["h"] is None

    merged = merge_and_validate_prefilled_args(tool, {}, {"h": "ok"})
    assert merged["h"] == "ok"

    with pytest.raises(ValueError):
        _ = merge_and_validate_prefilled_args(tool, {}, {"h": 5})


def test_merge_and_validate_prefilled_args_object_and_array_types():
    tool = make_tool(
        "container_tool",
        properties={
            "obj": {"type": "object"},
            "arr": {"type": "array"},
        },
    )

    merged = merge_and_validate_prefilled_args(tool, {}, {"obj": {"k": 1}})
    assert merged["obj"] == {"k": 1}

    merged = merge_and_validate_prefilled_args(tool, {}, {"arr": [1, 2, 3]})
    assert merged["arr"] == [1, 2, 3]

    with pytest.raises(ValueError):
        _ = merge_and_validate_prefilled_args(tool, {}, {"obj": "nope"})
    with pytest.raises(ValueError):
        _ = merge_and_validate_prefilled_args(tool, {}, {"arr": {}})


def test_multiple_rules_args_last_write_wins_and_provenance():
    # Two init rules for the same tool; the latter should overwrite overlapping keys and provenance
    r1 = InitToolRule(tool_name="alpha", args={"x": 1, "y": "first"})
    r2 = InitToolRule(tool_name="alpha", args={"y": "second", "z": True})
    solver = ToolRulesSolver(tool_rules=[r1, r2])

    allowed = solver.get_allowed_tool_names(available_tools={"alpha", "beta"})
    assert set(allowed) == {"alpha"}

    assert solver.last_prefilled_args_by_tool["alpha"] == {"x": 1, "y": "second", "z": True}
    assert solver.last_prefilled_args_provenance.get("alpha") == "InitToolRule(alpha)"


def test_child_rule_args_cached_only_when_parent_last_tool():
    # Child with args and one without
    rule = ChildToolRule(
        tool_name="parent",
        children=["child_a", "child_b"],
        child_arg_nodes=[ToolCallNode(name="child_a", args={"x": 1})],
    )
    solver = ToolRulesSolver(tool_rules=[rule])

    # Before parent call, child args should not be cached
    allowed = solver.get_allowed_tool_names(available_tools={"parent", "child_a", "child_b"})
    assert set(allowed) == {"parent", "child_a", "child_b"}
    assert solver.last_prefilled_args_by_tool == {}

    # After parent is last tool, cache should include child_a's args
    solver.register_tool_call("parent")
    allowed = solver.get_allowed_tool_names(available_tools={"parent", "child_a", "child_b"})
    assert set(allowed) == {"child_a", "child_b"}
    assert solver.last_prefilled_args_by_tool.get("child_a") == {"x": 1}
    assert solver.last_prefilled_args_provenance.get("child_a") == "ChildToolRule(parent->child_a)"


def test_init_then_child_args_applied_in_correct_phases():
    # Init provides args for alpha; child provides args for beta
    init = InitToolRule(tool_name="alpha", args={"seed": "A"})
    child = ChildToolRule(
        tool_name="alpha",
        children=["beta"],
        child_arg_nodes=[ToolCallNode(name="beta", args={"k": 1})],
    )
    solver = ToolRulesSolver(tool_rules=[init, child])

    # Phase 1: start — init args apply
    allowed = solver.get_allowed_tool_names(available_tools={"alpha", "beta"})
    assert set(allowed) == {"alpha"}
    assert solver.last_prefilled_args_by_tool == {"alpha": {"seed": "A"}}

    # Phase 2: after alpha executed — child args apply
    solver.register_tool_call("alpha")
    allowed = solver.get_allowed_tool_names(available_tools={"alpha", "beta"})
    assert set(allowed) == {"beta"}
    assert solver.last_prefilled_args_by_tool == {"beta": {"k": 1}}


def test_multi_child_rules_last_write_wins_for_same_child():
    # Two ChildToolRules for the same parent/child; second overrides overlapping keys
    child1 = ChildToolRule(
        tool_name="p",
        children=["c"],
        child_arg_nodes=[ToolCallNode(name="c", args={"x": 1, "y": "a"})],
    )
    child2 = ChildToolRule(
        tool_name="p",
        children=["c"],
        child_arg_nodes=[ToolCallNode(name="c", args={"y": "b", "z": 3})],
    )
    solver = ToolRulesSolver(tool_rules=[child1, child2])

    solver.register_tool_call("p")
    allowed = solver.get_allowed_tool_names(available_tools={"p", "c"})
    assert set(allowed) == {"c"}
    assert solver.last_prefilled_args_by_tool["c"] == {"x": 1, "y": "b", "z": 3}
    # Provenance reflects the last write source
    assert solver.last_prefilled_args_provenance.get("c") == "ChildToolRule(p->c)"


def test_child_args_only_for_allowed_children():
    # Provide args for two children, but restrict available_tools to one child
    rule = ChildToolRule(
        tool_name="p",
        children=["allowed", "blocked"],
        child_arg_nodes=[
            ToolCallNode(name="allowed", args={"a": 1}),
            ToolCallNode(name="blocked", args={"b": 2}),
        ],
    )
    solver = ToolRulesSolver(tool_rules=[rule])
    solver.register_tool_call("p")

    allowed = solver.get_allowed_tool_names(available_tools={"allowed"})
    assert set(allowed) == {"allowed"}
    assert solver.last_prefilled_args_by_tool == {"allowed": {"a": 1}}
    assert "blocked" not in solver.last_prefilled_args_by_tool


def test_child_args_intersection_with_conditional_mapping():
    # Child list has args for both, ConditionalToolRule limits to one based on output
    child = ChildToolRule(
        tool_name="decider",
        children=["c1", "c2"],
        child_arg_nodes=[ToolCallNode(name="c1", args={"x": 10}), ToolCallNode(name="c2", args={"y": 20})],
    )
    cond = ConditionalToolRule(
        tool_name="decider",
        default_child=None,
        child_output_mapping={True: "c2", False: "c1"},
        require_output_mapping=True,
    )
    solver = ToolRulesSolver(tool_rules=[child, cond])
    solver.register_tool_call("decider")

    allowed = solver.get_allowed_tool_names(available_tools={"c1", "c2"}, last_function_response='{"message": "true"}')
    assert set(allowed) == {"c2"}
    assert solver.last_prefilled_args_by_tool == {"c2": {"y": 20}}


def test_child_rule_prefilled_complex_args_validation_success():
    # Define complex child args with multiple JSON schema types
    complex_args = {
        "obj": {"k": 1, "nest": {"a": 2}},
        "arr": [1, 2, 3],
        "union": None,  # string | null
        "any": "text",  # anyOf string|integer
        "one": 42,  # oneOf string|integer
        "num": 3.5,
        "flag": True,
        "str": "hello",
    }

    rule = ChildToolRule(
        tool_name="p",
        children=["complex_child"],
        child_arg_nodes=[ToolCallNode(name="complex_child", args=complex_args)],
    )
    solver = ToolRulesSolver(tool_rules=[rule])
    solver.register_tool_call("p")

    allowed = solver.get_allowed_tool_names(available_tools={"complex_child"})
    assert set(allowed) == {"complex_child"}
    assert solver.last_prefilled_args_by_tool.get("complex_child") == complex_args

    # Validate and merge against a tool schema with matching types
    properties = {
        "obj": {"type": "object"},
        "arr": {"type": "array"},
        "union": {"type": ["string", "null"]},
        "any": {"anyOf": [{"type": "string"}, {"type": "integer"}]},
        "one": {"oneOf": [{"type": "string"}, {"type": "integer"}]},
        "num": {"type": "number"},
        "flag": {"type": "boolean"},
        "str": {"type": "string"},
    }
    tool = make_tool("complex_child", properties)
    # LLM suggests competing values; prefilled should override
    llm_args = {"str": "fake", "num": 7, "extra": "ignored"}
    merged = merge_and_validate_prefilled_args(tool, llm_args, complex_args)
    for k, v in complex_args.items():
        assert merged[k] == v
    assert merged.get("extra") == "ignored"  # untouched by prefill validation


def test_child_rule_prefilled_complex_args_validation_fail():
    # Provide intentionally bad types for several keys
    bad_args = {
        "obj": "not-an-object",  # should be object
        "arr": {"not": "an array"},  # should be array
        "union": 5,  # should be string|null
        "any": [],  # anyOf string|integer
        "one": [],  # oneOf string|integer
        "num": True,  # bool is not accepted as number
        "flag": "yes",  # should be boolean
        "str": 123,  # should be string
    }

    rule = ChildToolRule(
        tool_name="p",
        children=["complex_child"],
        child_arg_nodes=[ToolCallNode(name="complex_child", args=bad_args)],
    )
    solver = ToolRulesSolver(tool_rules=[rule])
    solver.register_tool_call("p")
    _ = solver.get_allowed_tool_names(available_tools={"complex_child"})
    assert solver.last_prefilled_args_by_tool.get("complex_child") == bad_args

    properties = {
        "obj": {"type": "object"},
        "arr": {"type": "array"},
        "union": {"type": ["string", "null"]},
        "any": {"anyOf": [{"type": "string"}, {"type": "integer"}]},
        "one": {"oneOf": [{"type": "string"}, {"type": "integer"}]},
        "num": {"type": "number"},
        "flag": {"type": "boolean"},
        "str": {"type": "string"},
    }
    tool = make_tool("complex_child", properties)

    with pytest.raises(ValueError) as ei:
        _ = merge_and_validate_prefilled_args(tool, llm_args={}, prefilled_args=bad_args)
    msg = str(ei.value)
    # Spot-check a few failures
    assert "Unknown argument" not in msg  # keys exist
    assert "Invalid value" in msg


def test_child_tool_rule_validation_unknown_child_in_arg_nodes():
    """ChildToolRule should reject child_arg_nodes that reference names not in children."""
    with pytest.raises(ValueError) as ei:
        _ = ChildToolRule(
            tool_name="parent",
            children=["known_child"],
            child_arg_nodes=[ToolCallNode(name="unknown_child", args={"x": 1})],
        )
    assert "not in children" in str(ei.value)


def test_child_tool_rule_validation_args_type_enforced():
    """ToolCallNode.args must be a dict when present; otherwise Pydantic should raise."""
    with pytest.raises(Exception) as ei:
        _ = ChildToolRule(
            tool_name="p",
            children=["c1"],
            child_arg_nodes=[ToolCallNode(name="c1", args="not-a-dict")],  # type: ignore[arg-type]
        )
    # Pydantic should raise a validation error about args type
    assert "dict" in str(ei.value) or "dictionary" in str(ei.value)


def test_child_tool_rule_validation_accepts_valid_nodes():
    """A valid ChildToolRule with matching child and typed arg node should construct cleanly."""
    rule = ChildToolRule(
        tool_name="p",
        children=["c1", "c2"],
        child_arg_nodes=[ToolCallNode(name="c2", args={"k": 1})],
    )
    assert isinstance(rule, ChildToolRule)
