import json
from abc import ABC, abstractmethod
from typing import Any

from pydantic_core import from_json

from letta.log import get_logger

logger = get_logger(__name__)


class JSONParser(ABC):
    @abstractmethod
    def parse(self, input_str: str) -> Any:
        raise NotImplementedError()


class PydanticJSONParser(JSONParser):
    """
    https://docs.pydantic.dev/latest/concepts/json/#json-parsing
    If `strict` is True, we will not allow for partial parsing of JSON.

    Compared with `OptimisticJSONParser`, this parser is more strict.
    Note: This will not partially parse strings which may be decrease parsing speed for message strings
    """

    def __init__(self, strict=False):
        self.strict = strict

    def parse(self, input_str: str) -> Any:
        if not input_str:
            return {}
        try:
            return from_json(input_str, allow_partial="trailing-strings" if not self.strict else False)
        except ValueError as e:
            logger.error(f"Failed to parse JSON: {e}")
            raise


class OptimisticJSONParser(JSONParser):
    """
    A JSON parser that attempts to parse a given string using `json.loads`,
    and if that fails, it parses as much valid JSON as possible while
    allowing extra tokens to remain. Those extra tokens can be retrieved
    from `self.last_parse_reminding`. If `strict` is False, the parser
    tries to tolerate incomplete strings and incomplete numbers.
    """

    def __init__(self, strict=False):
        self.strict = strict
        self.parsers = {
            " ": self._parse_space,
            "\r": self._parse_space,
            "\n": self._parse_space,
            "\t": self._parse_space,
            "[": self._parse_array,
            "{": self._parse_object,
            '"': self._parse_string,
            "t": self._parse_true,
            "f": self._parse_false,
            "n": self._parse_null,
        }
        # Register number parser for digits and signs
        for char in "0123456789.-":
            self.parsers[char] = self.parse_number

        self.last_parse_reminding = None
        self.on_extra_token = self._default_on_extra_token

    def _default_on_extra_token(self, text, data, reminding):
        print(f"Parsed JSON with extra tokens: {data}, remaining: {reminding}")

    def parse(self, input_str):
        """
        Try to parse the entire `input_str` as JSON. If parsing fails,
        attempts a partial parse, storing leftover text in
        `self.last_parse_reminding`. A callback (`on_extra_token`) is
        triggered if extra tokens remain.
        """
        if len(input_str) >= 1:
            try:
                return json.loads(input_str)
            except json.JSONDecodeError as decode_error:
                data, reminding = self._parse_any(input_str, decode_error)
                self.last_parse_reminding = reminding
                if self.on_extra_token and reminding:
                    self.on_extra_token(input_str, data, reminding)
                return data
        else:
            return json.loads("{}")

    def _parse_any(self, input_str, decode_error):
        """Determine which parser to use based on the first character."""
        if not input_str:
            raise decode_error
        parser = self.parsers.get(input_str[0])
        if parser is None:
            raise decode_error
        return parser(input_str, decode_error)

    def _parse_space(self, input_str, decode_error):
        """Strip leading whitespace and parse again."""
        return self._parse_any(input_str.strip(), decode_error)

    def _parse_array(self, input_str, decode_error):
        """Parse a JSON array, returning the list and remaining string."""
        # Skip the '['
        input_str = input_str[1:]
        array_values = []
        input_str = input_str.strip()
        while input_str:
            if input_str[0] == "]":
                # Skip the ']'
                input_str = input_str[1:]
                break
            value, input_str = self._parse_any(input_str, decode_error)
            array_values.append(value)
            input_str = input_str.strip()
            if input_str.startswith(","):
                # Skip the ','
                input_str = input_str[1:].strip()
        return array_values, input_str

    def _parse_object(self, input_str, decode_error):
        """Parse a JSON object, returning the dict and remaining string."""
        # Skip the '{'
        input_str = input_str[1:]
        obj = {}
        input_str = input_str.strip()
        while input_str:
            if input_str[0] == "}":
                # Skip the '}'
                input_str = input_str[1:]
                break
            key, input_str = self._parse_any(input_str, decode_error)
            input_str = input_str.strip()

            if not input_str or input_str[0] == "}":
                obj[key] = None
                break
            if input_str[0] != ":":
                raise decode_error

            # Skip ':'
            input_str = input_str[1:].strip()
            if not input_str or input_str[0] in ",}":
                obj[key] = None
                if input_str.startswith(","):
                    input_str = input_str[1:]
                break

            value, input_str = self._parse_any(input_str, decode_error)
            obj[key] = value
            input_str = input_str.strip()
            if input_str.startswith(","):
                # Skip the ','
                input_str = input_str[1:].strip()
        return obj, input_str

    def _parse_string(self, input_str, decode_error):
        """Parse a JSON string, respecting escaped quotes if present."""
        end = input_str.find('"', 1)
        while end != -1 and input_str[end - 1] == "\\":
            end = input_str.find('"', end + 1)

        if end == -1:
            # Incomplete string
            if not self.strict:
                return input_str[1:], ""  # Lenient mode returns partial string
            raise decode_error  # Raise error for incomplete string in strict mode

        str_val = input_str[: end + 1]
        input_str = input_str[end + 1 :]
        if not self.strict:
            return str_val[1:-1], input_str
        return json.loads(str_val), input_str

    def parse_number(self, input_str, decode_error):
        """
        Parse a number (int or float). Allows digits, '.', '-', but
        doesn't fully validate complex exponents unless they appear
        before a non-number character.
        """
        idx = 0
        while idx < len(input_str) and input_str[idx] in "0123456789.-":
            idx += 1

        num_str = input_str[:idx]
        remainder = input_str[idx:]

        # If not strict, and it's only a sign or just '.', return as-is with empty remainder
        if not self.strict and (not num_str or num_str in {"-", "."}):
            return num_str, ""

        try:
            if num_str.endswith("."):
                num = int(num_str[:-1])
            else:
                num = float(num_str) if any(c in num_str for c in ".eE") else int(num_str)
        except ValueError:
            raise decode_error

        return num, remainder

    def _parse_true(self, input_str, decode_error):
        """Parse a 'true' value."""
        if input_str.startswith(("t", "T")):
            return True, input_str[4:]
        raise decode_error

    def _parse_false(self, input_str, decode_error):
        """Parse a 'false' value."""
        if input_str.startswith(("f", "F")):
            return False, input_str[5:]
        raise decode_error

    def _parse_null(self, input_str, decode_error):
        """Parse a 'null' value."""
        if input_str.startswith("n"):
            return None, input_str[4:]
        raise decode_error
