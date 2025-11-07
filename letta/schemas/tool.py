from typing import Any, Dict, List, Optional

from pydantic import ConfigDict, Field, model_validator

from letta.constants import (
    FUNCTION_RETURN_CHAR_LIMIT,
    LETTA_BUILTIN_TOOL_MODULE_NAME,
    LETTA_CORE_TOOL_MODULE_NAME,
    LETTA_FILES_TOOL_MODULE_NAME,
    LETTA_MULTI_AGENT_TOOL_MODULE_NAME,
    LETTA_VOICE_TOOL_MODULE_NAME,
    MCP_TOOL_TAG_NAME_PREFIX,
)
from letta.schemas.enums import PrimitiveType

# MCP Tool metadata constants for schema health status
MCP_TOOL_METADATA_SCHEMA_STATUS = f"{MCP_TOOL_TAG_NAME_PREFIX}:SCHEMA_STATUS"
MCP_TOOL_METADATA_SCHEMA_WARNINGS = f"{MCP_TOOL_TAG_NAME_PREFIX}:SCHEMA_WARNINGS"
from letta.functions.functions import get_json_schema_from_module
from letta.functions.mcp_client.types import MCPTool
from letta.functions.schema_generator import generate_tool_schema_for_mcp
from letta.log import get_logger
from letta.schemas.enums import ToolSourceType, ToolType
from letta.schemas.letta_base import LettaBase
from letta.schemas.npm_requirement import NpmRequirement
from letta.schemas.pip_requirement import PipRequirement

logger = get_logger(__name__)


class BaseTool(LettaBase):
    __id_prefix__ = PrimitiveType.TOOL.value


class Tool(BaseTool):
    """Representation of a tool, which is a function that can be called by the agent."""

    id: str = BaseTool.generate_id_field()
    tool_type: ToolType = Field(ToolType.CUSTOM, description="The type of the tool.")
    description: Optional[str] = Field(None, description="The description of the tool.")
    source_type: Optional[str] = Field(None, description="The type of the source code.")
    name: Optional[str] = Field(None, description="The name of the function.")
    tags: List[str] = Field([], description="Metadata tags.")

    # code
    source_code: Optional[str] = Field(None, description="The source code of the function.")
    json_schema: Optional[Dict] = Field(None, description="The JSON schema of the function.")
    args_json_schema: Optional[Dict] = Field(None, description="The args JSON schema of the function.")

    # tool configuration
    return_char_limit: int = Field(
        FUNCTION_RETURN_CHAR_LIMIT,
        description="The maximum number of characters in the response.",
        ge=1,
        le=1_000_000,
    )
    pip_requirements: list[PipRequirement] | None = Field(None, description="Optional list of pip packages required by this tool.")
    npm_requirements: list[NpmRequirement] | None = Field(None, description="Optional list of npm packages required by this tool.")
    default_requires_approval: Optional[bool] = Field(
        None, description="Default value for whether or not executing this tool requires approval."
    )
    enable_parallel_execution: Optional[bool] = Field(
        False, description="If set to True, then this tool will potentially be executed concurrently with other tools. Default False."
    )

    # metadata fields
    created_by_id: Optional[str] = Field(None, description="The id of the user that made this Tool.")
    last_updated_by_id: Optional[str] = Field(None, description="The id of the user that made this Tool.")
    metadata_: Optional[Dict[str, Any]] = Field(default_factory=dict, description="A dictionary of additional metadata for the tool.")

    @model_validator(mode="after")
    def refresh_source_code_and_json_schema(self):
        """
        Refresh name, description, source_code, and json_schema.

        Note: Schema generation for custom tools is now handled at creation/update time in ToolManager.
        This method only handles built-in Letta tools.
        """
        if self.tool_type == ToolType.CUSTOM:
            # Custom tools should already have their schema set during creation/update
            # No schema generation happens here anymore
            if not self.json_schema:
                logger.warning(
                    "Custom tool with id=%s name=%s is missing json_schema. Schema should be set during creation/update.",
                    self.id,
                    self.name,
                )
        elif self.tool_type in {ToolType.LETTA_CORE, ToolType.LETTA_MEMORY_CORE, ToolType.LETTA_SLEEPTIME_CORE}:
            # If it's letta core tool, we generate the json_schema on the fly here
            self.json_schema = get_json_schema_from_module(module_name=LETTA_CORE_TOOL_MODULE_NAME, function_name=self.name)
        elif self.tool_type in {ToolType.LETTA_MULTI_AGENT_CORE}:
            # If it's letta multi-agent tool, we also generate the json_schema on the fly here
            self.json_schema = get_json_schema_from_module(module_name=LETTA_MULTI_AGENT_TOOL_MODULE_NAME, function_name=self.name)
        elif self.tool_type in {ToolType.LETTA_VOICE_SLEEPTIME_CORE}:
            # If it's letta voice tool, we generate the json_schema on the fly here
            self.json_schema = get_json_schema_from_module(module_name=LETTA_VOICE_TOOL_MODULE_NAME, function_name=self.name)
        elif self.tool_type in {ToolType.LETTA_BUILTIN}:
            # If it's letta voice tool, we generate the json_schema on the fly here
            self.json_schema = get_json_schema_from_module(module_name=LETTA_BUILTIN_TOOL_MODULE_NAME, function_name=self.name)
        elif self.tool_type in {ToolType.LETTA_FILES_CORE}:
            # If it's letta files tool, we generate the json_schema on the fly here
            self.json_schema = get_json_schema_from_module(module_name=LETTA_FILES_TOOL_MODULE_NAME, function_name=self.name)

        return self


class ToolCreate(LettaBase):
    description: Optional[str] = Field(None, description="The description of the tool.")
    tags: Optional[List[str]] = Field(None, description="Metadata tags.")
    source_code: str = Field(..., description="The source code of the function.")
    source_type: str = Field("python", description="The source type of the function.")
    json_schema: Optional[Dict] = Field(
        None, description="The JSON schema of the function (auto-generated from source_code if not provided)"
    )
    args_json_schema: Optional[Dict] = Field(None, description="The args JSON schema of the function.")
    return_char_limit: int = Field(
        FUNCTION_RETURN_CHAR_LIMIT,
        description="The maximum number of characters in the response.",
        ge=1,
        le=1_000_000,
    )
    pip_requirements: list[PipRequirement] | None = Field(None, description="Optional list of pip packages required by this tool.")
    npm_requirements: list[NpmRequirement] | None = Field(None, description="Optional list of npm packages required by this tool.")
    default_requires_approval: Optional[bool] = Field(None, description="Whether or not to require approval before executing this tool.")
    enable_parallel_execution: Optional[bool] = Field(
        False, description="If set to True, then this tool will potentially be executed concurrently with other tools. Default False."
    )

    @classmethod
    def from_mcp(cls, mcp_server_name: str, mcp_tool: MCPTool) -> "ToolCreate":
        from letta.functions.helpers import generate_mcp_tool_wrapper

        # Pass the MCP tool to the schema generator
        json_schema = generate_tool_schema_for_mcp(mcp_tool=mcp_tool)

        # Store health status in json_schema metadata if available
        if mcp_tool.health:
            json_schema[MCP_TOOL_METADATA_SCHEMA_STATUS] = mcp_tool.health.status
            json_schema[MCP_TOOL_METADATA_SCHEMA_WARNINGS] = mcp_tool.health.reasons

        # Return a ToolCreate instance
        description = mcp_tool.description
        source_type = "python"
        tags = [f"{MCP_TOOL_TAG_NAME_PREFIX}:{mcp_server_name}"]
        wrapper_func_name, wrapper_function_str = generate_mcp_tool_wrapper(mcp_tool.name)

        return cls(
            description=description,
            source_type=source_type,
            tags=tags,
            source_code=wrapper_function_str,
            json_schema=json_schema,
        )

    def model_dump(self, to_orm: bool = False, **kwargs):
        """
        Override LettaBase.model_dump to explicitly handle 'tags' being None,
        ensuring that the output includes 'tags' as None (or any current value).
        """
        data = super().model_dump(**kwargs)
        # TODO: consider making tags itself optional in the ORM
        # Ensure 'tags' is included even when None, but only if tags is in the dict
        # (i.e., don't add tags if exclude_unset=True was used and tags wasn't set)
        if "tags" in data and data["tags"] is None:
            data["tags"] = []
        return data


class ToolUpdate(LettaBase):
    description: Optional[str] = Field(None, description="The description of the tool.")
    tags: Optional[List[str]] = Field(None, description="Metadata tags.")
    source_code: Optional[str] = Field(None, description="The source code of the function.")
    source_type: Optional[str] = Field(None, description="The type of the source code.")
    json_schema: Optional[Dict] = Field(
        None, description="The JSON schema of the function (auto-generated from source_code if not provided)"
    )
    args_json_schema: Optional[Dict] = Field(None, description="The args JSON schema of the function.")
    return_char_limit: Optional[int] = Field(
        None,
        description="The maximum number of characters in the response.",
        ge=1,
        le=1_000_000,
    )
    pip_requirements: list[PipRequirement] | None = Field(None, description="Optional list of pip packages required by this tool.")
    npm_requirements: list[NpmRequirement] | None = Field(None, description="Optional list of npm packages required by this tool.")
    metadata_: Optional[Dict[str, Any]] = Field(None, description="A dictionary of additional metadata for the tool.")
    default_requires_approval: Optional[bool] = Field(None, description="Whether or not to require approval before executing this tool.")
    enable_parallel_execution: Optional[bool] = Field(
        False, description="If set to True, then this tool will potentially be executed concurrently with other tools. Default False."
    )
    # name: Optional[str] = Field(None, description="The name of the tool (must match the JSON schema name and source code function name).")

    model_config = ConfigDict(extra="ignore")  # Allows extra fields without validation errors
    # TODO: Remove this, and clean usage of ToolUpdate everywhere else


class ToolRunFromSource(LettaBase):
    source_code: str = Field(..., description="The source code of the function.")
    args: Dict[str, Any] = Field(..., description="The arguments to pass to the tool.")
    env_vars: Dict[str, str] = Field(None, description="The environment variables to pass to the tool.")
    name: Optional[str] = Field(None, description="The name of the tool to run.")
    source_type: Optional[str] = Field(None, description="The type of the source code.")
    args_json_schema: Optional[Dict] = Field(None, description="The args JSON schema of the function.")
    json_schema: Optional[Dict] = Field(
        None, description="The JSON schema of the function (auto-generated from source_code if not provided)"
    )
    pip_requirements: list[PipRequirement] | None = Field(None, description="Optional list of pip packages required by this tool.")
    npm_requirements: list[NpmRequirement] | None = Field(None, description="Optional list of npm packages required by this tool.")
