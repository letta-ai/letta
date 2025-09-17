"""Safe pickle serialization wrapper for Modal sandbox.

This module provides defensive serialization utilities to prevent segmentation
faults and other crashes when passing complex objects to Modal containers.
"""

import pickle
import sys
from typing import Any, Optional, Tuple

from letta.log import get_logger

logger = get_logger(__name__)

# Serialization limits
MAX_PICKLE_SIZE = 10 * 1024 * 1024  # 10MB limit
MAX_RECURSION_DEPTH = 50  # Prevent deep object graphs
PICKLE_PROTOCOL = 4  # Use protocol 4 for better compatibility


class SafePickleError(Exception):
    """Raised when safe pickling fails."""


class RecursionLimiter:
    """Context manager to limit recursion depth during pickling."""

    def __init__(self, max_depth: int):
        self.max_depth = max_depth
        self.original_limit = None

    def __enter__(self):
        self.original_limit = sys.getrecursionlimit()
        sys.setrecursionlimit(min(self.max_depth, self.original_limit))
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.original_limit is not None:
            sys.setrecursionlimit(self.original_limit)


def safe_pickle_dumps(obj: Any, max_size: int = MAX_PICKLE_SIZE) -> bytes:
    """Safely pickle an object with size and recursion limits.

    Args:
        obj: The object to pickle
        max_size: Maximum allowed pickle size in bytes

    Returns:
        bytes: The pickled object

    Raises:
        SafePickleError: If pickling fails or exceeds limits
    """
    try:
        # First check for obvious size issues
        # Do a quick pickle to check size
        quick_pickle = pickle.dumps(obj, protocol=PICKLE_PROTOCOL)
        if len(quick_pickle) > max_size:
            raise SafePickleError(f"Pickle size {len(quick_pickle)} exceeds limit {max_size}")

        # Check recursion depth by traversing the object
        def check_depth(obj, depth=0):
            if depth > MAX_RECURSION_DEPTH:
                raise SafePickleError(f"Object graph too deep (depth > {MAX_RECURSION_DEPTH})")

            if isinstance(obj, (list, tuple)):
                for item in obj:
                    check_depth(item, depth + 1)
            elif isinstance(obj, dict):
                for value in obj.values():
                    check_depth(value, depth + 1)
            elif hasattr(obj, "__dict__"):
                check_depth(obj.__dict__, depth + 1)

        check_depth(obj)

        logger.debug(f"Successfully pickled object of size {len(quick_pickle)} bytes")
        return quick_pickle

    except SafePickleError:
        raise
    except RecursionError as e:
        raise SafePickleError(f"Object graph too deep: {e}")
    except Exception as e:
        raise SafePickleError(f"Failed to pickle object: {e}")


def safe_pickle_loads(data: bytes) -> Any:
    """Safely unpickle data with error handling.

    Args:
        data: The pickled data

    Returns:
        Any: The unpickled object

    Raises:
        SafePickleError: If unpickling fails
    """
    if not data:
        raise SafePickleError("Cannot unpickle empty data")

    if len(data) > MAX_PICKLE_SIZE:
        raise SafePickleError(f"Pickle data size {len(data)} exceeds limit {MAX_PICKLE_SIZE}")

    try:
        obj = pickle.loads(data)
        logger.debug(f"Successfully unpickled object from {len(data)} bytes")
        return obj
    except Exception as e:
        raise SafePickleError(f"Failed to unpickle data: {e}")


def try_pickle_with_fallback(obj: Any, fallback_value: Any = None, max_size: int = MAX_PICKLE_SIZE) -> Tuple[Optional[bytes], bool]:
    """Try to pickle an object with fallback on failure.

    Args:
        obj: The object to pickle
        fallback_value: Value to use if pickling fails
        max_size: Maximum allowed pickle size

    Returns:
        Tuple of (pickled_data or None, success_flag)
    """
    try:
        pickled = safe_pickle_dumps(obj, max_size)
        return pickled, True
    except SafePickleError as e:
        logger.warning(f"Failed to pickle object, using fallback: {e}")
        if fallback_value is not None:
            try:
                pickled = safe_pickle_dumps(fallback_value, max_size)
                return pickled, False
            except SafePickleError:
                pass
    return None, False


def validate_pickleable(obj: Any) -> bool:
    """Check if an object can be safely pickled.

    Args:
        obj: The object to validate

    Returns:
        bool: True if the object can be pickled safely
    """
    try:
        # Try to pickle to a small buffer
        safe_pickle_dumps(obj, max_size=MAX_PICKLE_SIZE)
        return True
    except SafePickleError:
        return False


def sanitize_for_pickle(obj: Any) -> Any:
    """Sanitize an object for safe pickling.

    This function attempts to make an object pickleable by converting
    problematic types to safe alternatives.

    Args:
        obj: The object to sanitize

    Returns:
        Any: A sanitized version of the object
    """
    # Handle common problematic types
    if hasattr(obj, "__dict__"):
        # For objects with __dict__, try to sanitize attributes
        sanitized = {}
        for key, value in obj.__dict__.items():
            if key.startswith("_"):
                continue  # Skip private attributes

            # Convert non-pickleable types
            if callable(value):
                sanitized[key] = f"<function {value.__name__}>"
            elif hasattr(value, "__module__"):
                sanitized[key] = f"<{value.__class__.__name__} object>"
            else:
                try:
                    # Test if the value is pickleable
                    pickle.dumps(value, protocol=PICKLE_PROTOCOL)
                    sanitized[key] = value
                except:
                    sanitized[key] = str(value)

        return sanitized

    # For other types, return as-is and let pickle handle it
    return obj
