from typing import Any, Dict, List, Optional

from pydantic import Field, model_validator

from letta.constants import (
    COMPOSIO_TOOL_TAG_NAME,
    FUNCTION_RETURN_CHAR_LIMIT,
    LETTA_CORE_TOOL_MODULE_NAME,
    LETTA_MULTI_AGENT_TOOL_MODULE_NAME,
    MCP_TOOL_TAG_NAME_PREFIX,
)
from letta.functions.ast_parsers import get_function_name_and_description
from letta.functions.functions import derive_openai_json_schema, get_json_schema_from_module
from letta.functions.helpers import (
    generate_composio_tool_wrapper,
    generate_langchain_tool_wrapper,
    generate_mcp_tool_wrapper,
    generate_model_from_args_json_schema,
)
from letta.functions.mcp_client.types import MCPTool
from letta.functions.schema_generator import (
    generate_schema_from_args_schema_v2,
    generate_tool_schema_for_composio,
    generate_tool_schema_for_mcp,
)
from letta.log import get_logger
from letta.orm.enums import ToolType
from letta.schemas.letta_base import LettaBase

logger = get_logger(__name__)


class BaseTool(LettaBase):
    __id_prefix__ = "tool"


class Tool(BaseTool):
    """
    Representation of a tool, which is a function that can be called by the agent.

    Parameters:
        id (str): The unique identifier of the tool.
        name (str): The name of the function.
        tags (List[str]): Metadata tags.
        source_code (str): The source code of the function.
        json_schema (Dict): The JSON schema of the function.

    """

    id: str = BaseTool.generate_id_field()
    tool_type: ToolType = Field(ToolType.CUSTOM, description="The type of the tool.")
    description: Optional[str] = Field(None, description="The description of the tool.")
    source_type: Optional[str] = Field(None, description="The type of the source code.")
    organization_id: Optional[str] = Field(None, description="The unique identifier of the organization associated with the tool.")
    name: Optional[str] = Field(None, description="The name of the function.")
    tags: List[str] = Field([], description="Metadata tags.")

    # code
    source_code: Optional[str] = Field(None, description="The source code of the function.")
    json_schema: Optional[Dict] = Field(None, description="The JSON schema of the function.")
    args_json_schema: Optional[Dict] = Field(None, description="The args JSON schema of the function.")

    # tool configuration
    return_char_limit: int = Field(FUNCTION_RETURN_CHAR_LIMIT, description="The maximum number of characters in the response.")

    # metadata fields
    created_by_id: Optional[str] = Field(None, description="The id of the user that made this Tool.")
    last_updated_by_id: Optional[str] = Field(None, description="The id of the user that made this Tool.")

    @model_validator(mode="after")
    def refresh_source_code_and_json_schema(self):
        """
        Refresh name, description, source_code, and json_schema.
        """
        if self.tool_type == ToolType.CUSTOM:
            # If it's a custom tool, we need to ensure source_code is present
            if not self.source_code:
                error_msg = f"Custom tool with id={self.id} is missing source_code field."
                logger.error(error_msg)
                raise ValueError(error_msg)

            # Always derive json_schema for freshest possible json_schema
            # TODO: Instead of checking the tag, we should having `COMPOSIO` as a specific ToolType
            # TODO: We skip this for Composio bc composio json schemas are derived differently
            if not (COMPOSIO_TOOL_TAG_NAME in self.tags):
                if self.args_json_schema is not None:
                    name, description = get_function_name_and_description(self.source_code, self.name)
                    args_schema = generate_model_from_args_json_schema(self.args_json_schema)
                    self.json_schema = generate_schema_from_args_schema_v2(
                        args_schema=args_schema,
                        name=name,
                        description=description,
                    )
                else:
                    self.json_schema = derive_openai_json_schema(source_code=self.source_code)
        elif self.tool_type in {ToolType.LETTA_CORE, ToolType.LETTA_MEMORY_CORE}:
            # If it's letta core tool, we generate the json_schema on the fly here
            self.json_schema = get_json_schema_from_module(module_name=LETTA_CORE_TOOL_MODULE_NAME, function_name=self.name)
        elif self.tool_type in {ToolType.LETTA_MULTI_AGENT_CORE}:
            # If it's letta multi-agent tool, we also generate the json_schema on the fly here
            self.json_schema = get_json_schema_from_module(module_name=LETTA_MULTI_AGENT_TOOL_MODULE_NAME, function_name=self.name)

        # At this point, we need to validate that at least json_schema is populated
        if not self.json_schema:
            error_msg = f"Tool with id={self.id} name={self.name} tool_type={self.tool_type} is missing a json_schema."
            logger.error(error_msg)
            raise ValueError(error_msg)

        # Derive name from the JSON schema if not provided
        if not self.name:
            # TODO: This in theory could error, but name should always be on json_schema
            # TODO: Make JSON schema a typed pydantic object
            self.name = self.json_schema.get("name")

        # Derive description from the JSON schema if not provided
        if not self.description:
            # TODO: This in theory could error, but description should always be on json_schema
            # TODO: Make JSON schema a typed pydantic object
            self.description = self.json_schema.get("description")

        return self


class ToolCreate(LettaBase):
    description: Optional[str] = Field(None, description="The description of the tool.")
    tags: List[str] = Field([], description="Metadata tags.")
    source_code: str = Field(..., description="The source code of the function.")
    source_type: str = Field("python", description="The source type of the function.")
    json_schema: Optional[Dict] = Field(
        None, description="The JSON schema of the function (auto-generated from source_code if not provided)"
    )
    args_json_schema: Optional[Dict] = Field(None, description="The args JSON schema of the function.")
    return_char_limit: int = Field(FUNCTION_RETURN_CHAR_LIMIT, description="The maximum number of characters in the response.")

    # TODO should we put the HTTP / API fetch inside from_mcp?
    # async def from_mcp(cls, mcp_server: str, mcp_tool_name: str) -> "ToolCreate":

    @classmethod
    def from_mcp(cls, mcp_server_name: str, mcp_tool: MCPTool) -> "ToolCreate":

        # Get the MCP tool from the MCP server
        # NVM

        # Pass the MCP tool to the schema generator
        json_schema = generate_tool_schema_for_mcp(mcp_tool=mcp_tool)

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

    @classmethod
    def from_composio(cls, action_name: str) -> "ToolCreate":
        """
        Class method to create an instance of Letta-compatible Composio Tool.
        Check https://docs.composio.dev/introduction/intro/overview to look at options for from_composio

        This function will error if we find more than one tool, or 0 tools.

        Args:
            action_name str: A action name to filter tools by.
        Returns:
            Tool: A Letta Tool initialized with attributes derived from the Composio tool.
        """
        from composio import LogLevel
        from composio_langchain import ComposioToolSet

        composio_toolset = ComposioToolSet(logging_level=LogLevel.ERROR)
        composio_action_schemas = composio_toolset.get_action_schemas(actions=[action_name], check_connected_accounts=False)

        assert len(composio_action_schemas) > 0, "User supplied parameters do not match any Composio tools"
        assert (
            len(composio_action_schemas) == 1
        ), f"User supplied parameters match too many Composio tools; {len(composio_action_schemas)} > 1"

        composio_action_schema = composio_action_schemas[0]

        description = composio_action_schema.description
        source_type = "python"
        tags = [COMPOSIO_TOOL_TAG_NAME]
        wrapper_func_name, wrapper_function_str = generate_composio_tool_wrapper(action_name)
        json_schema = generate_tool_schema_for_composio(composio_action_schema.parameters, name=wrapper_func_name, description=description)

        return cls(
            description=description,
            source_type=source_type,
            tags=tags,
            source_code=wrapper_function_str,
            json_schema=json_schema,
        )

    @classmethod
    def from_langchain(
        cls,
        langchain_tool: "LangChainBaseTool",
        additional_imports_module_attr_map: dict[str, str] = None,
    ) -> "ToolCreate":
        """
        Class method to create an instance of Tool from a Langchain tool (must be from langchain_community.tools).

        Args:
            langchain_tool (LangChainBaseTool): An instance of a LangChain BaseTool (BaseTool from LangChain)
            additional_imports_module_attr_map (dict[str, str]): A mapping of module names to attribute name. This is used internally to import all the required classes for the langchain tool. For example, you would pass in `{"langchain_community.utilities": "WikipediaAPIWrapper"}` for `from langchain_community.tools import WikipediaQueryRun`. NOTE: You do NOT need to specify the tool import here, that is done automatically for you.

        Returns:
            Tool: A Letta Tool initialized with attributes derived from the provided LangChain BaseTool object.
        """
        description = langchain_tool.description
        source_type = "python"
        tags = ["langchain"]
        # NOTE: langchain tools may come from different packages
        wrapper_func_name, wrapper_function_str = generate_langchain_tool_wrapper(langchain_tool, additional_imports_module_attr_map)
        json_schema = generate_schema_from_args_schema_v2(langchain_tool.args_schema, name=wrapper_func_name, description=description)

        return cls(
            description=description,
            source_type=source_type,
            tags=tags,
            source_code=wrapper_function_str,
            json_schema=json_schema,
        )


class ToolUpdate(LettaBase):
    description: Optional[str] = Field(None, description="The description of the tool.")
    tags: Optional[List[str]] = Field(None, description="Metadata tags.")
    source_code: Optional[str] = Field(None, description="The source code of the function.")
    source_type: Optional[str] = Field(None, description="The type of the source code.")
    json_schema: Optional[Dict] = Field(
        None, description="The JSON schema of the function (auto-generated from source_code if not provided)"
    )
    args_json_schema: Optional[Dict] = Field(None, description="The args JSON schema of the function.")
    return_char_limit: Optional[int] = Field(None, description="The maximum number of characters in the response.")

    class Config:
        extra = "ignore"  # Allows extra fields without validation errors
        # TODO: Remove this, and clean usage of ToolUpdate everywhere else


class ToolRunFromSource(LettaBase):
    source_code: str = Field(..., description="The source code of the function.")
    args: Dict[str, Any] = Field(..., description="The arguments to pass to the tool.")
    env_vars: Dict[str, str] = Field(None, description="The environment variables to pass to the tool.")
    name: Optional[str] = Field(None, description="The name of the tool to run.")
    source_type: Optional[str] = Field(None, description="The type of the source code.")
    args_json_schema: Optional[Dict] = Field(None, description="The args JSON schema of the function.")
