from datetime import datetime
from enum import Enum
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from letta.constants import CORE_MEMORY_LINE_NUMBER_WARNING, DEFAULT_EMBEDDING_CHUNK_SIZE
from letta.errors import AgentExportProcessingError, LettaInvalidArgumentError
from letta.schemas.block import Block, CreateBlock
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import PrimitiveType
from letta.schemas.environment_variables import AgentEnvironmentVariable
from letta.schemas.file import FileStatus
from letta.schemas.group import Group
from letta.schemas.identity import Identity
from letta.schemas.letta_base import OrmMetadataBase
from letta.schemas.letta_stop_reason import StopReasonType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.memory import Memory
from letta.schemas.message import Message, MessageCreate
from letta.schemas.model import ModelSettingsUnion
from letta.schemas.openai.chat_completion_response import UsageStatistics
from letta.schemas.response_format import ResponseFormatUnion
from letta.schemas.source import Source
from letta.schemas.tool import Tool
from letta.schemas.tool_rule import ToolRule
from letta.utils import calculate_file_defaults_based_on_context_window, create_random_username


# TODO: Remove this upon next OSS release, there's a duplicate AgentType in enums
# TODO: This is done in the interest of time to avoid needing to update the sandbox template IDs on cloud/rebuild
class AgentType(str, Enum):
    """
    Enum to represent the type of agent.
    """

    memgpt_agent = "memgpt_agent"  # the OG set of memgpt tools
    memgpt_v2_agent = "memgpt_v2_agent"  # memgpt style tools, but refreshed
    letta_v1_agent = "letta_v1_agent"  # simplification of the memgpt loop, no heartbeats or forced tool calls
    react_agent = "react_agent"  # basic react agent, no memory tools
    workflow_agent = "workflow_agent"  # workflow with auto-clearing message buffer
    split_thread_agent = "split_thread_agent"
    sleeptime_agent = "sleeptime_agent"
    voice_convo_agent = "voice_convo_agent"
    voice_sleeptime_agent = "voice_sleeptime_agent"


# Relationship field literal type for AgentState include field to join related objects
AgentRelationships = Literal[
    "agent.blocks",
    "agent.identities",
    "agent.managed_group",
    "agent.secrets",
    "agent.sources",
    "agent.tags",
    "agent.tools",
]


class AgentState(OrmMetadataBase, validate_assignment=True):
    """Representation of an agent's state. This is the state of the agent at a given time, and is persisted in the DB backend. The state has all the information needed to recreate a persisted agent."""

    __id_prefix__ = PrimitiveType.AGENT.value

    # NOTE: this is what is returned to the client and also what is used to initialize `Agent`
    id: str = Field(..., description="The id of the agent. Assigned by the database.")
    name: str = Field(..., description="The name of the agent.")
    # tool rules
    tool_rules: Optional[List[ToolRule]] = Field(default=None, description="The list of tool rules.")
    # in-context memory
    message_ids: Optional[List[str]] = Field(default=None, description="The ids of the messages in the agent's in-context memory.")

    # system prompt
    system: str = Field(..., description="The system prompt used by the agent.")

    # agent configuration
    agent_type: AgentType = Field(..., description="The type of agent.")

    # model information
    llm_config: LLMConfig = Field(
        ..., description="Deprecated: Use `model` field instead. The LLM configuration used by the agent.", deprecated=True
    )
    embedding_config: EmbeddingConfig = Field(
        ..., description="Deprecated: Use `embedding` field instead. The embedding configuration used by the agent.", deprecated=True
    )
    model: Optional[str] = Field(None, description="The model handle used by the agent (format: provider/model-name).")
    embedding: Optional[str] = Field(None, description="The embedding model handle used by the agent (format: provider/model-name).")
    model_settings: Optional[ModelSettingsUnion] = Field(None, description="The model settings used by the agent.")

    response_format: Optional[ResponseFormatUnion] = Field(
        None,
        description="The response format used by the agent",
    )

    # This is an object representing the in-process state of a running `Agent`
    # Field in this object can be theoretically edited by tools, and will be persisted by the ORM
    description: Optional[str] = Field(None, description="The description of the agent.")
    metadata: Optional[Dict] = Field(None, description="The metadata of the agent.")

    memory: Memory = Field(..., description="Deprecated: Use `blocks` field instead. The in-context memory of the agent.", deprecated=True)
    blocks: List[Block] = Field(..., description="The memory blocks used by the agent.")
    tools: List[Tool] = Field(..., description="The tools used by the agent.")
    sources: List[Source] = Field(..., description="The sources used by the agent.")
    tags: List[str] = Field(..., description="The tags associated with the agent.")
    tool_exec_environment_variables: List[AgentEnvironmentVariable] = Field(
        default_factory=list,
        description="Deprecated: use `secrets` field instead.",
        deprecated=True,
    )
    secrets: List[AgentEnvironmentVariable] = Field(
        default_factory=list, description="The environment variables for tool execution specific to this agent."
    )
    project_id: Optional[str] = Field(None, description="The id of the project the agent belongs to.")
    template_id: Optional[str] = Field(None, description="The id of the template the agent belongs to.")
    base_template_id: Optional[str] = Field(None, description="The base template id of the agent.")
    deployment_id: Optional[str] = Field(None, description="The id of the deployment.")
    entity_id: Optional[str] = Field(None, description="The id of the entity within the template.")
    identity_ids: List[str] = Field(
        [], description="Deprecated: Use `identities` field instead. The ids of the identities associated with this agent.", deprecated=True
    )
    identities: List[Identity] = Field([], description="The identities associated with this agent.")

    # An advanced configuration that makes it so this agent does not remember any previous messages
    message_buffer_autoclear: bool = Field(
        False,
        description="If set to True, the agent will not remember previous messages (though the agent will still retain state via core memory blocks and archival/recall memory). Not recommended unless you have an advanced use case.",
    )
    enable_sleeptime: Optional[bool] = Field(
        None,
        description="If set to True, memory management will move to a background agent thread.",
    )

    multi_agent_group: Optional[Group] = Field(
        None, description="Deprecated: Use `managed_group` field instead. The multi-agent group that this agent manages.", deprecated=True
    )
    managed_group: Optional[Group] = Field(None, description="The multi-agent group that this agent manages")
    # Run metrics
    last_run_completion: Optional[datetime] = Field(None, description="The timestamp when the agent last completed a run.")
    last_run_duration_ms: Optional[int] = Field(None, description="The duration in milliseconds of the agent's last run.")
    last_stop_reason: Optional[StopReasonType] = Field(None, description="The stop reason from the agent's last run.")

    # timezone
    timezone: Optional[str] = Field(None, description="The timezone of the agent (IANA format).")

    # file related controls
    max_files_open: Optional[int] = Field(
        None,
        description="Maximum number of files that can be open at once for this agent. Setting this too high may exceed the context window, which will break the agent.",
    )
    per_file_view_window_char_limit: Optional[int] = Field(
        None,
        description="The per-file view window character limit for this agent. Setting this too high may exceed the context window, which will break the agent.",
    )

    # indexing controls
    hidden: Optional[bool] = Field(
        None,
        description="If set to True, the agent will be hidden.",
    )

    def get_agent_env_vars_as_dict(self) -> Dict[str, str]:
        # Get environment variables for this agent specifically
        per_agent_env_vars = {}
        for agent_env_var_obj in self.secrets:
            per_agent_env_vars[agent_env_var_obj.key] = agent_env_var_obj.value
        return per_agent_env_vars

    @model_validator(mode="after")
    def set_file_defaults_based_on_context_window(self) -> "AgentState":
        """Set reasonable defaults for file-related fields based on the model's context window size."""
        # Only set defaults if not explicitly provided
        if self.max_files_open is not None and self.per_file_view_window_char_limit is not None:
            return self

        # Get context window size from llm_config
        context_window = self.llm_config.context_window if self.llm_config and self.llm_config.context_window else None

        # Calculate defaults using the helper function
        default_max_files, default_char_limit = calculate_file_defaults_based_on_context_window(context_window)

        # Apply defaults only if not set
        if self.max_files_open is None:
            self.max_files_open = default_max_files
        if self.per_file_view_window_char_limit is None:
            self.per_file_view_window_char_limit = default_char_limit

        return self


class CreateAgent(BaseModel, validate_assignment=True):  #
    # all optional as server can generate defaults
    name: str = Field(default_factory=lambda: create_random_username(), description="The name of the agent.")

    # memory creation
    memory_blocks: Optional[List[CreateBlock]] = Field(
        None,
        description="The blocks to create in the agent's in-context memory.",
    )
    # TODO: This is a legacy field and should be removed ASAP to force `tool_ids` usage
    tools: Optional[List[str]] = Field(None, description="The tools used by the agent.")
    tool_ids: Optional[List[str]] = Field(None, description="The ids of the tools used by the agent.")
    source_ids: Optional[List[str]] = Field(None, description="The ids of the sources used by the agent.")
    block_ids: Optional[List[str]] = Field(None, description="The ids of the blocks used by the agent.")
    tool_rules: Optional[List[ToolRule]] = Field(None, description="The tool rules governing the agent.")
    tags: Optional[List[str]] = Field(None, description="The tags associated with the agent.")
    system: Optional[str] = Field(None, description="The system prompt used by the agent.")
    agent_type: AgentType = Field(default_factory=lambda: AgentType.memgpt_v2_agent, description="The type of agent.")
    # Note: if this is None, then we'll populate with the standard "more human than human" initial message sequence
    # If the client wants to make this empty, then the client can set the arg to an empty list
    initial_message_sequence: Optional[List[MessageCreate]] = Field(
        None, description="The initial set of messages to put in the agent's in-context memory."
    )
    include_base_tools: bool = Field(True, description="If true, attaches the Letta core tools (e.g. core_memory related functions).")
    include_multi_agent_tools: bool = Field(
        False, description="If true, attaches the Letta multi-agent tools (e.g. sending a message to another agent)."
    )
    include_base_tool_rules: Optional[bool] = Field(
        None, description="If true, attaches the Letta base tool rules (e.g. deny all tools not explicitly allowed)."
    )
    include_default_source: bool = Field(  # TODO: get rid of this
        False, description="If true, automatically creates and attaches a default data source for this agent.", deprecated=True
    )
    description: Optional[str] = Field(None, description="The description of the agent.")
    metadata: Optional[Dict] = Field(None, description="The metadata of the agent.")

    # model configuration
    llm_config: Optional[LLMConfig] = Field(
        None, description="Deprecated: Use `model` field instead. The LLM configuration used by the agent.", deprecated=True
    )
    embedding_config: Optional[EmbeddingConfig] = Field(
        None, description="Deprecated: Use `embedding` field instead. The embedding configuration used by the agent.", deprecated=True
    )
    model: Optional[str] = Field(  # TODO: make this required  (breaking change)
        None,
        description="The model handle for the agent to use (format: provider/model-name).",
    )
    embedding: Optional[str] = Field(None, description="The embedding model handle used by the agent (format: provider/model-name).")
    model_settings: Optional[ModelSettingsUnion] = Field(None, description="The model settings for the agent.")

    context_window_limit: Optional[int] = Field(None, description="The context window limit used by the agent.")
    embedding_chunk_size: Optional[int] = Field(
        DEFAULT_EMBEDDING_CHUNK_SIZE, description="Deprecated: No longer used. The embedding chunk size used by the agent.", deprecated=True
    )
    max_tokens: Optional[int] = Field(
        None,
        description="Deprecated: Use `model` field to configure max output tokens instead. The maximum number of tokens to generate, including reasoning step.",
        deprecated=True,
    )
    max_reasoning_tokens: Optional[int] = Field(
        None,
        description="Deprecated: Use `model` field to configure reasoning tokens instead. The maximum number of tokens to generate for reasoning step.",
        deprecated=True,
    )
    enable_reasoner: Optional[bool] = Field(
        True,
        description="Deprecated: Use `model` field to configure reasoning instead. Whether to enable internal extended thinking step for a reasoner model.",
        deprecated=True,
    )
    reasoning: Optional[bool] = Field(
        None,
        description="Deprecated: Use `model` field to configure reasoning instead. Whether to enable reasoning for this agent.",
        deprecated=True,
    )
    from_template: Optional[str] = Field(
        None, description="Deprecated: please use the 'create agents from a template' endpoint instead.", deprecated=True
    )
    template: bool = Field(False, description="Deprecated: No longer used.", deprecated=True)
    project: Optional[str] = Field(
        None,
        deprecated=True,
        description="Deprecated: Project should now be passed via the X-Project header instead of in the request body. If using the SDK, this can be done via the x_project parameter.",
    )
    tool_exec_environment_variables: Optional[Dict[str, str]] = Field(
        None, description="Deprecated: Use `secrets` field instead. Environment variables for tool execution.", deprecated=True
    )
    secrets: Optional[Dict[str, str]] = Field(None, description="The environment variables for tool execution specific to this agent.")
    memory_variables: Optional[Dict[str, str]] = Field(
        None,
        description="Deprecated: Only relevant for creating agents from a template. Use the 'create agents from a template' endpoint instead.",
        deprecated=True,
    )
    project_id: Optional[str] = Field(
        None, description="Deprecated: No longer used. The id of the project the agent belongs to.", deprecated=True
    )
    template_id: Optional[str] = Field(
        None, description="Deprecated: No longer used. The id of the template the agent belongs to.", deprecated=True
    )
    base_template_id: Optional[str] = Field(
        None, description="Deprecated: No longer used. The base template id of the agent.", deprecated=True
    )
    identity_ids: Optional[List[str]] = Field(None, description="The ids of the identities associated with this agent.")
    message_buffer_autoclear: bool = Field(
        False,
        description="If set to True, the agent will not remember previous messages (though the agent will still retain state via core memory blocks and archival/recall memory). Not recommended unless you have an advanced use case.",
    )
    enable_sleeptime: Optional[bool] = Field(None, description="If set to True, memory management will move to a background agent thread.")
    response_format: Optional[ResponseFormatUnion] = Field(None, description="The response format for the agent.")
    timezone: Optional[str] = Field(None, description="The timezone of the agent (IANA format).")
    max_files_open: Optional[int] = Field(
        None,
        description="Maximum number of files that can be open at once for this agent. Setting this too high may exceed the context window, which will break the agent.",
    )
    per_file_view_window_char_limit: Optional[int] = Field(
        None,
        description="The per-file view window character limit for this agent. Setting this too high may exceed the context window, which will break the agent.",
    )
    hidden: Optional[bool] = Field(
        None,
        description="Deprecated: No longer used. If set to True, the agent will be hidden.",
        deprecated=True,
    )
    parallel_tool_calls: Optional[bool] = Field(
        False,
        description="Deprecated: Use `model` field to configure parallel tool calls instead. If set to True, enables parallel tool calling.",
        deprecated=True,
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, name: str) -> str:
        """Validate the requested new agent name (prevent bad inputs)"""

        import re

        if not name:
            # don't check if not provided
            return name

        # Regex for allowed characters (Unicode letters, digits, spaces, hyphens, underscores, apostrophes)
        # \w in Python 3 with re.UNICODE matches Unicode letters, digits, and underscores
        # We explicitly allow: letters (any language), digits, spaces, hyphens, underscores, apostrophes
        # We block filesystem-unsafe characters: / \ : * ? " < > |
        if not re.match(r"^[\w '\-]+$", name, re.UNICODE):
            raise AgentExportProcessingError(
                f"Agent name '{name}' contains invalid characters. Only letters (any language), digits, spaces, "
                f"hyphens, underscores, and apostrophes are allowed. Please avoid filesystem-unsafe characters "
                f'like: / \\ : * ? " < > |'
            )

        # Further checks can be added here...
        # TODO

        return name

    @field_validator("model")
    @classmethod
    def validate_model(cls, model: Optional[str]) -> Optional[str]:
        if not model:
            return model

        if "/" not in model:
            raise LettaInvalidArgumentError("The model handle should be in the format provider/model-name", argument_name="model")

        provider_name, model_name = model.split("/", 1)
        if not provider_name or not model_name:
            raise LettaInvalidArgumentError("The model handle should be in the format provider/model-name", argument_name="model")

        return model

    @field_validator("embedding")
    @classmethod
    def validate_embedding(cls, embedding: Optional[str]) -> Optional[str]:
        if not embedding:
            return embedding

        if "/" not in embedding:
            raise ValueError("The embedding handle should be in the format provider/model-name")

        provider_name, embedding_name = embedding.split("/", 1)
        if not provider_name or not embedding_name:
            raise ValueError("The embedding handle should be in the format provider/model-name")

        return embedding

    @model_validator(mode="after")
    def validate_sleeptime_for_agent_type(self) -> "CreateAgent":
        """Validate that enable_sleeptime is True when agent_type is a specific value"""
        AGENT_TYPES_REQUIRING_SLEEPTIME = {AgentType.voice_convo_agent}

        if self.agent_type in AGENT_TYPES_REQUIRING_SLEEPTIME:
            if not self.enable_sleeptime:
                raise ValueError(f"Agent type {self.agent_type} requires enable_sleeptime to be True")

        return self


class InternalTemplateAgentCreate(CreateAgent):
    """Used for Letta Cloud"""

    base_template_id: str = Field(..., description="The id of the base template.")
    template_id: str = Field(..., description="The id of the template.")
    deployment_id: str = Field(..., description="The id of the deployment.")
    entity_id: str = Field(..., description="The id of the entity within the template.")


class UpdateAgent(BaseModel):
    name: Optional[str] = Field(None, description="The name of the agent.")
    tool_ids: Optional[List[str]] = Field(None, description="The ids of the tools used by the agent.")
    source_ids: Optional[List[str]] = Field(None, description="The ids of the sources used by the agent.")
    block_ids: Optional[List[str]] = Field(None, description="The ids of the blocks used by the agent.")
    tags: Optional[List[str]] = Field(None, description="The tags associated with the agent.")
    system: Optional[str] = Field(None, description="The system prompt used by the agent.")
    tool_rules: Optional[List[ToolRule]] = Field(None, description="The tool rules governing the agent.")
    message_ids: Optional[List[str]] = Field(None, description="The ids of the messages in the agent's in-context memory.")
    description: Optional[str] = Field(None, description="The description of the agent.")
    metadata: Optional[Dict] = Field(None, description="The metadata of the agent.")
    tool_exec_environment_variables: Optional[Dict[str, str]] = Field(None, description="Deprecated: use `secrets` field instead")
    secrets: Optional[Dict[str, str]] = Field(None, description="The environment variables for tool execution specific to this agent.")
    project_id: Optional[str] = Field(None, description="The id of the project the agent belongs to.")
    template_id: Optional[str] = Field(None, description="The id of the template the agent belongs to.")
    base_template_id: Optional[str] = Field(None, description="The base template id of the agent.")
    identity_ids: Optional[List[str]] = Field(None, description="The ids of the identities associated with this agent.")
    message_buffer_autoclear: Optional[bool] = Field(
        None,
        description="If set to True, the agent will not remember previous messages (though the agent will still retain state via core memory blocks and archival/recall memory). Not recommended unless you have an advanced use case.",
    )

    # model configuration
    model: Optional[str] = Field(
        None,
        description="The model handle used by the agent (format: provider/model-name).",
    )
    embedding: Optional[str] = Field(None, description="The embedding model handle used by the agent (format: provider/model-name).")
    model_settings: Optional[ModelSettingsUnion] = Field(None, description="The model settings for the agent.")
    context_window_limit: Optional[int] = Field(None, description="The context window limit used by the agent.")
    reasoning: Optional[bool] = Field(
        None,
        description="Deprecated: Use `model` field to configure reasoning instead. Whether to enable reasoning for this agent.",
        deprecated=True,
    )
    llm_config: Optional[LLMConfig] = Field(
        None, description="Deprecated: Use `model` field instead. The LLM configuration used by the agent.", deprecated=True
    )
    embedding_config: Optional[EmbeddingConfig] = Field(None, description="The embedding configuration used by the agent.")
    parallel_tool_calls: Optional[bool] = Field(
        False,
        description="Deprecated: Use `model` field to configure parallel tool calls instead. If set to True, enables parallel tool calling.",
        deprecated=True,
    )
    response_format: Optional[ResponseFormatUnion] = Field(
        None,
        description="Deprecated: Use `model` field to configure response format instead. The response format for the agent.",
        deprecated=True,
    )
    max_tokens: Optional[int] = Field(
        None,
        description="Deprecated: Use `model` field to configure max output tokens instead. The maximum number of tokens to generate, including reasoning step.",
        deprecated=True,
    )

    enable_sleeptime: Optional[bool] = Field(None, description="If set to True, memory management will move to a background agent thread.")
    last_run_completion: Optional[datetime] = Field(None, description="The timestamp when the agent last completed a run.")
    last_run_duration_ms: Optional[int] = Field(None, description="The duration in milliseconds of the agent's last run.")
    last_stop_reason: Optional[StopReasonType] = Field(None, description="The stop reason from the agent's last run.")
    timezone: Optional[str] = Field(None, description="The timezone of the agent (IANA format).")
    max_files_open: Optional[int] = Field(
        None,
        description="Maximum number of files that can be open at once for this agent. Setting this too high may exceed the context window, which will break the agent.",
    )
    per_file_view_window_char_limit: Optional[int] = Field(
        None,
        description="The per-file view window character limit for this agent. Setting this too high may exceed the context window, which will break the agent.",
    )
    hidden: Optional[bool] = Field(
        None,
        description="If set to True, the agent will be hidden.",
    )

    model_config = ConfigDict(extra="ignore")  # Ignores extra fields


class AgentStepResponse(BaseModel):
    messages: List[Message] = Field(..., description="The messages generated during the agent's step.")
    heartbeat_request: bool = Field(..., description="Whether the agent requested a heartbeat (i.e. follow-up execution).")
    function_failed: bool = Field(..., description="Whether the agent step ended because a function call failed.")
    in_context_memory_warning: bool = Field(
        ..., description="Whether the agent step ended because the in-context memory is near its limit."
    )
    usage: UsageStatistics = Field(..., description="Usage statistics of the LLM call during the agent's step.")


def get_prompt_template_for_agent_type(agent_type: Optional[AgentType] = None):
    """Deprecated. Templates are not used anymore; fast renderer handles formatting."""
    return ""
