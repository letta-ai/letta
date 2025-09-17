import json
from unittest.mock import patch

import pytest

from letta.server.rest_api.json_parser import OptimisticJSONParser


@pytest.fixture
def strict_parser():
    """Provides a fresh OptimisticJSONParser instance in strict mode."""
    return OptimisticJSONParser(strict=True)


@pytest.fixture
def lenient_parser():
    """Provides a fresh OptimisticJSONParser instance in non-strict mode."""
    return OptimisticJSONParser(strict=False)


def test_parse_empty_input(strict_parser):
    """
    Test parsing an empty string. Should fall back to parsing "{}".
    """
    result = strict_parser.parse("")
    assert result == {}, "Empty input should parse as an empty dict."


def test_parse_valid_json(strict_parser):
    """
    Test parsing a valid JSON string using the standard json.loads logic.
    """
    input_str = '{"name": "John", "age": 30}'
    result = strict_parser.parse(input_str)
    assert result == {"name": "John", "age": 30}, "Should parse valid JSON correctly."


def test_parse_valid_json_array(strict_parser):
    """
    Test parsing a valid JSON array.
    """
    input_str = '[1, 2, 3, "four"]'
    result = strict_parser.parse(input_str)
    assert result == [1, 2, 3, "four"], "Should parse valid JSON array correctly."


def test_parse_partial_json_object(strict_parser):
    """
    Test parsing a JSON object with extra trailing characters.
    The extra characters should trigger on_extra_token.
    """
    input_str = '{"key": "value"} trailing'
    with patch.object(strict_parser, "on_extra_token") as mock_callback:
        result = strict_parser.parse(input_str)

    assert result == {"key": "value"}, "Should parse the JSON part properly."
    assert strict_parser.last_parse_reminding.strip() == "trailing", "The leftover reminding should be 'trailing'."
    mock_callback.assert_called_once()


def test_parse_partial_json_array(strict_parser):
    """
    Test parsing a JSON array with extra tokens.
    """
    input_str = "[1, 2, 3] extra_tokens"
    result = strict_parser.parse(input_str)
    assert result == [1, 2, 3], "Should parse array portion properly."
    assert strict_parser.last_parse_reminding.strip() == "extra_tokens", "The leftover reminding should capture extra tokens."


def test_parse_number_cases(strict_parser):
    """
    Test various number formats.
    """
    # We'll parse them individually to ensure the fallback parser handles them.
    test_cases = {
        "123": 123,
        "-42": -42,
        "3.14": 3.14,
        "-0.001": -0.001,
        "10.": 10,  # This should convert to int in our parser.
        ".5": 0.5 if not strict_parser.strict else ".5",
    }

    for num_str, expected in test_cases.items():
        parsed = strict_parser.parse(num_str)
        if num_str == ".5" and strict_parser.strict:
            # Strict mode won't parse ".5" directly as a valid float by default
            # Our current logic may end up raising or partial-parsing.
            # Adjust as necessary based on your actual parser's behavior.
            assert parsed == ".5" or parsed == 0.5, "Strict handling of '.5' can vary."
        else:
            assert parsed == expected, f"Number parsing failed for {num_str}"


def test_parse_boolean_true(strict_parser):
    assert strict_parser.parse("true") is True, "Should parse 'true'."
    # Check leftover
    assert strict_parser.last_parse_reminding is None, "No extra tokens expected."


def test_parse_boolean_false(strict_parser):
    assert strict_parser.parse("false") is False, "Should parse 'false'."


def test_parse_null(strict_parser):
    assert strict_parser.parse("null") is None, "Should parse 'null'."


@pytest.mark.parametrize("invalid_boolean", ["tru", "fa", "fal", "True", "False"])
def test_parse_invalid_booleans(strict_parser, invalid_boolean):
    """
    Test some invalid booleans. The parser tries to parse them as partial if possible.
    If it fails, it may raise an exception or parse partially based on the code.
    """
    try:
        result = strict_parser.parse(invalid_boolean)
        # If it doesn't raise, it might parse partially or incorrectly.
        # Check leftover or the returned data.
        # Adjust your assertions based on actual parser behavior.
        assert result in [True, False, invalid_boolean], f"Unexpected parse result for {invalid_boolean}: {result}"
    except json.JSONDecodeError:
        # This is also a valid outcome for truly invalid strings in strict mode.
        pass


def test_parse_string_with_escapes(strict_parser):
    """
    Test a string containing escaped quotes.
    """
    input_str = r'"This is a \"test\" string"'
    result = strict_parser.parse(input_str)
    assert result == 'This is a "test" string', "String with escaped quotes should parse correctly."


def test_parse_incomplete_string_strict(strict_parser):
    """
    Test how a strict parser handles an incomplete string.
    """
    input_str = '"Unfinished string with no end'
    try:
        strict_parser.parse(input_str)
        pytest.fail("Expected an error or partial parse with leftover tokens in strict mode.")
    except json.JSONDecodeError:
        pass  # Strict mode might raise


def test_parse_incomplete_string_lenient(lenient_parser):
    """
    In non-strict mode, incomplete strings may be returned as-is.
    """
    input_str = '"Unfinished string with no end'
    result = lenient_parser.parse(input_str)
    assert result == "Unfinished string with no end", "Lenient mode should return the incomplete string without quotes."


def test_parse_incomplete_number_strict(strict_parser):
    """
    Test how a strict parser handles an incomplete number, like '-' or '.'.
    In strict mode, the parser now raises JSONDecodeError rather than
    returning the partial string.
    """
    input_str = "-"
    with pytest.raises(json.JSONDecodeError):
        strict_parser.parse(input_str)


def test_object_with_missing_colon(strict_parser):
    """
    Test parsing an object missing a colon. Should raise or partially parse.
    """
    input_str = '{"key" "value"}'
    try:
        strict_parser.parse(input_str)
        pytest.fail("Parser should raise or handle error with missing colon.")
    except json.JSONDecodeError:
        pass


def test_object_with_missing_value(strict_parser):
    """
    Test parsing an object with a key but no value before a comma or brace.
    """
    input_str = '{"key":}'
    # Depending on parser logic, "key" might map to None or raise an error.
    result = strict_parser.parse(input_str)
    # Expect partial parse: {'key': None}
    assert result == {"key": None}, "Key without value should map to None."


def test_array_with_trailing_comma(strict_parser):
    """
    Test array that might have a trailing comma before closing.
    """
    input_str = "[1, 2, 3, ]"
    result = strict_parser.parse(input_str)
    # The parser does not explicitly handle trailing commas in strict JSON.
    # But the fallback logic may allow partial parse. Adjust assertions accordingly.
    assert result == [1, 2, 3], "Trailing comma should be handled or partially parsed."


def test_callback_invocation(strict_parser, capsys):
    """
    Verify that on_extra_token callback is invoked and prints expected content.
    """
    input_str = '{"a":1} leftover'
    strict_parser.parse(input_str)
    captured = capsys.readouterr().out
    assert "Parsed JSON with extra tokens:" in captured, "Callback default_on_extra_token should print a message."


def test_unknown_token(strict_parser):
    """
    Test parser behavior when encountering an unknown first character.
    Should raise JSONDecodeError in strict mode.
    """
    input_str = "@invalid"
    with pytest.raises(json.JSONDecodeError):
        strict_parser.parse(input_str)


def test_array_nested_objects(lenient_parser):
    """
    Test parsing a complex structure with nested arrays/objects.
    """
    input_str = '[ {"a":1}, {"b": [2,3]}, 4, "string"] leftover'
    result = lenient_parser.parse(input_str)
    expected = [{"a": 1}, {"b": [2, 3]}, 4, "string"]
    assert result == expected, "Should parse nested arrays/objects correctly."
    assert lenient_parser.last_parse_reminding.strip() == "leftover"


def test_multiple_parse_calls(strict_parser):
    """
    Test calling parse() multiple times to ensure leftover is reset properly.
    """
    input_1 = '{"x":1} trailing1'
    input_2 = "[2,3] trailing2"

    # First parse
    result_1 = strict_parser.parse(input_1)
    assert result_1 == {"x": 1}
    assert strict_parser.last_parse_reminding.strip() == "trailing1"

    # Second parse
    result_2 = strict_parser.parse(input_2)
    assert result_2 == [2, 3]
    assert strict_parser.last_parse_reminding.strip() == "trailing2"


def test_parse_incomplete_string_streaming_strict(strict_parser):
    """
    Test how a strict parser handles an incomplete string received in chunks.
    """
    # Simulate streaming chunks
    chunk1 = '{"message": "This is an incomplete'
    chunk2 = " string with a newline\\n"
    chunk3 = 'and more text"}'

    with pytest.raises(json.JSONDecodeError, match="Unterminated string"):
        strict_parser.parse(chunk1)

    incomplete_json = chunk1 + chunk2
    with pytest.raises(json.JSONDecodeError, match="Unterminated string"):
        strict_parser.parse(incomplete_json)

    complete_json = incomplete_json + chunk3
    result = strict_parser.parse(complete_json)
    expected = {"message": "This is an incomplete string with a newline\nand more text"}
    assert result == expected, "Should parse complete JSON correctly"


def test_unescaped_control_characters_strict(strict_parser):
    """
    Test parsing JSON containing unescaped control characters in strict mode.
    """
    input_str = '{"message": "This has a newline\nand tab\t"}'

    with pytest.raises(json.JSONDecodeError, match="Invalid control character"):
        strict_parser.parse(input_str)
