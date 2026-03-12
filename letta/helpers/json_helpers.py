import base64
import json
from datetime import datetime
from typing import Any


def sanitize_unicode_surrogates(value: Any) -> Any:
    """Recursively remove invalid Unicode surrogate characters from strings.

    Unicode surrogate pairs (U+D800 to U+DFFF) are used internally by UTF-16 encoding
    but are invalid as standalone characters in UTF-8. When present, they cause
    UnicodeEncodeError when encoding to UTF-8, breaking API requests that need to
    serialize data to JSON.

    This function sanitizes:
    - Strings: removes unpaired surrogates that can't be encoded to UTF-8
    - Dicts: recursively sanitizes all string values
    - Lists: recursively sanitizes all elements
    - Other types: returned as-is

    Args:
        value: The value to sanitize

    Returns:
        The sanitized value with surrogate characters removed from all strings
    """
    if isinstance(value, str):
        # Remove lone surrogate characters (U+D800 to U+DFFF) which are invalid in UTF-8
        # Using character filtering is more reliable than encode/decode for edge cases
        try:
            # Filter out any character in the surrogate range
            return "".join(char for char in value if not (0xD800 <= ord(char) <= 0xDFFF))
        except Exception:
            # Fallback: try encode with errors="replace" which replaces surrogates with �
            try:
                return value.encode("utf-8", errors="replace").decode("utf-8")
            except Exception:
                # Last resort: return original (should never reach here)
                return value
    elif isinstance(value, dict):
        # Recursively sanitize dictionary keys and values
        return {sanitize_unicode_surrogates(k): sanitize_unicode_surrogates(v) for k, v in value.items()}
    elif isinstance(value, list):
        # Recursively sanitize list elements
        return [sanitize_unicode_surrogates(item) for item in value]
    elif isinstance(value, tuple):
        # Recursively sanitize tuple elements (return as tuple)
        return tuple(sanitize_unicode_surrogates(item) for item in value)
    else:
        # Return other types as-is (int, float, bool, None, etc.)
        return value


def sanitize_null_bytes(value: Any) -> Any:
    """Recursively remove null bytes (0x00) from strings.

    PostgreSQL TEXT columns don't accept null bytes in UTF-8 encoding, which causes
    asyncpg.exceptions.CharacterNotInRepertoireError when data with null bytes is inserted.

    This function sanitizes:
    - Strings: removes all null bytes
    - Dicts: recursively sanitizes all string values
    - Lists: recursively sanitizes all elements
    - Other types: returned as-is

    Args:
        value: The value to sanitize

    Returns:
        The sanitized value with null bytes removed from all strings
    """
    if isinstance(value, str):
        # Remove null bytes from strings
        return value.replace("\x00", "")
    elif isinstance(value, dict):
        # Recursively sanitize dictionary keys and values
        return {sanitize_null_bytes(k): sanitize_null_bytes(v) for k, v in value.items()}
    elif isinstance(value, list):
        # Recursively sanitize list elements
        return [sanitize_null_bytes(item) for item in value]
    elif isinstance(value, tuple):
        # Recursively sanitize tuple elements (return as tuple)
        return tuple(sanitize_null_bytes(item) for item in value)
    else:
        # Return other types as-is (int, float, bool, None, etc.)
        return value


def json_loads(data):
    return json.loads(data, strict=False)


def json_dumps(data, indent=2) -> str:
    """Serialize data to JSON string, sanitizing null bytes to prevent PostgreSQL errors.

    PostgreSQL TEXT columns reject null bytes (0x00) in UTF-8 encoding. This function
    sanitizes all strings in the data structure before JSON serialization to prevent
    asyncpg.exceptions.CharacterNotInRepertoireError.

    Args:
        data: The data to serialize
        indent: JSON indentation level (default: 2)

    Returns:
        JSON string with null bytes removed from all string values
    """
    # Sanitize null bytes before serialization to prevent PostgreSQL errors
    sanitized_data = sanitize_null_bytes(data)

    def safe_serializer(obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, bytes):
            try:
                decoded = obj.decode("utf-8")
                # Also sanitize decoded bytes
                return decoded.replace("\x00", "")
            except Exception:
                # TODO: this is to handle Gemini thought signatures, b64 decode this back to bytes when sending back to Gemini
                return base64.b64encode(obj).decode("utf-8")
        raise TypeError(f"Type {type(obj)} not serializable")

    return json.dumps(sanitized_data, indent=indent, default=safe_serializer, ensure_ascii=False)
