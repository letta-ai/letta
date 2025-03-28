from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field

from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.letta_message_content import TextContent
from letta.schemas.llm_config import LLMConfig


class CoreMemoryBlockSchema(BaseModel):
    created_at: str
    description: Optional[str]
    is_template: bool
    label: str
    limit: int
    metadata_: Optional[Dict] = None
    template_name: Optional[str]
    updated_at: str
    value: str


class MessageSchema(BaseModel):
    created_at: str
    group_id: Optional[str]
    model: Optional[str]
    name: Optional[str]
    role: str
    content: List[TextContent]  # TODO: Expand to more in the future
    tool_call_id: Optional[str]
    tool_calls: List[Any]
    tool_returns: List[Any]
    updated_at: str


class TagSchema(BaseModel):
    tag: str


class ToolEnvVarSchema(BaseModel):
    created_at: str
    description: Optional[str]
    key: str
    updated_at: str
    value: str


# Tool rules


class BaseToolRuleSchema(BaseModel):
    tool_name: str
    type: str


class ChildToolRuleSchema(BaseToolRuleSchema):
    children: List[str]


class MaxCountPerStepToolRuleSchema(BaseToolRuleSchema):
    max_count_limit: int


class ConditionalToolRuleSchema(BaseToolRuleSchema):
    default_child: Optional[str]
    child_output_mapping: Dict[Any, str]
    require_output_mapping: bool


ToolRuleSchema = Union[BaseToolRuleSchema, ChildToolRuleSchema, MaxCountPerStepToolRuleSchema, ConditionalToolRuleSchema]


class ParameterProperties(BaseModel):
    type: str
    description: Optional[str] = None


class ParametersSchema(BaseModel):
    type: Optional[str] = "object"
    properties: Dict[str, ParameterProperties]
    required: List[str] = Field(default_factory=list)


class ToolJSONSchema(BaseModel):
    name: str
    description: str
    parameters: ParametersSchema  # <— nested strong typing
    type: Optional[str] = None  # top-level 'type' if it exists
    required: Optional[List[str]] = Field(default_factory=list)


class ToolSchema(BaseModel):
    args_json_schema: Optional[Any]
    created_at: str
    description: str
    json_schema: ToolJSONSchema
    name: str
    return_char_limit: int
    source_code: Optional[str]
    source_type: str
    tags: List[str]
    tool_type: str
    updated_at: str
    metadata_: Optional[Dict] = None


class AgentSchema(BaseModel):
    agent_type: str
    core_memory: List[CoreMemoryBlockSchema]
    created_at: str
    description: Optional[str]
    embedding_config: EmbeddingConfig
    llm_config: LLMConfig
    message_buffer_autoclear: bool
    in_context_message_indices: List[int]
    messages: List[MessageSchema]
    metadata_: Optional[Dict] = None
    multi_agent_group: Optional[Any]
    name: str
    system: str
    tags: List[TagSchema]
    tool_exec_environment_variables: List[ToolEnvVarSchema]
    tool_rules: List[ToolRuleSchema]
    tools: List[ToolSchema]
    updated_at: str
    version: str
