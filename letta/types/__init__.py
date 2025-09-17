from typing import Any, TypeAlias

from pydantic import JsonValue

JsonDict: TypeAlias = dict[str, JsonValue]

__all__ = ["JsonDict", "JsonValue"]
