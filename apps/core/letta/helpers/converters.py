import base64
from typing import Any, Dict, List, Optional, Union

import numpy as np
from openai.types.chat.chat_completion_message_tool_call import ChatCompletionMessageToolCall as OpenAIToolCall
from openai.types.chat.chat_completion_message_tool_call import Function as OpenAIFunction
from sqlalchemy import Dialect

from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import ToolRuleType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.tool_rule import ChildToolRule, ConditionalToolRule, ContinueToolRule, InitToolRule, TerminalToolRule, ToolRule

# --------------------------
# LLMConfig Serialization
# --------------------------


def serialize_llm_config(config: Union[Optional[LLMConfig], Dict]) -> Optional[Dict]:
    """Convert an LLMConfig object into a JSON-serializable dictionary."""
    if config and isinstance(config, LLMConfig):
        return config.model_dump()
    return config


def deserialize_llm_config(data: Optional[Dict]) -> Optional[LLMConfig]:
    """Convert a dictionary back into an LLMConfig object."""
    return LLMConfig(**data) if data else None


# --------------------------
# EmbeddingConfig Serialization
# --------------------------


def serialize_embedding_config(config: Union[Optional[EmbeddingConfig], Dict]) -> Optional[Dict]:
    """Convert an EmbeddingConfig object into a JSON-serializable dictionary."""
    if config and isinstance(config, EmbeddingConfig):
        return config.model_dump()
    return config


def deserialize_embedding_config(data: Optional[Dict]) -> Optional[EmbeddingConfig]:
    """Convert a dictionary back into an EmbeddingConfig object."""
    return EmbeddingConfig(**data) if data else None


# --------------------------
# ToolRule Serialization
# --------------------------


def serialize_tool_rules(tool_rules: Optional[List[ToolRule]]) -> List[Dict[str, Any]]:
    """Convert a list of ToolRules into a JSON-serializable format."""

    if not tool_rules:
        return []

    data = [{**rule.model_dump(), "type": rule.type.value} for rule in tool_rules]  # Convert Enum to string for JSON compatibility

    # Validate ToolRule structure
    for rule_data in data:
        if rule_data["type"] == ToolRuleType.constrain_child_tools.value and "children" not in rule_data:
            raise ValueError(f"Invalid ToolRule serialization: 'children' field missing for rule {rule_data}")

    return data


def deserialize_tool_rules(data: Optional[List[Dict]]) -> List[Union[ChildToolRule, InitToolRule, TerminalToolRule, ConditionalToolRule]]:
    """Convert a list of dictionaries back into ToolRule objects."""
    if not data:
        return []

    return [deserialize_tool_rule(rule_data) for rule_data in data]


def deserialize_tool_rule(data: Dict) -> Union[ChildToolRule, InitToolRule, TerminalToolRule, ConditionalToolRule, ContinueToolRule]:
    """Deserialize a dictionary to the appropriate ToolRule subclass based on 'type'."""
    rule_type = ToolRuleType(data.get("type"))

    if rule_type == ToolRuleType.run_first:
        return InitToolRule(**data)
    elif rule_type == ToolRuleType.exit_loop:
        return TerminalToolRule(**data)
    elif rule_type == ToolRuleType.constrain_child_tools:
        return ChildToolRule(**data)
    elif rule_type == ToolRuleType.conditional:
        return ConditionalToolRule(**data)
    elif rule_type == ToolRuleType.continue_loop:
        return ContinueToolRule(**data)
    raise ValueError(f"Unknown ToolRule type: {rule_type}")


# --------------------------
# ToolCall Serialization
# --------------------------


def serialize_tool_calls(tool_calls: Optional[List[Union[OpenAIToolCall, dict]]]) -> List[Dict]:
    """Convert a list of OpenAI ToolCall objects into JSON-serializable format."""
    if not tool_calls:
        return []

    serialized_calls = []
    for call in tool_calls:
        if isinstance(call, OpenAIToolCall):
            serialized_calls.append(call.model_dump())
        elif isinstance(call, dict):
            serialized_calls.append(call)  # Already a dictionary, leave it as-is
        else:
            raise TypeError(f"Unexpected tool call type: {type(call)}")

    return serialized_calls


def deserialize_tool_calls(data: Optional[List[Dict]]) -> List[OpenAIToolCall]:
    """Convert a JSON list back into OpenAIToolCall objects."""
    if not data:
        return []

    calls = []
    for item in data:
        func_data = item.pop("function", None)
        tool_call_function = OpenAIFunction(**func_data) if func_data else None
        calls.append(OpenAIToolCall(function=tool_call_function, **item))

    return calls


# --------------------------
# Vector Serialization
# --------------------------


def serialize_vector(vector: Optional[Union[List[float], np.ndarray]]) -> Optional[bytes]:
    """Convert a NumPy array or list into a base64-encoded byte string."""
    if vector is None:
        return None
    if isinstance(vector, list):
        vector = np.array(vector, dtype=np.float32)

    return base64.b64encode(vector.tobytes())


def deserialize_vector(data: Optional[bytes], dialect: Dialect) -> Optional[np.ndarray]:
    """Convert a base64-encoded byte string back into a NumPy array."""
    if not data:
        return None

    if dialect.name == "sqlite":
        data = base64.b64decode(data)

    return np.frombuffer(data, dtype=np.float32)
