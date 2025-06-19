from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from letta.constants import CORE_MEMORY_LINE_NUMBER_WARNING, DEFAULT_EMBEDDING_CHUNK_SIZE
from letta.helpers import ToolRulesSolver
from letta.schemas.block import CreateBlock
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.environment_variables import AgentEnvironmentVariable
from letta.schemas.file import FileStatus
from letta.schemas.group import Group
from letta.schemas.letta_base import OrmMetadataBase
from letta.schemas.llm_config import LLMConfig
from letta.schemas.memory import Memory
from letta.schemas.message import Message, MessageCreate
from letta.schemas.openai.chat_completion_response import UsageStatistics
from letta.schemas.response_format import ResponseFormatUnion
from letta.schemas.source import Source
from letta.schemas.tool import Tool
from letta.schemas.tool_rule import ToolRule
from letta.utils import create_random_username


class AgentType(str, Enum):
    """
    Enum to represent the type of agent.
    """

    memgpt_agent = "memgpt_agent"
    memgpt_v2_agent = "memgpt_v2_agent"
    split_thread_agent = "split_thread_agent"
    sleeptime_agent = "sleeptime_agent"
    voice_convo_agent = "voice_convo_agent"
    voice_sleeptime_agent = "voice_sleeptime_agent"


class AgentState(OrmMetadataBase, validate_assignment=True):
    """
    Representation of an agent's state. This is the state of the agent at a given time, and is persisted in the DB backend. The state has all the information needed to recreate a persisted agent.

    Parameters:
        id (str): The unique identifier of the agent.
        name (str): The name of the agent (must be unique to the user).
        created_at (datetime): The datetime the agent was created.
        message_ids (List[str]): The ids of the messages in the agent's in-context memory.
        memory (Memory): The in-context memory of the agent.
        tools (List[str]): The tools used by the agent. This includes any memory editing functions specified in `memory`.
        system (str): The system prompt used by the agent.
        llm_config (LLMConfig): The LLM configuration used by the agent.
        embedding_config (EmbeddingConfig): The embedding configuration used by the agent.
    """

    __id_prefix__ = "agent"

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

    # llm information
    llm_config: LLMConfig = Field(..., description="The LLM configuration used by the agent.")
    embedding_config: EmbeddingConfig = Field(..., description="The embedding configuration used by the agent.")
    response_format: Optional[ResponseFormatUnion] = Field(
        None, description="The response format used by the agent when returning from `send_message`."
    )

    # This is an object representing the in-process state of a running `Agent`
    # Field in this object can be theoretically edited by tools, and will be persisted by the ORM
    organization_id: Optional[str] = Field(None, description="The unique identifier of the organization associated with the agent.")

    description: Optional[str] = Field(None, description="The description of the agent.")
    metadata: Optional[Dict] = Field(None, description="The metadata of the agent.")

    memory: Memory = Field(..., description="The in-context memory of the agent.")
    tools: List[Tool] = Field(..., description="The tools used by the agent.")
    sources: List[Source] = Field(..., description="The sources used by the agent.")
    tags: List[str] = Field(..., description="The tags associated with the agent.")
    tool_exec_environment_variables: List[AgentEnvironmentVariable] = Field(
        default_factory=list, description="The environment variables for tool execution specific to this agent."
    )
    project_id: Optional[str] = Field(None, description="The id of the project the agent belongs to.")
    template_id: Optional[str] = Field(None, description="The id of the template the agent belongs to.")
    base_template_id: Optional[str] = Field(None, description="The base template id of the agent.")
    identity_ids: List[str] = Field([], description="The ids of the identities associated with this agent.")

    # An advanced configuration that makes it so this agent does not remember any previous messages
    message_buffer_autoclear: bool = Field(
        False,
        description="If set to True, the agent will not remember previous messages (though the agent will still retain state via core memory blocks and archival/recall memory). Not recommended unless you have an advanced use case.",
    )
    enable_sleeptime: Optional[bool] = Field(
        None,
        description="If set to True, memory management will move to a background agent thread.",
    )

    multi_agent_group: Optional[Group] = Field(None, description="The multi-agent group that this agent manages")

    # Run metrics
    last_run_completion: Optional[datetime] = Field(None, description="The timestamp when the agent last completed a run.")
    last_run_duration_ms: Optional[int] = Field(None, description="The duration in milliseconds of the agent's last run.")

    def get_agent_env_vars_as_dict(self) -> Dict[str, str]:
        # Get environment variables for this agent specifically
        per_agent_env_vars = {}
        for agent_env_var_obj in self.tool_exec_environment_variables:
            per_agent_env_vars[agent_env_var_obj.key] = agent_env_var_obj.value
        return per_agent_env_vars


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
    agent_type: AgentType = Field(default_factory=lambda: AgentType.memgpt_agent, description="The type of agent.")
    llm_config: Optional[LLMConfig] = Field(None, description="The LLM configuration used by the agent.")
    embedding_config: Optional[EmbeddingConfig] = Field(None, description="The embedding configuration used by the agent.")
    # Note: if this is None, then we'll populate with the standard "more human than human" initial message sequence
    # If the client wants to make this empty, then the client can set the arg to an empty list
    initial_message_sequence: Optional[List[MessageCreate]] = Field(
        None, description="The initial set of messages to put in the agent's in-context memory."
    )
    include_base_tools: bool = Field(
        True, description="If true, attaches the Letta core tools (e.g. archival_memory and core_memory related functions)."
    )
    include_multi_agent_tools: bool = Field(
        False, description="If true, attaches the Letta multi-agent tools (e.g. sending a message to another agent)."
    )
    include_base_tool_rules: bool = Field(
        True, description="If true, attaches the Letta base tool rules (e.g. deny all tools not explicitly allowed)."
    )
    description: Optional[str] = Field(None, description="The description of the agent.")
    metadata: Optional[Dict] = Field(None, description="The metadata of the agent.")
    model: Optional[str] = Field(
        None,
        description="The LLM configuration handle used by the agent, specified in the format "
        "provider/model-name, as an alternative to specifying llm_config.",
    )
    embedding: Optional[str] = Field(
        None, description="The embedding configuration handle used by the agent, specified in the format provider/model-name."
    )
    context_window_limit: Optional[int] = Field(None, description="The context window limit used by the agent.")
    embedding_chunk_size: Optional[int] = Field(DEFAULT_EMBEDDING_CHUNK_SIZE, description="The embedding chunk size used by the agent.")
    max_tokens: Optional[int] = Field(
        None,
        description="The maximum number of tokens to generate, including reasoning step. If not set, the model will use its default value.",
    )
    max_reasoning_tokens: Optional[int] = Field(
        None, description="The maximum number of tokens to generate for reasoning step. If not set, the model will use its default value."
    )
    enable_reasoner: Optional[bool] = Field(False, description="Whether to enable internal extended thinking step for a reasoner model.")
    from_template: Optional[str] = Field(None, description="The template id used to configure the agent")
    template: bool = Field(False, description="Whether the agent is a template")
    project: Optional[str] = Field(
        None,
        deprecated=True,
        description="Deprecated: Project should now be passed via the X-Project header instead of in the request body. If using the sdk, this can be done via the new x_project field below.",
    )
    tool_exec_environment_variables: Optional[Dict[str, str]] = Field(
        None, description="The environment variables for tool execution specific to this agent."
    )
    memory_variables: Optional[Dict[str, str]] = Field(None, description="The variables that should be set for the agent.")
    project_id: Optional[str] = Field(None, description="The id of the project the agent belongs to.")
    template_id: Optional[str] = Field(None, description="The id of the template the agent belongs to.")
    base_template_id: Optional[str] = Field(None, description="The base template id of the agent.")
    identity_ids: Optional[List[str]] = Field(None, description="The ids of the identities associated with this agent.")
    message_buffer_autoclear: bool = Field(
        False,
        description="If set to True, the agent will not remember previous messages (though the agent will still retain state via core memory blocks and archival/recall memory). Not recommended unless you have an advanced use case.",
    )
    enable_sleeptime: Optional[bool] = Field(None, description="If set to True, memory management will move to a background agent thread.")
    response_format: Optional[ResponseFormatUnion] = Field(None, description="The response format for the agent.")

    @field_validator("name")
    @classmethod
    def validate_name(cls, name: str) -> str:
        """Validate the requested new agent name (prevent bad inputs)"""

        import re

        if not name:
            # don't check if not provided
            return name

        # Regex for allowed characters (alphanumeric, spaces, hyphens, underscores)
        if not re.match("^[A-Za-z0-9 _-]+$", name):
            raise ValueError("Name contains invalid characters.")

        # Further checks can be added here...
        # TODO

        return name

    @field_validator("model")
    @classmethod
    def validate_model(cls, model: Optional[str]) -> Optional[str]:
        if not model:
            return model

        provider_name, model_name = model.split("/", 1)
        if not provider_name or not model_name:
            raise ValueError("The llm config handle should be in the format provider/model-name")

        return model

    @field_validator("embedding")
    @classmethod
    def validate_embedding(cls, embedding: Optional[str]) -> Optional[str]:
        if not embedding:
            return embedding

        provider_name, embedding_name = embedding.split("/", 1)
        if not provider_name or not embedding_name:
            raise ValueError("The embedding config handle should be in the format provider/model-name")

        return embedding

    @model_validator(mode="after")
    def validate_sleeptime_for_agent_type(self) -> "CreateAgent":
        """Validate that enable_sleeptime is True when agent_type is a specific value"""
        AGENT_TYPES_REQUIRING_SLEEPTIME = {AgentType.voice_convo_agent}

        if self.agent_type in AGENT_TYPES_REQUIRING_SLEEPTIME:
            if not self.enable_sleeptime:
                raise ValueError(f"Agent type {self.agent_type} requires enable_sleeptime to be True")

        return self


class UpdateAgent(BaseModel):
    name: Optional[str] = Field(None, description="The name of the agent.")
    tool_ids: Optional[List[str]] = Field(None, description="The ids of the tools used by the agent.")
    source_ids: Optional[List[str]] = Field(None, description="The ids of the sources used by the agent.")
    block_ids: Optional[List[str]] = Field(None, description="The ids of the blocks used by the agent.")
    tags: Optional[List[str]] = Field(None, description="The tags associated with the agent.")
    system: Optional[str] = Field(None, description="The system prompt used by the agent.")
    tool_rules: Optional[List[ToolRule]] = Field(None, description="The tool rules governing the agent.")
    llm_config: Optional[LLMConfig] = Field(None, description="The LLM configuration used by the agent.")
    embedding_config: Optional[EmbeddingConfig] = Field(None, description="The embedding configuration used by the agent.")
    message_ids: Optional[List[str]] = Field(None, description="The ids of the messages in the agent's in-context memory.")
    description: Optional[str] = Field(None, description="The description of the agent.")
    metadata: Optional[Dict] = Field(None, description="The metadata of the agent.")
    tool_exec_environment_variables: Optional[Dict[str, str]] = Field(
        None, description="The environment variables for tool execution specific to this agent."
    )
    project_id: Optional[str] = Field(None, description="The id of the project the agent belongs to.")
    template_id: Optional[str] = Field(None, description="The id of the template the agent belongs to.")
    base_template_id: Optional[str] = Field(None, description="The base template id of the agent.")
    identity_ids: Optional[List[str]] = Field(None, description="The ids of the identities associated with this agent.")
    message_buffer_autoclear: Optional[bool] = Field(
        None,
        description="If set to True, the agent will not remember previous messages (though the agent will still retain state via core memory blocks and archival/recall memory). Not recommended unless you have an advanced use case.",
    )
    model: Optional[str] = Field(
        None,
        description="The LLM configuration handle used by the agent, specified in the format "
        "provider/model-name, as an alternative to specifying llm_config.",
    )
    embedding: Optional[str] = Field(
        None, description="The embedding configuration handle used by the agent, specified in the format provider/model-name."
    )
    enable_sleeptime: Optional[bool] = Field(None, description="If set to True, memory management will move to a background agent thread.")
    response_format: Optional[ResponseFormatUnion] = Field(None, description="The response format for the agent.")
    last_run_completion: Optional[datetime] = Field(None, description="The timestamp when the agent last completed a run.")
    last_run_duration_ms: Optional[int] = Field(None, description="The duration in milliseconds of the agent's last run.")

    class Config:
        extra = "ignore"  # Ignores extra fields


class AgentStepResponse(BaseModel):
    messages: List[Message] = Field(..., description="The messages generated during the agent's step.")
    heartbeat_request: bool = Field(..., description="Whether the agent requested a heartbeat (i.e. follow-up execution).")
    function_failed: bool = Field(..., description="Whether the agent step ended because a function call failed.")
    in_context_memory_warning: bool = Field(
        ..., description="Whether the agent step ended because the in-context memory is near its limit."
    )
    usage: UsageStatistics = Field(..., description="Usage statistics of the LLM call during the agent's step.")


class AgentStepState(BaseModel):
    step_number: int = Field(..., description="The current step number in the agent loop")
    tool_rules_solver: ToolRulesSolver = Field(..., description="The current state of the ToolRulesSolver")


def get_prompt_template_for_agent_type(agent_type: Optional[AgentType] = None):

    # Sleeptime agents use the MemGPT v2 memory tools (line numbers)
    # MemGPT v2 tools use line-number, so core memory blocks should have line numbers
    if agent_type == AgentType.sleeptime_agent or agent_type == AgentType.memgpt_v2_agent:
        return (
            "<memory_blocks>\nThe following memory blocks are currently engaged in your core memory unit:\n\n"
            "{% for block in blocks %}"
            "<{{ block.label }}>\n"
            "<description>\n"
            "{{ block.description }}\n"
            "</description>\n"
            "<metadata>"
            "{% if block.read_only %}\n- read_only=true{% endif %}\n"
            "- chars_current={{ block.value|length }}\n"
            "- chars_limit={{ block.limit }}\n"
            "</metadata>\n"
            "<value>\n"
            f"{CORE_MEMORY_LINE_NUMBER_WARNING}\n"
            "{% for line in block.value.split('\\n') %}"
            "Line {{ loop.index }}: {{ line }}\n"
            "{% endfor %}"
            "</value>\n"
            "</{{ block.label }}>\n"
            "{% if not loop.last %}\n{% endif %}"
            "{% endfor %}"
            "\n</memory_blocks>"
            "<files>\nThe following memory files are currently accessible:\n\n"
            "{% for block in file_blocks %}"
            f"<file status=\"{{{{ '{FileStatus.open.value}' if block.value else '{FileStatus.closed.value}' }}}}\">\n"
            "<{{ block.label }}>\n"
            "<description>\n"
            "{{ block.description }}\n"
            "</description>\n"
            "<metadata>"
            "{% if block.read_only %}\n- read_only=true{% endif %}\n"
            "- chars_current={{ block.value|length }}\n"
            "- chars_limit={{ block.limit }}\n"
            "</metadata>\n"
            "<value>\n"
            f"{CORE_MEMORY_LINE_NUMBER_WARNING}\n"
            "{% for line in block.value.split('\\n') %}"
            "Line {{ loop.index }}: {{ line }}\n"
            "{% endfor %}"
            "</value>\n"
            "</{{ block.label }}>\n"
            "</file>\n"
            "{% if not loop.last %}\n{% endif %}"
            "{% endfor %}"
            "\n</files>"
        )

    # Default setup (MemGPT), no line numbers
    else:
        return (
            "<memory_blocks>\nThe following memory blocks are currently engaged in your core memory unit:\n\n"
            "{% for block in blocks %}"
            "<{{ block.label }}>\n"
            "<description>\n"
            "{{ block.description }}\n"
            "</description>\n"
            "<metadata>"
            "{% if block.read_only %}\n- read_only=true{% endif %}\n"
            "- chars_current={{ block.value|length }}\n"
            "- chars_limit={{ block.limit }}\n"
            "</metadata>\n"
            "<value>\n"
            "{{ block.value }}\n"
            "</value>\n"
            "</{{ block.label }}>\n"
            "{% if not loop.last %}\n{% endif %}"
            "{% endfor %}"
            "\n</memory_blocks>"
            "<files>\nThe following memory files are currently accessible:\n\n"
            "{% for block in file_blocks %}"
            f"<file status=\"{{{{ '{FileStatus.open.value}' if block.value else '{FileStatus.closed.value}' }}}}\">\n"
            "<{{ block.label }}>\n"
            "<description>\n"
            "{{ block.description }}\n"
            "</description>\n"
            "<metadata>"
            "{% if block.read_only %}\n- read_only=true{% endif %}\n"
            "- chars_current={{ block.value|length }}\n"
            "- chars_limit={{ block.limit }}\n"
            "</metadata>\n"
            "<value>\n"
            "{{ block.value }}\n"
            "</value>\n"
            "</{{ block.label }}>\n"
            "</file>\n"
            "{% if not loop.last %}\n{% endif %}"
            "{% endfor %}"
            "\n</files>"
        )
