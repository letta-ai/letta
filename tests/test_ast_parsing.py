import pytest

from letta.functions.ast_parsers import coerce_dict_args_by_annotations, get_function_annotations_from_source

# -----------------------------------------------------------------------
# Example source code for testing multiple scenarios, including:
#  1) A class-based custom type (which we won't handle properly).
#  2) Functions with multiple argument types.
#  3) A function with default arguments.
#  4) A function with no arguments.
#  5) A function that shares the same name as another symbol.
# -----------------------------------------------------------------------
example_source_code = r"""
class CustomClass:
    def __init__(self, x):
        self.x = x

def unrelated_symbol():
    pass

def no_args_func():
    pass

def default_args_func(x: int = 5, y: str = "hello"):
    return x, y

def my_function(a: int, b: float, c: str, d: list, e: dict, f: CustomClass = None):
    pass

def my_function_duplicate():
    # This function shares the name "my_function" partially, but isn't an exact match
    pass
"""


# --------------------- get_function_annotations_from_source TESTS --------------------- #


def test_get_function_annotations_found():
    """
    Test that we correctly parse annotations for a function
    that includes multiple argument types and a custom class.
    """
    annotations = get_function_annotations_from_source(example_source_code, "my_function")
    assert annotations == {
        "a": "int",
        "b": "float",
        "c": "str",
        "d": "list",
        "e": "dict",
        "f": "CustomClass",
    }


def test_get_function_annotations_not_found():
    """
    If the requested function name doesn't exist exactly,
    we should raise a ValueError.
    """
    with pytest.raises(ValueError, match="Function 'missing_function' not found"):
        get_function_annotations_from_source(example_source_code, "missing_function")


def test_get_function_annotations_no_args():
    """
    Check that a function without arguments returns an empty annotations dict.
    """
    annotations = get_function_annotations_from_source(example_source_code, "no_args_func")
    assert annotations == {}


def test_get_function_annotations_with_default_values():
    """
    Ensure that a function with default arguments still captures the annotations.
    """
    annotations = get_function_annotations_from_source(example_source_code, "default_args_func")
    assert annotations == {"x": "int", "y": "str"}


def test_get_function_annotations_partial_name_collision():
    """
    Ensure we only match the exact function name, not partial collisions.
    """
    # This will match 'my_function' exactly, ignoring 'my_function_duplicate'
    annotations = get_function_annotations_from_source(example_source_code, "my_function")
    assert "a" in annotations  # Means it matched the correct function
    # No error expected here, just making sure we didn't accidentally parse "my_function_duplicate".


# --------------------- coerce_dict_args_by_annotations TESTS --------------------- #


def test_coerce_dict_args_success():
    """
    Basic success scenario with standard types:
      int, float, str, list, dict.
    """
    annotations = {"a": "int", "b": "float", "c": "str", "d": "list", "e": "dict"}
    function_args = {"a": "42", "b": "3.14", "c": 123, "d": "[1, 2, 3]", "e": '{"key": "value"}'}

    coerced_args = coerce_dict_args_by_annotations(function_args, annotations)
    assert coerced_args["a"] == 42
    assert coerced_args["b"] == 3.14
    assert coerced_args["c"] == "123"
    assert coerced_args["d"] == [1, 2, 3]
    assert coerced_args["e"] == {"key": "value"}


def test_coerce_dict_args_invalid_type():
    """
    If the value cannot be coerced into the annotation,
    a ValueError should be raised.
    """
    annotations = {"a": "int"}
    function_args = {"a": "invalid_int"}

    with pytest.raises(ValueError, match="Failed to coerce argument 'a' to int"):
        coerce_dict_args_by_annotations(function_args, annotations)


def test_coerce_dict_args_no_annotations():
    """
    If there are no annotations, we do no coercion.
    """
    annotations = {}
    function_args = {"a": 42, "b": "hello"}
    coerced_args = coerce_dict_args_by_annotations(function_args, annotations)
    assert coerced_args == function_args  # Exactly the same dict back


def test_coerce_dict_args_partial_annotations():
    """
    Only coerce annotated arguments; leave unannotated ones unchanged.
    """
    annotations = {"a": "int"}
    function_args = {"a": "42", "b": "no_annotation"}
    coerced_args = coerce_dict_args_by_annotations(function_args, annotations)
    assert coerced_args["a"] == 42
    assert coerced_args["b"] == "no_annotation"


def test_coerce_dict_args_with_missing_args():
    """
    If function_args lacks some keys listed in annotations,
    those are simply not coerced. (We do not add them.)
    """
    annotations = {"a": "int", "b": "float"}
    function_args = {"a": "42"}  # Missing 'b'
    coerced_args = coerce_dict_args_by_annotations(function_args, annotations)
    assert coerced_args["a"] == 42
    assert "b" not in coerced_args


def test_coerce_dict_args_unexpected_keys():
    """
    If function_args has extra keys not in annotations,
    we leave them alone.
    """
    annotations = {"a": "int"}
    function_args = {"a": "42", "z": 999}
    coerced_args = coerce_dict_args_by_annotations(function_args, annotations)
    assert coerced_args["a"] == 42
    assert coerced_args["z"] == 999  # unchanged


def test_coerce_dict_args_unsupported_custom_class():
    """
    If someone tries to pass an annotation that isn't supported (like a custom class),
    we should raise a ValueError (or similarly handle the error) rather than silently
    accept it.
    """
    annotations = {"f": "CustomClass"}  # We can't resolve this
    function_args = {"f": {"x": 1}}
    with pytest.raises(ValueError, match="Failed to coerce argument 'f' to CustomClass: Unsupported annotation: CustomClass"):
        coerce_dict_args_by_annotations(function_args, annotations)


def test_coerce_dict_args_with_complex_types():
    """
    Confirm the ability to parse built-in complex data (lists, dicts, etc.)
    when given as strings.
    """
    annotations = {"big_list": "list", "nested_dict": "dict"}
    function_args = {"big_list": "[1, 2, [3, 4], {'five': 5}]", "nested_dict": '{"alpha": [10, 20], "beta": {"x": 1, "y": 2}}'}

    coerced_args = coerce_dict_args_by_annotations(function_args, annotations)
    assert coerced_args["big_list"] == [1, 2, [3, 4], {"five": 5}]
    assert coerced_args["nested_dict"] == {
        "alpha": [10, 20],
        "beta": {"x": 1, "y": 2},
    }


def test_coerce_dict_args_non_string_keys():
    """
    Validate behavior if `function_args` includes non-string keys.
    (We should simply skip annotation checks for them.)
    """
    annotations = {"a": "int"}
    function_args = {123: "42", "a": "42"}
    coerced_args = coerce_dict_args_by_annotations(function_args, annotations)
    # 'a' is coerced to int
    assert coerced_args["a"] == 42
    # 123 remains untouched
    assert coerced_args[123] == "42"


def test_coerce_dict_args_non_parseable_list_or_dict():
    """
    Test passing incorrectly formatted JSON for a 'list' or 'dict' annotation.
    """
    annotations = {"bad_list": "list", "bad_dict": "dict"}
    function_args = {"bad_list": "[1, 2, 3", "bad_dict": '{"key": "value"'}  # missing brackets

    with pytest.raises(ValueError, match="Failed to coerce argument 'bad_list' to list"):
        coerce_dict_args_by_annotations(function_args, annotations)


def test_coerce_dict_args_with_complex_list_annotation():
    """
    Test coercion when list with type annotation (e.g., list[int]) is used.
    """
    annotations = {"a": "list[int]"}
    function_args = {"a": "[1, 2, 3]"}

    coerced_args = coerce_dict_args_by_annotations(function_args, annotations)
    assert coerced_args["a"] == [1, 2, 3]


def test_coerce_dict_args_with_complex_dict_annotation():
    """
    Test coercion when dict with type annotation (e.g., dict[str, int]) is used.
    """
    annotations = {"a": "dict[str, int]"}
    function_args = {"a": '{"x": 1, "y": 2}'}

    coerced_args = coerce_dict_args_by_annotations(function_args, annotations)
    assert coerced_args["a"] == {"x": 1, "y": 2}


def test_coerce_dict_args_unsupported_complex_annotation():
    """
    If an unsupported complex annotation is used (e.g., a custom class),
    a ValueError should be raised.
    """
    annotations = {"f": "CustomClass[int]"}
    function_args = {"f": "CustomClass(42)"}

    with pytest.raises(ValueError, match="Failed to coerce argument 'f' to CustomClass\[int\]: Unsupported annotation: CustomClass\[int\]"):
        coerce_dict_args_by_annotations(function_args, annotations)


def test_coerce_dict_args_with_nested_complex_annotation():
    """
    Test coercion with complex nested types like list[dict[str, int]].
    """
    annotations = {"a": "list[dict[str, int]]"}
    function_args = {"a": '[{"x": 1}, {"y": 2}]'}

    coerced_args = coerce_dict_args_by_annotations(function_args, annotations)
    assert coerced_args["a"] == [{"x": 1}, {"y": 2}]


def test_coerce_dict_args_with_default_arguments():
    """
    Test coercion with default arguments, where some arguments have defaults in the source code.
    """
    annotations = {"a": "int", "b": "str"}
    function_args = {"a": "42"}

    function_args.setdefault("b", "hello")  # Setting the default value for 'b'

    coerced_args = coerce_dict_args_by_annotations(function_args, annotations)
    assert coerced_args["a"] == 42
    assert coerced_args["b"] == "hello"
