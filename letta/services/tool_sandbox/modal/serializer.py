"""
Serialization utilities for Modal V3 sandbox.
Provides clean, safe serialization with proper error handling and fallbacks.
"""

import pickle
from typing import Any

from letta.log import get_logger

logger = get_logger(__name__)

# Maximum size for pickled data (10MB)
MAX_PICKLE_SIZE = 10 * 1024 * 1024


class SerializationError(Exception):
    """Raised when serialization fails."""


def safe_pickle(obj: Any) -> bytes:
    """
    Safely pickle an object with size validation.
    Args:
        obj: Object to pickle
    Returns:
        Pickled bytes
    Raises:
        SerializationError: If pickling fails or size exceeds limit
    """
    try:
        pickled = pickle.dumps(obj)

        if len(pickled) > MAX_PICKLE_SIZE:
            raise SerializationError(f"Pickled object too large: {len(pickled)} bytes (max: {MAX_PICKLE_SIZE})")

        return pickled
    except Exception as e:
        raise SerializationError(f"Failed to pickle object: {e}")


def safe_unpickle(data: bytes) -> Any:
    """
    Safely unpickle data with size validation.
    Args:
        data: Pickled bytes
    Returns:
        Unpickled object
    Raises:
        SerializationError: If unpickling fails
    """
    if not data:
        raise SerializationError("No data to unpickle")

    if len(data) > MAX_PICKLE_SIZE:
        raise SerializationError(f"Pickled data too large: {len(data)} bytes (max: {MAX_PICKLE_SIZE})")

    try:
        return pickle.loads(data)
    except Exception as e:
        raise SerializationError(f"Failed to unpickle data: {e}")


def serialize_arguments(args: dict) -> bytes:
    """
    Serialize function arguments with fallback strategies.
    Args:
        args: Dictionary of arguments
    Returns:
        Serialized arguments
    """
    # Try direct serialization first
    try:
        return safe_pickle(args)
    except SerializationError:
        logger.warning("Direct serialization failed, attempting sanitization")

    # Try sanitizing complex objects
    sanitized = sanitize_for_serialization(args)
    try:
        return safe_pickle(sanitized)
    except SerializationError:
        logger.warning("Sanitized serialization failed, converting to strings")

    # Final fallback: convert everything to strings
    string_args = {k: str(v) for k, v in args.items()}
    return safe_pickle(string_args)


def sanitize_for_serialization(obj: Any) -> Any:
    """
    Sanitize an object for serialization by removing unpicklable elements.
    Args:
        obj: Object to sanitize
    Returns:
        Sanitized object
    """
    if isinstance(obj, dict):
        return {k: sanitize_for_serialization(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return type(obj)(sanitize_for_serialization(item) for item in obj)
    elif isinstance(obj, (str, int, float, bool, type(None))):
        return obj
    else:
        # For complex objects, try to convert to a simple representation
        try:
            # Try to get a dict representation
            if hasattr(obj, "__dict__"):
                return sanitize_for_serialization(obj.__dict__)
            else:
                return str(obj)
        except:
            return str(obj)


def serialize_result(result: Any) -> Any:
    """
    Serialize a function result for transmission.
    Attempts to preserve structure while ensuring serializability.
    Args:
        result: Function result
    Returns:
        Serializable result
    """
    try:
        # Try to use Pydantic if available for better serialization
        from pydantic import BaseModel, ConfigDict

        class ResultWrapper(BaseModel):
            model_config = ConfigDict(arbitrary_types_allowed=True)
            result: Any

        wrapped = ResultWrapper(result=result)
        return wrapped.model_dump()["result"]
    except:
        # Fallback to string representation
        return str(result) if result is not None else None
