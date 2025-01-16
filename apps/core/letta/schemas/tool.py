from typing import Any, Dict, List, Optional

from pydantic import Field, model_validator

from letta.constants import (
    COMPOSIO_TOOL_TAG_NAME,
    FUNCTION_RETURN_CHAR_LIMIT,
    LETTA_CORE_TOOL_MODULE_NAME,
    LETTA_MULTI_AGENT_TOOL_MODULE_NAME,
)
from letta.functions.functions import derive_openai_json_schema, get_json_schema_from_module
from letta.functions.helpers import generate_composio_tool_wrapper, generate_langchain_tool_wrapper
from letta.functions.schema_generator import generate_schema_from_args_schema_v2
from letta.orm.enums import ToolType
from letta.schemas.letta_base import LettaBase


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

    # tool configuration
    return_char_limit: int = Field(FUNCTION_RETURN_CHAR_LIMIT, description="The maximum number of characters in the response.")

    # metadata fields
    created_by_id: Optional[str] = Field(None, description="The id of the user that made this Tool.")
    last_updated_by_id: Optional[str] = Field(None, description="The id of the user that made this Tool.")

    @model_validator(mode="after")
    def populate_missing_fields(self):
        """
        Populate missing fields: name, description, and json_schema.
        """
        if self.tool_type == ToolType.CUSTOM:
            # If it's a custom tool, we need to ensure source_code is present
            if not self.source_code:
                raise ValueError(f"Custom tool with id={self.id} is missing source_code field.")

            # Always derive json_schema for freshest possible json_schema
            # TODO: Instead of checking the tag, we should having `COMPOSIO` as a specific ToolType
            # TODO: We skip this for Composio bc composio json schemas are derived differently
            if not (COMPOSIO_TOOL_TAG_NAME in self.tags):
                self.json_schema = derive_openai_json_schema(source_code=self.source_code)
        elif self.tool_type in {ToolType.LETTA_CORE, ToolType.LETTA_MEMORY_CORE}:
            # If it's letta core tool, we generate the json_schema on the fly here
            self.json_schema = get_json_schema_from_module(module_name=LETTA_CORE_TOOL_MODULE_NAME, function_name=self.name)
        elif self.tool_type in {ToolType.LETTA_MULTI_AGENT_CORE}:
            # If it's letta multi-agent tool, we also generate the json_schema on the fly here
            self.json_schema = get_json_schema_from_module(module_name=LETTA_MULTI_AGENT_TOOL_MODULE_NAME, function_name=self.name)

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
    name: Optional[str] = Field(None, description="The name of the function (auto-generated from source_code if not provided).")
    description: Optional[str] = Field(None, description="The description of the tool.")
    tags: List[str] = Field([], description="Metadata tags.")
    source_code: str = Field(..., description="The source code of the function.")
    source_type: str = Field("python", description="The source type of the function.")
    json_schema: Optional[Dict] = Field(
        None, description="The JSON schema of the function (auto-generated from source_code if not provided)"
    )
    return_char_limit: int = Field(FUNCTION_RETURN_CHAR_LIMIT, description="The maximum number of characters in the response.")

    @classmethod
    def from_composio(cls, action_name: str, api_key: Optional[str] = None) -> "ToolCreate":
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

        if api_key:
            # Pass in an external API key
            composio_toolset = ComposioToolSet(logging_level=LogLevel.ERROR, api_key=api_key)
        else:
            # Use environmental variable
            composio_toolset = ComposioToolSet(logging_level=LogLevel.ERROR)
        composio_tools = composio_toolset.get_tools(actions=[action_name])

        assert len(composio_tools) > 0, "User supplied parameters do not match any Composio tools"
        assert len(composio_tools) == 1, f"User supplied parameters match too many Composio tools; {len(composio_tools)} > 1"

        composio_tool = composio_tools[0]

        description = composio_tool.description
        source_type = "python"
        tags = [COMPOSIO_TOOL_TAG_NAME]
        wrapper_func_name, wrapper_function_str = generate_composio_tool_wrapper(action_name)
        json_schema = generate_schema_from_args_schema_v2(composio_tool.args_schema, name=wrapper_func_name, description=description)

        return cls(
            name=wrapper_func_name,
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
            name=wrapper_func_name,
            description=description,
            source_type=source_type,
            tags=tags,
            source_code=wrapper_function_str,
            json_schema=json_schema,
        )

    @classmethod
    def load_default_langchain_tools(cls) -> List["ToolCreate"]:
        # For now, we only support wikipedia tool
        from langchain_community.tools import WikipediaQueryRun
        from langchain_community.utilities import WikipediaAPIWrapper

        wikipedia_tool = ToolCreate.from_langchain(
            WikipediaQueryRun(api_wrapper=WikipediaAPIWrapper()), {"langchain_community.utilities": "WikipediaAPIWrapper"}
        )

        return [wikipedia_tool]

    @classmethod
    def load_default_composio_tools(cls) -> List["ToolCreate"]:
        pass

        # TODO: Disable composio tools for now
        # TODO: Naming is causing issues
        # calculator = ToolCreate.from_composio(action_name=Action.MATHEMATICAL_CALCULATOR.name)
        # serp_news = ToolCreate.from_composio(action_name=Action.SERPAPI_NEWS_SEARCH.name)
        # serp_google_search = ToolCreate.from_composio(action_name=Action.SERPAPI_SEARCH.name)
        # serp_google_maps = ToolCreate.from_composio(action_name=Action.SERPAPI_GOOGLE_MAPS_SEARCH.name)

        return []


class ToolUpdate(LettaBase):
    description: Optional[str] = Field(None, description="The description of the tool.")
    name: Optional[str] = Field(None, description="The name of the function.")
    tags: Optional[List[str]] = Field(None, description="Metadata tags.")
    source_code: Optional[str] = Field(None, description="The source code of the function.")
    source_type: Optional[str] = Field(None, description="The type of the source code.")
    json_schema: Optional[Dict] = Field(
        None, description="The JSON schema of the function (auto-generated from source_code if not provided)"
    )
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
