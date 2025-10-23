import pytest

from letta.constants import MAX_FILENAME_LENGTH
from letta.functions.ast_parsers import coerce_dict_args_by_annotations, get_function_annotations_from_source
from letta.schemas.file import FileMetadata
from letta.server.rest_api.dependencies import HeaderParams
from letta.services.file_processor.chunker.line_chunker import LineChunker
from letta.services.helpers.agent_manager_helper import safe_format
from letta.utils import is_1_0_sdk_version, sanitize_filename, validate_function_response

CORE_MEMORY_VAR = "My core memory is that I like to eat bananas"
VARS_DICT = {"CORE_MEMORY": CORE_MEMORY_VAR}

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

    with pytest.raises(
        ValueError, match=r"Failed to coerce argument 'f' to CustomClass\[int\]: Unsupported annotation: CustomClass\[int\]"
    ):
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


def test_valid_filename():
    filename = "valid_filename.txt"
    sanitized = sanitize_filename(filename, add_uuid_suffix=True)
    assert sanitized.startswith("valid_filename_")
    assert sanitized.endswith(".txt")


def test_filename_with_special_characters():
    filename = "invalid:/<>?*ƒfilename.txt"
    sanitized = sanitize_filename(filename, add_uuid_suffix=True)
    assert sanitized.startswith("ƒfilename_")
    assert sanitized.endswith(".txt")


def test_null_byte_in_filename():
    filename = "valid\0filename.txt"
    sanitized = sanitize_filename(filename, add_uuid_suffix=True)
    assert "\0" not in sanitized
    assert sanitized.startswith("validfilename_")
    assert sanitized.endswith(".txt")


def test_path_traversal_characters():
    filename = "../../etc/passwd"
    sanitized = sanitize_filename(filename, add_uuid_suffix=True)
    assert sanitized.startswith("passwd_")
    assert len(sanitized) <= MAX_FILENAME_LENGTH


def test_empty_filename():
    sanitized = sanitize_filename("", add_uuid_suffix=True)
    assert sanitized.startswith("_")


def test_dot_as_filename():
    with pytest.raises(ValueError, match="Invalid filename"):
        sanitize_filename(".")


def test_dotdot_as_filename():
    with pytest.raises(ValueError, match="Invalid filename"):
        sanitize_filename("..")


def test_long_filename():
    filename = "a" * (MAX_FILENAME_LENGTH + 10) + ".txt"
    sanitized = sanitize_filename(filename, add_uuid_suffix=True)
    assert len(sanitized) <= MAX_FILENAME_LENGTH
    assert sanitized.endswith(".txt")


def test_unique_filenames():
    filename = "duplicate.txt"
    sanitized1 = sanitize_filename(filename, add_uuid_suffix=True)
    sanitized2 = sanitize_filename(filename, add_uuid_suffix=True)
    assert sanitized1 != sanitized2
    assert sanitized1.startswith("duplicate_")
    assert sanitized2.startswith("duplicate_")
    assert sanitized1.endswith(".txt")
    assert sanitized2.endswith(".txt")


def test_basic_sanitization_no_suffix():
    """Test the new behavior - basic sanitization without UUID suffix"""
    filename = "test_file.txt"
    sanitized = sanitize_filename(filename)
    assert sanitized == "test_file.txt"

    # Test with special characters
    filename_with_chars = "test:/<>?*file.txt"
    sanitized_chars = sanitize_filename(filename_with_chars)
    assert sanitized_chars == "file.txt"


def test_formatter():
    # Example system prompt that has no vars
    NO_VARS = """
    THIS IS A SYSTEM PROMPT WITH NO VARS
    """

    assert safe_format(NO_VARS, VARS_DICT) == NO_VARS

    # Example system prompt that has {CORE_MEMORY}
    CORE_MEMORY_VAR = """
    THIS IS A SYSTEM PROMPT WITH NO VARS
    {CORE_MEMORY}
    """

    CORE_MEMORY_VAR_SOL = """
    THIS IS A SYSTEM PROMPT WITH NO VARS
    My core memory is that I like to eat bananas
    """

    assert safe_format(CORE_MEMORY_VAR, VARS_DICT) == CORE_MEMORY_VAR_SOL

    # Example system prompt that has {CORE_MEMORY} and {USER_MEMORY} (latter doesn't exist)
    UNUSED_VAR = """
    THIS IS A SYSTEM PROMPT WITH NO VARS
    {USER_MEMORY}
    {CORE_MEMORY}
    """

    UNUSED_VAR_SOL = """
    THIS IS A SYSTEM PROMPT WITH NO VARS
    {USER_MEMORY}
    My core memory is that I like to eat bananas
    """

    assert safe_format(UNUSED_VAR, VARS_DICT) == UNUSED_VAR_SOL

    # Example system prompt that has {CORE_MEMORY} and {USER_MEMORY} (latter doesn't exist), AND an empty {}
    UNUSED_AND_EMPRY_VAR = """
    THIS IS A SYSTEM PROMPT WITH NO VARS
    {}
    {USER_MEMORY}
    {CORE_MEMORY}
    """

    UNUSED_AND_EMPRY_VAR_SOL = """
    THIS IS A SYSTEM PROMPT WITH NO VARS
    {}
    {USER_MEMORY}
    My core memory is that I like to eat bananas
    """

    assert safe_format(UNUSED_AND_EMPRY_VAR, VARS_DICT) == UNUSED_AND_EMPRY_VAR_SOL


# ---------------------- LineChunker TESTS ---------------------- #


def test_line_chunker_valid_range():
    """Test that LineChunker works correctly with valid ranges"""
    file = FileMetadata(file_name="test.py", source_id="test_source", content="line1\nline2\nline3\nline4")
    chunker = LineChunker()

    # Test valid range with validation
    result = chunker.chunk_text(file, start=1, end=3, validate_range=True)
    # Should return lines 2 and 3 (0-indexed 1:3)
    assert "[Viewing lines 2 to 3 (out of 4 lines)]" in result[0]
    assert "2: line2" in result[1]
    assert "3: line3" in result[2]


def test_line_chunker_valid_range_no_validation():
    """Test that LineChunker works the same without validation for valid ranges"""
    file = FileMetadata(file_name="test.py", source_id="test_source", content="line1\nline2\nline3\nline4")
    chunker = LineChunker()

    # Test same range without validation
    result = chunker.chunk_text(file, start=1, end=3, validate_range=False)
    assert "[Viewing lines 2 to 3 (out of 4 lines)]" in result[0]
    assert "2: line2" in result[1]
    assert "3: line3" in result[2]


def test_line_chunker_out_of_range_start():
    """Test that LineChunker throws error when start is out of range"""
    file = FileMetadata(file_name="test.py", source_id="test_source", content="line1\nline2\nline3")
    chunker = LineChunker()

    # Test with start beyond file length - should raise ValueError
    with pytest.raises(ValueError, match="File test.py has only 3 lines, but requested offset 6 is out of range"):
        chunker.chunk_text(file, start=5, end=6, validate_range=True)


def test_line_chunker_out_of_range_end():
    """Test that LineChunker clamps end when it extends beyond file bounds"""
    file = FileMetadata(file_name="test.py", source_id="test_source", content="line1\nline2\nline3")
    chunker = LineChunker()

    # Test with end beyond file length (3 lines, requesting 1 to 10)
    # Should clamp end to file length and return lines 1-3
    result = chunker.chunk_text(file, start=0, end=10, validate_range=True)
    assert len(result) == 4  # metadata header + 3 lines
    assert "[Viewing lines 1 to 3 (out of 3 lines)]" in result[0]
    assert "1: line1" in result[1]
    assert "2: line2" in result[2]
    assert "3: line3" in result[3]


def test_line_chunker_edge_case_empty_file():
    """Test that LineChunker handles empty files correctly"""
    file = FileMetadata(file_name="empty.py", source_id="test_source", content="")
    chunker = LineChunker()

    # no error
    chunker.chunk_text(file, start=0, end=1, validate_range=True)


def test_line_chunker_edge_case_single_line():
    """Test that LineChunker handles single line files correctly"""
    file = FileMetadata(file_name="single.py", source_id="test_source", content="only line")
    chunker = LineChunker()

    # Test valid single line access
    result = chunker.chunk_text(file, start=0, end=1, validate_range=True)
    assert "1: only line" in result[1]

    # Test out of range for single line file - should raise error
    with pytest.raises(ValueError, match="File single.py has only 1 lines, but requested offset 2 is out of range"):
        chunker.chunk_text(file, start=1, end=2, validate_range=True)


def test_line_chunker_validation_disabled_allows_out_of_range():
    """Test that out-of-bounds start always raises error, but invalid ranges (start>=end) are allowed when validation is off"""
    file = FileMetadata(file_name="test.py", source_id="test_source", content="line1\nline2\nline3")
    chunker = LineChunker()

    # Test 1: Out of bounds start should always raise error, even with validation disabled
    with pytest.raises(ValueError, match="File test.py has only 3 lines, but requested offset 6 is out of range"):
        chunker.chunk_text(file, start=5, end=10, validate_range=False)

    # Test 2: With validation disabled, start >= end should be allowed (but gives empty result)
    result = chunker.chunk_text(file, start=2, end=2, validate_range=False)
    assert len(result) == 1  # Only metadata header
    assert "[Viewing lines 3 to 2 (out of 3 lines)]" in result[0]


def test_line_chunker_only_start_parameter():
    """Test validation with only start parameter specified"""
    file = FileMetadata(file_name="test.py", source_id="test_source", content="line1\nline2\nline3")
    chunker = LineChunker()

    # Test valid start only
    result = chunker.chunk_text(file, start=1, validate_range=True)
    assert "[Viewing lines 2 to end (out of 3 lines)]" in result[0]
    assert "2: line2" in result[1]
    assert "3: line3" in result[2]

    # Test start at end of file - should raise error
    with pytest.raises(ValueError, match="File test.py has only 3 lines, but requested offset 4 is out of range"):
        chunker.chunk_text(file, start=3, validate_range=True)


# ---------------------- Alembic Revision TESTS ---------------------- #


@pytest.mark.asyncio
async def test_get_latest_alembic_revision():
    """Test that get_latest_alembic_revision returns a valid revision ID from the database."""
    from letta.utils import get_latest_alembic_revision

    # Get the revision ID
    revision_id = await get_latest_alembic_revision()

    # Validate that it's not the fallback "unknown" value
    assert revision_id != "unknown"

    # Validate that it looks like a valid revision ID (12 hex characters)
    assert len(revision_id) == 12
    assert all(c in "0123456789abcdef" for c in revision_id)

    # Validate that it's a string
    assert isinstance(revision_id, str)


@pytest.mark.asyncio
async def test_get_latest_alembic_revision_consistency():
    """Test that get_latest_alembic_revision returns the same value on multiple calls."""
    from letta.utils import get_latest_alembic_revision

    # Get the revision ID twice
    revision_id1 = await get_latest_alembic_revision()
    revision_id2 = await get_latest_alembic_revision()

    # They should be identical
    assert revision_id1 == revision_id2


# ---------------------- validate_function_response TESTS ---------------------- #


def test_validate_function_response_string_input():
    """Test that string inputs are returned unchanged when within limit"""
    response = validate_function_response("hello world", return_char_limit=100)
    assert response == "hello world"


def test_validate_function_response_none_input():
    """Test that None inputs are converted to 'None' string"""
    response = validate_function_response(None, return_char_limit=100)
    assert response == "None"


def test_validate_function_response_dict_input():
    """Test that dict inputs are JSON serialized"""
    test_dict = {"key": "value", "number": 42}
    response = validate_function_response(test_dict, return_char_limit=100)
    # Response should be valid JSON string
    import json

    parsed = json.loads(response)
    assert parsed == test_dict


def test_validate_function_response_other_types():
    """Test that other types are converted to strings"""
    # Test integer
    response = validate_function_response(42, return_char_limit=100)
    assert response == "42"

    # Test list
    response = validate_function_response([1, 2, 3], return_char_limit=100)
    assert response == "[1, 2, 3]"

    # Test boolean
    response = validate_function_response(True, return_char_limit=100)
    assert response == "True"


def test_validate_function_response_strict_mode_string():
    """Test strict mode allows strings"""
    response = validate_function_response("test", return_char_limit=100, strict=True)
    assert response == "test"


def test_validate_function_response_strict_mode_none():
    """Test strict mode allows None"""
    response = validate_function_response(None, return_char_limit=100, strict=True)
    assert response == "None"


def test_validate_function_response_strict_mode_violation():
    """Test strict mode raises ValueError for non-string/None types"""
    with pytest.raises(ValueError, match="Strict mode violation. Function returned type: int"):
        validate_function_response(42, return_char_limit=100, strict=True)

    with pytest.raises(ValueError, match="Strict mode violation. Function returned type: dict"):
        validate_function_response({"key": "value"}, return_char_limit=100, strict=True)


def test_validate_function_response_truncation():
    """Test that long responses are truncated when truncate=True"""
    long_string = "a" * 200
    response = validate_function_response(long_string, return_char_limit=50, truncate=True)
    assert len(response) > 50  # Should include truncation message
    assert response.startswith("a" * 50)
    assert "NOTE: function output was truncated" in response
    assert "200 > 50" in response


def test_validate_function_response_no_truncation():
    """Test that long responses are not truncated when truncate=False"""
    long_string = "a" * 200
    response = validate_function_response(long_string, return_char_limit=50, truncate=False)
    assert response == long_string
    assert len(response) == 200


def test_validate_function_response_exact_limit():
    """Test response exactly at the character limit"""
    exact_string = "a" * 50
    response = validate_function_response(exact_string, return_char_limit=50, truncate=True)
    assert response == exact_string


def test_validate_function_response_complex_dict():
    """Test with complex nested dictionary"""
    complex_dict = {"nested": {"key": "value"}, "list": [1, 2, {"inner": "dict"}], "null": None, "bool": True}
    response = validate_function_response(complex_dict, return_char_limit=1000)
    # Should be valid JSON
    import json

    parsed = json.loads(response)
    assert parsed == complex_dict


def test_validate_function_response_dict_truncation():
    """Test that serialized dict gets truncated properly"""
    # Create a dict that when serialized will exceed limit
    large_dict = {"data": "x" * 100}
    response = validate_function_response(large_dict, return_char_limit=20, truncate=True)
    assert "NOTE: function output was truncated" in response
    assert len(response) > 20  # Includes truncation message


def test_validate_function_response_empty_string():
    """Test empty string handling"""
    response = validate_function_response("", return_char_limit=100)
    assert response == ""


def test_validate_function_response_whitespace():
    """Test whitespace-only string handling"""
    response = validate_function_response("   \n\t  ", return_char_limit=100)
    assert response == "   \n\t  "


def test_sdk_version_check():
    """Test SDK version check"""
    assert not is_1_0_sdk_version(HeaderParams(user_agent="letta-client/0.0.200"))
    assert is_1_0_sdk_version(HeaderParams(user_agent="letta-client/1.0.0a5"))
    assert not is_1_0_sdk_version(HeaderParams(user_agent="@letta-ai/letta-client/0.0.200"))
    assert is_1_0_sdk_version(HeaderParams(user_agent="@letta-ai/letta-client/1.0.0-alpha.5"))
    assert is_1_0_sdk_version(HeaderParams(sdk_version="v1.0.0"))
    assert is_1_0_sdk_version(HeaderParams(sdk_version="v1.0.0-alpha.7"))
    assert is_1_0_sdk_version(HeaderParams(sdk_version="v1.0.0a7"))
    assert is_1_0_sdk_version(HeaderParams(sdk_version="v2.0.0"))
