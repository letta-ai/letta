from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field, HttpUrl, EmailStr
import re

# Assuming these are defined elsewhere and correctly imported
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.letta_message_content import LettaMessageContentUnion
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
    content: List[LettaMessageContentUnion] = Field(
        ...,
        json_schema_extra={
            "items": {
                "$ref": "#/components/schemas/LettaMessageContentUnion",
            }
        },
    )
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
    parameters: ParametersSchema
    type: Optional[str] = None
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


# --- New Schema Elements for Custom Modules ---

class InferenceConfig(BaseModel):
    provider: str = Field(..., description="The LLM inference provider (e.g., 'gemini-nano', 'openai').")
    api_key: Optional[str] = Field(None, description="API key for remote providers. Should be handled securely.")
    base_url: Optional[HttpUrl] = Field(None, description="Base URL for custom remote API endpoints.")
    streaming: bool = Field(True, description="Whether to expect streaming responses from the LLM.")
    model_parameters: Dict[str, Any] = Field(
        default_factory=dict,
        description="Specific LLM generation parameters (e.g., temperature, top_p, max_output_tokens)."
    )
    # Context window limit, model name, embedding model name are covered by LLMConfig and EmbeddingConfig now


class SemanticMemoryConfig(BaseModel):
    embedding_model: str = Field(..., description="Name of the embedding model to use for semantic memory.")
    indexing_threshold: float = Field(
        0.7, ge=0.0, le=1.0, description="Similarity score threshold for indexing new memories."
    )
    retrieval_k: int = Field(5, ge=1, description="Number of top-K relevant memories to retrieve.")
    persistence_interval_ms: int = Field(
        60000, ge=1000, description="How often to persist the memory index to OPFS in milliseconds."
    )


class LoopDetectionConfig(BaseModel):
    history_length: int = Field(10, ge=1, description="Number of recent actions/states to consider for loop detection.")
    similarity_threshold: float = Field(
        0.8, ge=0.0, le=1.0, description="Threshold for considering two states/actions as similar."
    )
    max_consecutive_similar: int = Field(
        3, ge=1, description="Number of consecutive similar states/actions before flagging a loop."
    )
    loop_action_strategy: str = Field(
        "replan", description="Defines what the agent should do when a loop is detected (e.g., 'replan', 'inject_hint', 'reset_task')."
    )


class RelevancePruningConfig(BaseModel):
    max_context_tokens: int = Field(2000, ge=100, description="Maximum token budget for the pruned historical context.")
    decay_rate: float = Field(
        0.1, ge=0.0, le=1.0, description="Factor for exponentially decaying the relevance score of older context elements."
    )
    min_relevance_score: float = Field(
        0.2, ge=0.0, le=1.0, description="Threshold below which context elements are pruned."
    )


class ReflectionCheckpoint(BaseModel):
    id: str = Field(..., description="Unique identifier for the reflection checkpoint.")
    frequency_type: str = Field(..., description="Type of reflection frequency (e.g., 'steps', 'on_stalled_progress', 'on_error').")
    value: Optional[Union[int, str]] = Field(
        None,
        description="Value based on frequency_type (e.g., number of steps, or a specific string for 'on_stalled_progress')."
    )

class ReflectivePlanningConfig(BaseModel):
    reflection_checkpoints: List[ReflectionCheckpoint] = Field(
        default_factory=list,
        description="Defines when to trigger a reflection step."
    )
    reflection_prompt_template: str = Field(
        ...,
        description="A specific prompt template for the reflection step, distinct from the main system prompt."
    )
    min_steps_before_reflection: int = Field(
        0, ge=0, description="Minimum number of steps before the first reflection can occur."
    )


class GoalDefinition(BaseModel):
    id: str = Field(..., description="Unique identifier for the goal.")
    description: str = Field(..., description="Human-readable goal description.")
    # Condition can be a regex, a reference to a tool output, or a boolean expression.
    # For simplicity, we'll start with a regex pattern. More complex conditions might need a custom validator or AST parsing.
    condition: str = Field(
        ...,
        description="A condition to check for goal achievement (e.g., a regex pattern to match in output).",
        pattern=r"^(?!.*\s{2})[^\s].*$" # Simple regex to ensure it's not just whitespace and has no double spaces. More complex regex patterns could be used if needed.
    )
    # 'achieved' is dynamic state, not part of the static schema, but including it for clarity of purpose
    # achieved: bool = False # This would be part of the runtime state, not the static .af schema


class GoalCheckpointingConfig(BaseModel):
    goals: List[GoalDefinition] = Field(
        default_factory=list,
        description="A list of long-term goals, each with a condition for achievement."
    )
    stale_progress_threshold: int = Field(
        20, ge=1, description="Number of steps without achieving a goal or significant state change before flagging stalled progress."
    )
    stall_action_strategy: str = Field(
        "replan", description="What the agent should do when progress stalls (e.g., 'replan', 'escalate', 'inject_goals')."
    )


class ModuleConfigs(BaseModel):
    semantic_memory: Optional[SemanticMemoryConfig] = Field(
        None, description="Configuration for the Semantic Memory Indexing module."
    )
    loop_detection: Optional[LoopDetectionConfig] = Field(
        None, description="Configuration for the Loop Detection module."
    )
    relevance_pruning: Optional[RelevancePruningConfig] = Field(
        None, description="Configuration for the Relevance Pruning module."
    )
    reflective_planning: Optional[ReflectivePlanningConfig] = Field(
        None, description="Configuration for the Reflective Planning Step module."
    )
    goal_checkpointing: Optional[GoalCheckpointingConfig] = Field(
        None, description="Configuration for the Goal Checkpointing module."
    )


class ToolExecutionConfig(BaseModel):
    timeout_ms: int = Field(60000, ge=1000, description="Default timeout for tool executions in milliseconds.")
    retry_attempts: int = Field(3, ge=0, description="Default number of retries for failed tool calls.")


class RuntimeHooks(BaseModel):
    on_thought_generated: Optional[str] = Field(
        None, description="Reference to a JavaScript function or simple instruction to execute after a thought is generated."
    )
    on_action_executed: Optional[str] = Field(
        None, description="Reference to a JavaScript function or simple instruction to execute after an action is executed."
    )
    on_error: Optional[str] = Field(
        None, description="Reference to a JavaScript function or simple instruction to execute upon an agent error."
    )


class UIPreferences(BaseModel):
    icon_url: Optional[HttpUrl] = Field(None, description="URL to an icon for the agent.")
    color_scheme: Optional[str] = Field(None, description="Preferred color scheme for the agent's UI (e.g., 'dark', 'light', 'blue').")
    display_name: Optional[str] = Field(None, description="A human-friendly name for the agent, if different from 'name'.")


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

    # New / Enhanced Fields
    inference_config: InferenceConfig = Field(
        ..., description="Configuration for LLM inference providers and parameters."
    )
    module_configs: Optional[ModuleConfigs] = Field(
        None, description="Configurations for custom agent modules like memory, loop detection, etc."
    )
    agent_capabilities: List[str] = Field(
        default_factory=list,
        description="High-level declaration of what the agent is allowed to do (e.g., 'internet_access', 'file_system_access', 'code_execution')."
    )
    tool_execution_config: Optional[ToolExecutionConfig] = Field(
        None, description="Default settings for how tools are executed."
    )
    runtime_hooks: Optional[RuntimeHooks] = Field(
        None, description="Hooks for injecting custom behavior into the agent's runtime lifecycle."
    )
    ui_preferences: Optional[UIPreferences] = Field(
        None, description="Preferences for rendering the agent's UI or avatar."
    )

    tags: List[TagSchema]
    tool_exec_environment_variables: List[ToolEnvVarSchema]
    tool_rules: List[ToolRuleSchema]
    tools: List[ToolSchema]
    updated_at: str
    version: str
