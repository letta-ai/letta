from typing import TypeAlias

from pydantic import JsonValue

JsonDict: TypeAlias = dict[str, JsonValue]

__all__ = ["JsonDict", "JsonValue"]
