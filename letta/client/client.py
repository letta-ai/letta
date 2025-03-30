import logging
import sys
import time
from typing import Callable, Dict, Generator, List, Optional, Union

import requests

import letta.utils
from letta.constants import ADMIN_PREFIX, BASE_MEMORY_TOOLS, BASE_TOOLS, DEFAULT_HUMAN, DEFAULT_PERSONA, FUNCTION_RETURN_CHAR_LIMIT
from letta.data_sources.connectors import DataConnector
from letta.functions.functions import parse_source_code
from letta.orm.errors import NoResultFound
from letta.schemas.agent import AgentState, AgentType, CreateAgent, UpdateAgent
from letta.schemas.block import Block, BlockUpdate, CreateBlock, Human, Persona
from letta.schemas.embedding_config import EmbeddingConfig

# new schemas
from letta.schemas.enums import JobStatus, MessageRole
from letta.schemas.environment_variables import (
    SandboxEnvironmentVariable,
    SandboxEnvironmentVariableCreate,
    SandboxEnvironmentVariableUpdate,
)
from letta.schemas.file import FileMetadata
from letta.schemas.job import Job
from letta.schemas.letta_message import LettaMessage, LettaMessageUnion
from letta.schemas.letta_request import LettaRequest, LettaStreamingRequest
from letta.schemas.letta_response import LettaResponse, LettaStreamingResponse
from letta.schemas.llm_config import LLMConfig
from letta.schemas.memory import ArchivalMemorySummary, ChatMemory, CreateArchivalMemory, Memory, RecallMemorySummary
from letta.schemas.message import Message, MessageCreate
from letta.schemas.openai.chat_completion_response import UsageStatistics
from letta.schemas.organization import Organization
from letta.schemas.passage import Passage
from letta.schemas.run import Run
from letta.schemas.sandbox_config import E2BSandboxConfig, LocalSandboxConfig, SandboxConfig, SandboxConfigCreate, SandboxConfigUpdate
from letta.schemas.source import Source, SourceCreate, SourceUpdate
from letta.schemas.tool import Tool, ToolCreate, ToolUpdate
from letta.schemas.tool_rule import BaseToolRule
from letta.server.rest_api.interface import QueuingInterface
from letta.utils import get_human_text, get_persona_text

# Print deprecation notice in yellow when module is imported
print(
    "\n\n\033[93m"
    + "DEPRECATION WARNING: This legacy Python client has been deprecated and will be removed in a future release.\n"
    + "Please migrate to the new official python SDK by running: pip install letta-client\n"
    + "For further documentation, visit: https://docs.letta.com/api-reference/overview#python-sdk"
    + "\033[0m\n\n",
    file=sys.stderr,
)


def create_client(base_url: Optional[str] = None, token: Optional[str] = None):
    if base_url is None:
        return LocalClient()
    else:
        return RESTClient(base_url, token)


class AbstractClient(object):
    def __init__(
        self,
        debug: bool = False,
    ):
        self.debug = debug

    def agent_exists(self, agent_id: Optional[str] = None, agent_name: Optional[str] = None) -> bool:
        raise NotImplementedError

    def create_agent(
        self,
        name: Optional[str] = None,
        agent_type: Optional[AgentType] = AgentType.memgpt_agent,
        embedding_config: Optional[EmbeddingConfig] = None,
        llm_config: Optional[LLMConfig] = None,
        memory=None,
        block_ids: Optional[List[str]] = None,
        system: Optional[str] = None,
        tool_ids: Optional[List[str]] = None,
        tool_rules: Optional[List[BaseToolRule]] = None,
        include_base_tools: Optional[bool] = True,
        metadata: Optional[Dict] = {"human:": DEFAULT_HUMAN, "persona": DEFAULT_PERSONA},
        description: Optional[str] = None,
        tags: Optional[List[str]] = None,
        message_buffer_autoclear: bool = False,
    ) -> AgentState:
        raise NotImplementedError

    def update_agent(
        self,
        agent_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        system: Optional[str] = None,
        tool_ids: Optional[List[str]] = None,
        metadata: Optional[Dict] = None,
        llm_config: Optional[LLMConfig] = None,
        embedding_config: Optional[EmbeddingConfig] = None,
        message_ids: Optional[List[str]] = None,
        memory: Optional[Memory] = None,
        tags: Optional[List[str]] = None,
    ):
        raise NotImplementedError

    def get_tools_from_agent(self, agent_id: str) -> List[Tool]:
        raise NotImplementedError

    def attach_tool(self, agent_id: str, tool_id: str) -> AgentState:
        raise NotImplementedError

    def detach_tool(self, agent_id: str, tool_id: str) -> AgentState:
        raise NotImplementedError

    def rename_agent(self, agent_id: str, new_name: str) -> AgentState:
        raise NotImplementedError

    def delete_agent(self, agent_id: str) -> None:
        raise NotImplementedError

    def get_agent(self, agent_id: str) -> AgentState:
        raise NotImplementedError

    def get_agent_id(self, agent_name: str) -> AgentState:
        raise NotImplementedError

    def get_in_context_memory(self, agent_id: str) -> Memory:
        raise NotImplementedError

    def update_in_context_memory(self, agent_id: str, section: str, value: Union[List[str], str]) -> Memory:
        raise NotImplementedError

    def get_archival_memory_summary(self, agent_id: str) -> ArchivalMemorySummary:
        raise NotImplementedError

    def get_recall_memory_summary(self, agent_id: str) -> RecallMemorySummary:
        raise NotImplementedError

    def get_in_context_messages(self, agent_id: str) -> List[Message]:
        raise NotImplementedError

    def send_message(
        self,
        message: str,
        role: str,
        agent_id: Optional[str] = None,
        name: Optional[str] = None,
        stream: Optional[bool] = False,
        stream_steps: bool = False,
        stream_tokens: bool = False,
    ) -> LettaResponse:
        raise NotImplementedError

    def user_message(self, agent_id: str, message: str) -> LettaResponse:
        raise NotImplementedError

    def create_human(self, name: str, text: str) -> Human:
        raise NotImplementedError

    def create_persona(self, name: str, text: str) -> Persona:
        raise NotImplementedError

    def list_humans(self) -> List[Human]:
        raise NotImplementedError

    def list_personas(self) -> List[Persona]:
        raise NotImplementedError

    def update_human(self, human_id: str, text: str) -> Human:
        raise NotImplementedError

    def update_persona(self, persona_id: str, text: str) -> Persona:
        raise NotImplementedError

    def get_persona(self, id: str) -> Persona:
        raise NotImplementedError

    def get_human(self, id: str) -> Human:
        raise NotImplementedError

    def get_persona_id(self, name: str) -> str:
        raise NotImplementedError

    def get_human_id(self, name: str) -> str:
        raise NotImplementedError

    def delete_persona(self, id: str):
        raise NotImplementedError

    def delete_human(self, id: str):
        raise NotImplementedError

    def load_langchain_tool(self, langchain_tool: "LangChainBaseTool", additional_imports_module_attr_map: dict[str, str] = None) -> Tool:
        raise NotImplementedError

    def load_composio_tool(self, action: "ActionType") -> Tool:
        raise NotImplementedError

    def create_tool(self, func, tags: Optional[List[str]] = None, return_char_limit: int = FUNCTION_RETURN_CHAR_LIMIT) -> Tool:
        raise NotImplementedError

    def create_or_update_tool(self, func, tags: Optional[List[str]] = None, return_char_limit: int = FUNCTION_RETURN_CHAR_LIMIT) -> Tool:
        raise NotImplementedError

    def update_tool(
        self,
        id: str,
        description: Optional[str] = None,
        func: Optional[Callable] = None,
        tags: Optional[List[str]] = None,
        return_char_limit: int = FUNCTION_RETURN_CHAR_LIMIT,
    ) -> Tool:
        raise NotImplementedError

    def list_tools(self, after: Optional[str] = None, limit: Optional[int] = 50) -> List[Tool]:
        raise NotImplementedError

    def get_tool(self, id: str) -> Tool:
        raise NotImplementedError

    def delete_tool(self, id: str):
        raise NotImplementedError

    def get_tool_id(self, name: str) -> Optional[str]:
        raise NotImplementedError

    def list_attached_tools(self, agent_id: str) -> List[Tool]:
        """
        List all tools attached to an agent.

        Args:
            agent_id (str): ID of the agent

        Returns:
            List[Tool]: A list of attached tools
        """
        raise NotImplementedError

    def upsert_base_tools(self) -> List[Tool]:
        raise NotImplementedError

    def load_data(self, connector: DataConnector, source_name: str):
        raise NotImplementedError

    def load_file_to_source(self, filename: str, source_id: str, blocking=True) -> Job:
        raise NotImplementedError

    def delete_file_from_source(self, source_id: str, file_id: str) -> None:
        raise NotImplementedError

    def create_source(self, name: str, embedding_config: Optional[EmbeddingConfig] = None) -> Source:
        raise NotImplementedError

    def delete_source(self, source_id: str):
        raise NotImplementedError

    def get_source(self, source_id: str) -> Source:
        raise NotImplementedError

    def get_source_id(self, source_name: str) -> str:
        raise NotImplementedError

    def attach_source(self, agent_id: str, source_id: Optional[str] = None, source_name: Optional[str] = None) -> AgentState:
        raise NotImplementedError

    def detach_source(self, agent_id: str, source_id: Optional[str] = None, source_name: Optional[str] = None) -> AgentState:
        raise NotImplementedError

    def list_sources(self) -> List[Source]:
        raise NotImplementedError

    def list_attached_sources(self, agent_id: str) -> List[Source]:
        raise NotImplementedError

    def list_files_from_source(self, source_id: str, limit: int = 1000, after: Optional[str] = None) -> List[FileMetadata]:
        raise NotImplementedError

    def update_source(self, source_id: str, name: Optional[str] = None) -> Source:
        raise NotImplementedError

    def insert_archival_memory(self, agent_id: str, memory: str) -> List[Passage]:
        raise NotImplementedError

    def delete_archival_memory(self, agent_id: str, memory_id: str):
        raise NotImplementedError

    def get_archival_memory(
        self, agent_id: str, after: Optional[str] = None, before: Optional[str] = None, limit: Optional[int] = 1000
    ) -> List[Passage]:
        raise NotImplementedError

    def get_messages(
        self, agent_id: str, after: Optional[str] = None, before: Optional[str] = None, limit: Optional[int] = 1000
    ) -> List[LettaMessage]:
        raise NotImplementedError

    def list_model_configs(self) -> List[LLMConfig]:
        raise NotImplementedError

    def list_embedding_configs(self) -> List[EmbeddingConfig]:
        raise NotImplementedError

    def create_org(self, name: Optional[str] = None) -> Organization:
        raise NotImplementedError

    def list_orgs(self, after: Optional[str] = None, limit: Optional[int] = 50) -> List[Organization]:
        raise NotImplementedError

    def delete_org(self, org_id: str) -> Organization:
        raise NotImplementedError

    def create_sandbox_config(self, config: Union[LocalSandboxConfig, E2BSandboxConfig]) -> SandboxConfig:
        """
        Create a new sandbox configuration.

        Args:
            config (Union[LocalSandboxConfig, E2BSandboxConfig]): The sandbox settings.

        Returns:
            SandboxConfig: The created sandbox configuration.
        """
        raise NotImplementedError

    def update_sandbox_config(self, sandbox_config_id: str, config: Union[LocalSandboxConfig, E2BSandboxConfig]) -> SandboxConfig:
        """
        Update an existing sandbox configuration.

        Args:
            sandbox_config_id (str): The ID of the sandbox configuration to update.
            config (Union[LocalSandboxConfig, E2BSandboxConfig]): The updated sandbox settings.

        Returns:
            SandboxConfig: The updated sandbox configuration.
        """
        raise NotImplementedError

    def delete_sandbox_config(self, sandbox_config_id: str) -> None:
        """
        Delete a sandbox configuration.

        Args:
            sandbox_config_id (str): The ID of the sandbox configuration to delete.
        """
        raise NotImplementedError

    def list_sandbox_configs(self, limit: int = 50, after: Optional[str] = None) -> List[SandboxConfig]:
        """
        List all sandbox configurations.

        Args:
            limit (int, optional): The maximum number of sandbox configurations to return. Defaults to 50.
            after (Optional[str], optional): The pagination cursor for retrieving the next set of results.

        Returns:
            List[SandboxConfig]: A list of sandbox configurations.
        """
        raise NotImplementedError

    def create_sandbox_env_var(
        self, sandbox_config_id: str, key: str, value: str, description: Optional[str] = None
    ) -> SandboxEnvironmentVariable:
        """
        Create a new environment variable for a sandbox configuration.

        Args:
            sandbox_config_id (str): The ID of the sandbox configuration to associate the environment variable with.
            key (str): The name of the environment variable.
            value (str): The value of the environment variable.
            description (Optional[str], optional): A description of the environment variable. Defaults to None.

        Returns:
            SandboxEnvironmentVariable: The created environment variable.
        """
        raise NotImplementedError

    def update_sandbox_env_var(
        self, env_var_id: str, key: Optional[str] = None, value: Optional[str] = None, description: Optional[str] = None
    ) -> SandboxEnvironmentVariable:
        """
        Update an existing environment variable.

        Args:
            env_var_id (str): The ID of the environment variable to update.
            key (Optional[str], optional): The updated name of the environment variable. Defaults to None.
            value (Optional[str], optional): The updated value of the environment variable. Defaults to None.
            description (Optional[str], optional): The updated description of the environment variable. Defaults to None.

        Returns:
            SandboxEnvironmentVariable: The updated environment variable.
        """
        raise NotImplementedError

    def delete_sandbox_env_var(self, env_var_id: str) -> None:
        """
        Delete an environment variable by its ID.

        Args:
            env_var_id (str): The ID of the environment variable to delete.
        """
        raise NotImplementedError

    def list_sandbox_env_vars(
        self, sandbox_config_id: str, limit: int = 50, after: Optional[str] = None
    ) -> List[SandboxEnvironmentVariable]:
        """
        List all environment variables associated with a sandbox configuration.

        Args:
            sandbox_config_id (str): The ID of the sandbox configuration to retrieve environment variables for.
            limit (int, optional): The maximum number of environment variables to return. Defaults to 50.
            after (Optional[str], optional): The pagination cursor for retrieving the next set of results.

        Returns:
            List[SandboxEnvironmentVariable]: A list of environment variables.
        """
        raise NotImplementedError

    def attach_block(self, agent_id: str, block_id: str) -> AgentState:
        """
        Attach a block to an agent.

        Args:
            agent_id (str): ID of the agent
            block_id (str): ID of the block to attach
        """
        raise NotImplementedError

    def detach_block(self, agent_id: str, block_id: str) -> AgentState:
        """
        Detach a block from an agent.

        Args:
            agent_id (str): ID of the agent
            block_id (str): ID of the block to detach
        """
        raise NotImplementedError


class RESTClient(AbstractClient):
    """
    REST client for Letta

    Attributes:
        base_url (str): Base URL of the REST API
        headers (Dict): Headers for the REST API (includes token)
    """

    def __init__(
        self,
        base_url: str,
        token: Optional[str] = None,
        password: Optional[str] = None,
        api_prefix: str = "v1",
        debug: bool = False,
        default_llm_config: Optional[LLMConfig] = None,
        default_embedding_config: Optional[EmbeddingConfig] = None,
        headers: Optional[Dict] = None,
    ):
        """
        Initializes a new instance of Client class.

        Args:
            user_id (str): The user ID.
            debug (bool): Whether to print debug information.
            default_llm_config (Optional[LLMConfig]): The default LLM configuration.
            default_embedding_config (Optional[EmbeddingConfig]): The default embedding configuration.
            headers (Optional[Dict]): The additional headers for the REST API.
            token (Optional[str]): The token for the REST API when using managed letta service.
            password (Optional[str]): The password for the REST API when using self hosted letta service.
        """
        super().__init__(debug=debug)
        self.base_url = base_url
        self.api_prefix = api_prefix
        if token:
            self.headers = {"accept": "application/json", "Authorization": f"Bearer {token}"}
        elif password:
            self.headers = {"accept": "application/json", "Authorization": f"Bearer {password}"}
        else:
            self.headers = {"accept": "application/json"}
        if headers:
            self.headers.update(headers)
        self._default_llm_config = default_llm_config
        self._default_embedding_config = default_embedding_config

    def list_agents(
        self,
        tags: Optional[List[str]] = None,
        query_text: Optional[str] = None,
        limit: int = 50,
        before: Optional[str] = None,
        after: Optional[str] = None,
    ) -> List[AgentState]:
        params = {"limit": limit}
        if tags:
            params["tags"] = tags
            params["match_all_tags"] = False

        if query_text:
            params["query_text"] = query_text

        if before:
            params["before"] = before

        if after:
            params["after"] = after

        response = requests.get(f"{self.base_url}/{self.api_prefix}/agents", headers=self.headers, params=params)
        return [AgentState(**agent) for agent in response.json()]

    def agent_exists(self, agent_id: str) -> bool:
        """
        Check if an agent exists

        Args:
            agent_id (str): ID of the agent
            agent_name (str): Name of the agent

        Returns:
            exists (bool): `True` if the agent exists, `False` otherwise
        """

        response = requests.get(f"{self.base_url}/{self.api_prefix}/agents/{agent_id}", headers=self.headers)
        if response.status_code == 404:
            # not found error
            return False
        elif response.status_code == 200:
            return True
        else:
            raise ValueError(f"Failed to check if agent exists: {response.text}")

    def create_agent(
        self,
        name: Optional[str] = None,
        # agent config
        agent_type: Optional[AgentType] = AgentType.memgpt_agent,
        # model configs
        embedding_config: EmbeddingConfig = None,
        llm_config: LLMConfig = None,
        # memory
        memory: Memory = ChatMemory(human=get_human_text(DEFAULT_HUMAN), persona=get_persona_text(DEFAULT_PERSONA)),
        # Existing blocks
        block_ids: Optional[List[str]] = None,
        # system
        system: Optional[str] = None,
        # tools
        tool_ids: Optional[List[str]] = None,
        tool_rules: Optional[List[BaseToolRule]] = None,
        include_base_tools: Optional[bool] = True,
        include_multi_agent_tools: Optional[bool] = False,
        # metadata
        metadata: Optional[Dict] = {"human:": DEFAULT_HUMAN, "persona": DEFAULT_PERSONA},
        description: Optional[str] = None,
        initial_message_sequence: Optional[List[Message]] = None,
        tags: Optional[List[str]] = None,
        message_buffer_autoclear: bool = False,
    ) -> AgentState:
        """Create an agent

        Args:
            name (str): Name of the agent
            embedding_config (EmbeddingConfig): Embedding configuration
            llm_config (LLMConfig): LLM configuration
            memory (Memory): Memory configuration
            system (str): System configuration
            tool_ids (List[str]): List of tool ids
            include_base_tools (bool): Include base tools
            metadata (Dict): Metadata
            description (str): Description
            tags (List[str]): Tags for filtering agents

        Returns:
            agent_state (AgentState): State of the created agent
        """
        tool_ids = tool_ids or []
        tool_names = []
        if include_base_tools:
            tool_names += BASE_TOOLS
            tool_names += BASE_MEMORY_TOOLS
        tool_ids += [self.get_tool_id(tool_name=name) for name in tool_names]

        assert embedding_config or self._default_embedding_config, f"Embedding config must be provided"
        assert llm_config or self._default_llm_config, f"LLM config must be provided"

        # TODO: This should not happen here, we need to have clear separation between create/add blocks
        # TODO: This is insanely hacky and a result of allowing free-floating blocks
        # TODO: When we create the block, it gets it's own block ID
        blocks = []
        for block in memory.get_blocks():
            blocks.append(
                self.create_block(
                    label=block.label,
                    value=block.value,
                    limit=block.limit,
                    template_name=block.template_name,
                    is_template=block.is_template,
                )
            )
        memory.blocks = blocks
        block_ids = block_ids or []

        # create agent
        create_params = {
            "description": description,
            "metadata": metadata,
            "memory_blocks": [],
            "block_ids": [b.id for b in memory.get_blocks()] + block_ids,
            "tool_ids": tool_ids,
            "tool_rules": tool_rules,
            "system": system,
            "agent_type": agent_type,
            "llm_config": llm_config if llm_config else self._default_llm_config,
            "embedding_config": embedding_config if embedding_config else self._default_embedding_config,
            "initial_message_sequence": initial_message_sequence,
            "tags": tags,
            "include_base_tools": include_base_tools,
            "message_buffer_autoclear": message_buffer_autoclear,
            "include_multi_agent_tools": include_multi_agent_tools,
        }

        # Only add name if it's not None
        if name is not None:
            create_params["name"] = name

        request = CreateAgent(**create_params)

        # Use model_dump_json() instead of model_dump()
        # If we use model_dump(), the datetime objects will not be serialized correctly
        # response = requests.post(f"{self.base_url}/{self.api_prefix}/agents", json=request.model_dump(), headers=self.headers)
        response = requests.post(
            f"{self.base_url}/{self.api_prefix}/agents",
            data=request.model_dump_json(),  # Use model_dump_json() instead of json=model_dump()
            headers={"Content-Type": "application/json", **self.headers},
        )

        if response.status_code != 200:
            raise ValueError(f"Status {response.status_code} - Failed to create agent: {response.text}")

        # gather agent state
        agent_state = AgentState(**response.json())

        # refresh and return agent
        return self.get_agent(agent_state.id)

    def update_agent(
        self,
        agent_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        system: Optional[str] = None,
        tool_ids: Optional[List[str]] = None,
        metadata: Optional[Dict] = None,
        llm_config: Optional[LLMConfig] = None,
        embedding_config: Optional[EmbeddingConfig] = None,
        message_ids: Optional[List[str]] = None,
        tags: Optional[List[str]] = None,
    ) -> AgentState:
        """
        Update an existing agent

        Args:
            agent_id (str): ID of the agent
            name (str): Name of the agent
            description (str): Description of the agent
            system (str): System configuration
            tool_ids (List[str]): List of tools
            metadata (Dict): Metadata
            llm_config (LLMConfig): LLM configuration
            embedding_config (EmbeddingConfig): Embedding configuration
            message_ids (List[str]): List of message IDs
            tags (List[str]): Tags for filtering agents

        Returns:
            agent_state (AgentState): State of the updated agent
        """
        request = UpdateAgent(
            name=name,
            system=system,
            tool_ids=tool_ids,
            tags=tags,
            description=description,
            metadata=metadata,
            llm_config=llm_config,
            embedding_config=embedding_config,
            message_ids=message_ids,
        )
        response = requests.patch(f"{self.base_url}/{self.api_prefix}/agents/{agent_id}", json=request.model_dump(), headers=self.headers)
        if response.status_code != 200:
            raise ValueError(f"Failed to update agent: {response.text}")
        return AgentState(**response.json())

    def get_tools_from_agent(self, agent_id: str) -> List[Tool]:
        """
        Get tools to an existing agent

        Args:
           agent_id (str): ID of the agent

        Returns:
           List[Tool]: A List of Tool objs
        """
        response = requests.get(f"{self.base_url}/{self.api_prefix}/agents/{agent_id}/tools", headers=self.headers)
        if response.status_code != 200:
            raise ValueError(f"Failed to get tools from agents: {response.text}")
        return [Tool(**tool) for tool in response.json()]

    def attach_tool(self, agent_id: str, tool_id: str) -> AgentState:
        """
        Add tool to an existing agent

        Args:
            agent_id (str): ID of the agent
            tool_id (str): A tool id

        Returns:
            agent_state (AgentState): State of the updated agent
        """
        response = requests.patch(f"{self.base_url}/{self.api_prefix}/agents/{agent_id}/tools/attach/{tool_id}", headers=self.headers)
        if response.status_code != 200:
            raise ValueError(f"Failed to update agent: {response.text}")
        return AgentState(**response.json())

    def detach_tool(self, agent_id: str, tool_id: str) -> AgentState:
        """
        Removes tools from an existing agent

        Args:
            agent_id (str): ID of the agent
            tool_id (str): The tool id

        Returns:
            agent_state (AgentState): State of the updated agent
        """

        response = requests.patch(f"{self.base_url}/{self.api_prefix}/agents/{agent_id}/tools/detach/{tool_id}", headers=self.headers)
        if response.status_code != 200:
            raise ValueError(f"Failed to update agent: {response.text}")
        return AgentState(**response.json())

    def rename_agent(self, agent_id: str, new_name: str) -> AgentState:
        """
        Rename an agent

        Args:
            agent_id (str): ID of the agent
            new_name (str): New name for the agent

        Returns:
            agent_state (AgentState): State of the updated agent
        """
        return self.update_agent(agent_id, name=new_name)

    def delete_agent(self, agent_id: str) -> None:
        """
        Delete an agent

        Args:
            agent_id (str): ID of the agent to delete
        """
        response = requests.delete(f"{self.base_url}/{self.api_prefix}/agents/{str(agent_id)}", headers=self.headers)
        assert response.status_code == 200, f"Failed to delete agent: {response.text}"

    def get_agent(self, agent_id: Optional[str] = None, agent_name: Optional[str] = None) -> AgentState:
        """
        Get an agent's state by it's ID.

        Args:
            agent_id (str): ID of the agent

        Returns:
            agent_state (AgentState): State representation of the agent
        """
        response = requests.get(f"{self.base_url}/{self.api_prefix}/agents/{agent_id}", headers=self.headers)
        assert response.status_code == 200, f"Failed to get agent: {response.text}"
        return AgentState(**response.json())

    def get_agent_id(self, agent_name: str) -> AgentState:
        """
        Get the ID of an agent by name (names are unique per user)

        Args:
            agent_name (str): Name of the agent

        Returns:
            agent_id (str): ID of the agent
        """
        # TODO: implement this
        response = requests.get(f"{self.base_url}/{self.api_prefix}/agents", headers=self.headers, params={"name": agent_name})
        agents = [AgentState(**agent) for agent in response.json()]
        if len(agents) == 0:
            return None
        agents = [agents[0]]  # TODO: @matt monkeypatched
        assert len(agents) == 1, f"Multiple agents with the same name: {[(agents.name, agents.id) for agents in agents]}"
        return agents[0].id

    # memory
    def get_in_context_memory(self, agent_id: str) -> Memory:
        """
        Get the in-contxt (i.e. core) memory of an agent

        Args:
            agent_id (str): ID of the agent

        Returns:
            memory (Memory): In-context memory of the agent
        """
        response = requests.get(f"{self.base_url}/{self.api_prefix}/agents/{agent_id}/core-memory", headers=self.headers)
        if response.status_code != 200:
            raise ValueError(f"Failed to get in-context memory: {response.text}")
        return Memory(**response.json())

    def get_core_memory(self, agent_id: str) -> Memory:
        return self.get_in_context_memory(agent_id)

    def update_in_context_memory(self, agent_id: str, section: str, value: Union[List[str], str]) -> Memory:
        """
        Update the in-context memory of an agent

        Args:
            agent_id (str): ID of the agent

        Returns:
            memory (Memory): The updated in-context memory of the agent

        """
        memory_update_dict = {section: value}
        response = requests.patch(
            f"{self.base_url}/{self.api_prefix}/agents/{agent_id}/core-memory", json=memory_update_dict, headers=self.headers
        )
        if response.status_code != 200:
            raise ValueError(f"Failed to update in-context memory: {response.text}")
        return Memory(**response.json())

    def get_archival_memory_summary(self, agent_id: str) -> ArchivalMemorySummary:
        """
        Get a summary of the archival memory of an agent

        Args:
            agent_id (str): ID of the agent

        Returns:
            summary (ArchivalMemorySummary): Summary of the archival memory

        """
        response = requests.get(f"{self.base_url}/{self.api_prefix}/agents/{agent_id}/context", headers=self.headers)
        if response.status_code != 200:
            raise ValueError(f"Failed to get archival memory summary: {response.text}")
        return ArchivalMemorySummary(size=response.json().get("num_archival_memory", 0))

    def get_recall_memory_summary(self, agent_id: str) -> RecallMemorySummary:
        """
        Get a summary of the recall memory of an agent

        Args:
            agent_id (str): ID of the agent

        Returns:
            summary (RecallMemorySummary): Summary of the recall memory
        """
        response = requests.get(f"{self.base_url}/{self.api_prefix}/agents/{agent_id}/context", headers=self.headers)
        if response.status_code != 200:
            raise ValueError(f"Failed to get recall memory summary: {response.text}")
        return RecallMemorySummary(size=response.json().get("num_recall_memory", 0))

    def get_in_context_messages(self, agent_id: str) -> List[Message]:
        """
        Get in-context messages of an agent

        Args:
            agent_id (str): ID of the agent

        Returns:
            messages (List[Message]): List of in-context messages
        """
        response = requests.get(f"{self.base_url}/{self.api_prefix}/agents/{agent_id}/context", headers=self.headers)
        if response.status_code != 200:
            raise ValueError(f"Failed to get recall memory summary: {response.text}")
        return [Message(**message) for message in response.json().get("messages", "")]

    # agent interactions

    def user_message(self, agent_id: str, message: str) -> LettaResponse:
        """
        Send a message to an agent as a user

        Args:
            agent_id (str): ID of the agent
            message (str): Message to send

        Returns:
            response (LettaResponse): Response from the agent
        """
        return self.send_message(agent_id=agent_id, message=message, role="user")

    def save(self):
        raise NotImplementedError

    # archival memory

    def get_archival_memory(
        self, agent_id: str, before: Optional[str] = None, after: Optional[str] = None, limit: Optional[int] = 1000
    ) -> List[Passage]:
        """
        Get archival memory from an agent with pagination.

        Args:
            agent_id (str): ID of the agent
            before (str): Get memories before a certain time
            after (str): Get memories after a certain time
            limit (int): Limit number of memories

        Returns:
            passages (List[Passage]): List of passages
        """
        params = {"limit": limit}
        if before:
            params["before"] = str(before)
        if after:
            params["after"] = str(after)
        response = requests.get(
            f"{self.base_url}/{self.api_prefix}/agents/{str(agent_id)}/archival-memory", params=params, headers=self.headers
        )
        assert response.status_code == 200, f"Failed to get archival memory: {response.text}"
        return [Passage(**passage) for passage in response.json()]

    def insert_archival_memory(self, agent_id: str, memory: str) -> List[Passage]:
        """
        Insert archival memory into an agent

        Args:
            agent_id (str): ID of the agent
            memory (str): Memory string to insert

        Returns:
            passages (List[Passage]): List of inserted passages
        """
        request = CreateArchivalMemory(text=memory)
        response = requests.post(
            f"{self.base_url}/{self.api_prefix}/agents/{agent_id}/archival-memory", headers=self.headers, json=request.model_dump()
        )
        if response.status_code != 200:
            raise ValueError(f"Failed to insert archival memory: {response.text}")
        return [Passage(**passage) for passage in response.json()]

    def delete_archival_memory(self, agent_id: str, memory_id: str):
        """
        Delete archival memory from an agent

        Args:
            agent_id (str): ID of the agent
            memory_id (str): ID of the memory
        """
        response = requests.delete(f"{self.base_url}/{self.api_prefix}/agents/{agent_id}/archival-memory/{memory_id}", headers=self.headers)
        assert response.status_code == 200, f"Failed to delete archival memory: {response.text}"

    # messages (recall memory)

    def get_messages(
        self, agent_id: str, before: Optional[str] = None, after: Optional[str] = None, limit: Optional[int] = 1000
    ) -> List[LettaMessage]:
        """
        Get messages from an agent with pagination.

        Args:
            agent_id (str): ID of the agent
            before (str): Get messages before a certain time
            after (str): Get messages after a certain time
            limit (int): Limit number of messages

        Returns:
            messages (List[Message]): List of messages
        """

        params = {"before": before, "after": after, "limit": limit, "msg_object": True}
        response = requests.get(f"{self.base_url}/{self.api_prefix}/agents/{agent_id}/messages", params=params, headers=self.headers)
        if response.status_code != 200:
            raise ValueError(f"Failed to get messages: {response.text}")
        return [LettaMessage(**message) for message in response.json()]

    def send_message(
        self,
        message: str,
        role: str,
        agent_id: Optional[str] = None,
        name: Optional[str] = None,
        stream: Optional[bool] = False,
        stream_steps: bool = False,
        stream_tokens: bool = False,
    ) -> Union[LettaResponse, Generator[LettaStreamingResponse, None, None]]:
        """
        Send a message to an agent

        Args:
            message (str): Message to send
            role (str): Role of the message
            agent_id (str): ID of the agent
            name(str): Name of the sender
            stream (bool): Stream the response (default: `False`)
            stream_tokens (bool): Stream tokens (default: `False`)

        Returns:
            response (LettaResponse): Response from the agent
        """
        # TODO: implement include_full_message
        messages = [MessageCreate(role=MessageRole(role), content=message, name=name)]
        # TODO: figure out how to handle stream_steps and stream_tokens

        # When streaming steps is True, stream_tokens must be False
        if stream_tokens or stream_steps:
            from letta.client.streaming import _sse_post

            request = LettaStreamingRequest(messages=messages, stream_tokens=stream_tokens)
            return _sse_post(f"{self.base_url}/{self.api_prefix}/agents/{agent_id}/messages/stream", request.model_dump(), self.headers)
        else:
            request = LettaRequest(messages=messages)
            response = requests.post(
                f"{self.base_url}/{self.api_prefix}/agents/{agent_id}/messages", json=request.model_dump(), headers=self.headers
            )
            if response.status_code != 200:
                raise ValueError(f"Failed to send message: {response.text}")
            response = LettaResponse(**response.json())

            # simplify messages
            # if not include_full_message:
            #     messages = []
            #     for m in response.messages:
            #         assert isinstance(m, Message)
            #         messages += m.to_letta_message()
            #     response.messages = messages

            return response

    def send_message_async(
        self,
        message: str,
        role: str,
        agent_id: Optional[str] = None,
        name: Optional[str] = None,
    ) -> Run:
        """
        Send a message to an agent (async, returns a job)

        Args:
            message (str): Message to send
            role (str): Role of the message
            agent_id (str): ID of the agent
            name(str): Name of the sender

        Returns:
            job (Job): Information about the async job
        """
        messages = [MessageCreate(role=MessageRole(role), content=message, name=name)]

        request = LettaRequest(messages=messages)
        response = requests.post(
            f"{self.base_url}/{self.api_prefix}/agents/{agent_id}/messages/async",
            json=request.model_dump(),
            headers=self.headers,
        )
        if response.status_code != 200:
            raise ValueError(f"Failed to send message: {response.text}")
        response = Run(**response.json())

        return response

    # humans / personas

    def list_blocks(self, label: Optional[str] = None, templates_only: Optional[bool] = True) -> List[Block]:
        params = {"label": label, "templates_only": templates_only}
        response = requests.get(f"{self.base_url}/{self.api_prefix}/blocks", params=params, headers=self.headers)
        if response.status_code != 200:
            raise ValueError(f"Failed to list blocks: {response.text}")

        if label == "human":
            return [Human(**human) for human in response.json()]
        elif label == "persona":
            return [Persona(**persona) for persona in response.json()]
        else:
            return [Block(**block) for block in response.json()]

    def create_block(
        self, label: str, value: str, limit: Optional[int] = None, template_name: Optional[str] = None, is_template: bool = False
    ) -> Block:  #
        request_kwargs = dict(label=label, value=value, template=is_template, template_name=template_name)
        if limit:
            request_kwargs["limit"] = limit
        request = CreateBlock(**request_kwargs)
        response = requests.post(f"{self.base_url}/{self.api_prefix}/blocks", json=request.model_dump(), headers=self.headers)
        if response.status_code != 200:
            raise ValueError(f"Failed to create block: {response.text}")
        if request.label == "human":
            return Human(**response.json())
        elif request.label == "persona":
            return Persona(**response.json())
        else:
            return Block(**response.json())

    def update_block(self, block_id: str, name: Optional[str] = None, text: Optional[str] = None, limit: Optional[int] = None) -> Block:
        request = BlockUpdate(id=block_id, template_name=name, value=text, limit=limit if limit else self.get_block(block_id).limit)
        response = requests.post(f"{self.base_url}/{self.api_prefix}/blocks/{block_id}", json=request.model_dump(), headers=self.headers)
        if response.status_code != 200:
            raise ValueError(f"Failed to update block: {response.text}")
        return Block(**response.json())

    def get_block(self, block_id: str) -> Optional[Block]:
        response = requests.get(f"{self.base_url}/{self.api_prefix}/blocks/{block_id}", headers=self.headers)
        if response.status_code == 404:
            return None
        elif response.status_code != 200:
            raise ValueError(f"Failed to get block: {response.text}")
        return Block(**response.json())

    def get_block_id(self, name: str, label: str) -> str:
        params = {"name": name, "label": label}
        response = requests.get(f"{self.base_url}/{self.api_prefix}/blocks", params=params, headers=self.headers)
        if response.status_code != 200:
            raise ValueError(f"Failed to get block ID: {response.text}")
        blocks = [Block(**block) for block in response.json()]
        if len(blocks) == 0:
            return None
        elif len(blocks) > 1:
            raise ValueError(f"Multiple blocks found with name {name}")
        return blocks[0].id

    def delete_block(self, id: str) -> Block:
        response = requests.delete(f"{self.base_url}/{self.api_prefix}/blocks/{id}", headers=self.headers)
        assert response.status_code == 200, f"Failed to delete block: {response.text}"
        if response.status_code != 200:
            raise ValueError(f"Failed to delete block: {response.text}")
        return Block(**response.json())

    def list_humans(self):
        """
        List available human block templates

        Returns:
            humans (List[Human]): List of human blocks
        """
        blocks = self.list_blocks(label="human")
        return [Human(**block.model_dump()) for block in blocks]

    def create_human(self, name: str, text: str) -> Human:
        """
        Create a human block template (saved human string to pre-fill `ChatMemory`)

        Args:
            name (str): Name of the human block template
            text (str): Text of the human block template

        Returns:
            human (Human): Human block
        """
        return self.create_block(label="human", template_name=name, value=text, is_template=True)

    def update_human(self, human_id: str, name: Optional[str] = None, text: Optional[str] = None) -> Human:
        """
        Update a human block template

        Args:
            human_id (str): ID of the human block
            text (str): Text of the human block

        Returns:
            human (Human): Updated human block
        """
        request = UpdateHuman(id=human_id, template_name=name, value=text)
        response = requests.post(f"{self.base_url}/{self.api_prefix}/blocks/{human_id}", json=request.model_dump(), headers=self.headers)
        if response.status_code != 200:
            raise ValueError(f"Failed to update human: {response.text}")
        return Human(**response.json())

    def list_personas(self):
        """
        List available persona block templates

        Returns:
            personas (List[Persona]): List of persona blocks
        """
        blocks = self.list_blocks(label="persona")
        return [Persona(**block.model_dump()) for block in blocks]

    def create_persona(self, name: str, text: str) -> Persona:
        """
        Create a persona block template (saved persona string to pre-fill `ChatMemory`)

        Args:
            name (str): Name of the persona block
            text (str): Text of the persona block

        Returns:
            persona (Persona): Persona block
        """
        return self.create_block(label="persona", template_name=name, value=text, is_template=True)

    def update_persona(self, persona_id: str, name: Optional[str] = None, text: Optional[str] = None) -> Persona:
        """
        Update a persona block template

        Args:
            persona_id (str): ID of the persona block
            text (str): Text of the persona block

        Returns:
            persona (Persona): Updated persona block
        """
        request = UpdatePersona(id=persona_id, template_name=name, value=text)
        response = requests.post(f"{self.base_url}/{self.api_prefix}/blocks/{persona_id}", json=request.model_dump(), headers=self.headers)
        if response.status_code != 200:
            raise ValueError(f"Failed to update persona: {response.text}")
        return Persona(**response.json())

    def get_persona(self, persona_id: str) -> Persona:
        """
        Get a persona block template

        Args:
            id (str): ID of the persona block

        Returns:
            persona (Persona): Persona block
        """
        return self.get_block(persona_id)

    def get_persona_id(self, name: str) -> str:
        """
        Get the ID of a persona block template

        Args:
            name (str): Name of the persona block

        Returns:
            id (str): ID of the persona block
        """
        return self.get_block_id(name, "persona")

    def delete_persona(self, persona_id: str) -> Persona:
        """
        Delete a persona block template

        Args:
            id (str): ID of the persona block
        """
        return self.delete_block(persona_id)

    def get_human(self, human_id: str) -> Human:
        """
        Get a human block template

        Args:
            id (str): ID of the human block

        Returns:
            human (Human): Human block
        """
        return self.get_block(human_id)

    def get_human_id(self, name: str) -> str:
        """
        Get the ID of a human block template

        Args:
            name (str): Name of the human block

        Returns:
            id (str): ID of the human block
        """
        return self.get_block_id(name, "human")

    def delete_human(self, human_id: str) -> Human:
        """
        Delete a human block template

        Args:
            id (str): ID of the human block
        """
        return self.delete_block(human_id)

    # sources

    def get_source(self, source_id: str) -> Source:
        """
        Get a source given the ID.

        Args:
            source_id (str): ID of the source

        Returns:
            source (Source): Source
        """
        response = requests.get(f"{self.base_url}/{self.api_prefix}/sources/{source_id}", headers=self.headers)
        if response.status_code != 200:
            raise ValueError(f"Failed to get source: {response.text}")
        return Source(**response.json())

    def get_source_id(self, source_name: str) -> str:
        """
        Get the ID of a source

        Args:
            source_name (str): Name of the source

        Returns:
            source_id (str): ID of the source
        """
        response = requests.get(f"{self.base_url}/{self.api_prefix}/sources/name/{source_name}", headers=self.headers)
        if response.status_code != 200:
            raise ValueError(f"Failed to get source ID: {response.text}")
        return response.json()

    def list_sources(self) -> List[Source]:
        """
        List available sources

        Returns:
            sources (List[Source]): List of sources
        """
        response = requests.get(f"{self.base_url}/{self.api_prefix}/sources", headers=self.headers)
        if response.status_code != 200:
            raise ValueError(f"Failed to list sources: {response.text}")
        return [Source(**source) for source in response.json()]

    def delete_source(self, source_id: str):
        """
        Delete a source

        Args:
            source_id (str): ID of the source
        """
        response = requests.delete(f"{self.base_url}/{self.api_prefix}/sources/{str(source_id)}", headers=self.headers)
        assert response.status_code == 200, f"Failed to delete source: {response.text}"

    def get_job(self, job_id: str) -> Job:
        response = requests.get(f"{self.base_url}/{self.api_prefix}/jobs/{job_id}", headers=self.headers)
        if response.status_code != 200:
            raise ValueError(f"Failed to get job: {response.text}")
        return Job(**response.json())

    def delete_job(self, job_id: str) -> Job:
        response = requests.delete(f"{self.base_url}/{self.api_prefix}/jobs/{job_id}", headers=self.headers)
        if response.status_code != 200:
            raise ValueError(f"Failed to delete job: {response.text}")
        return Job(**response.json())

    def list_jobs(self):
        response = requests.get(f"{self.base_url}/{self.api_prefix}/jobs", headers=self.headers)
        return [Job(**job) for job in response.json()]

    def list_active_jobs(self):
        response = requests.get(f"{self.base_url}/{self.api_prefix}/jobs/active", headers=self.headers)
        return [Job(**job) for job in response.json()]

    def load_data(self, connector: DataConnector, source_name: str):
        raise NotImplementedError

    def load_file_to_source(self, filename: str, source_id: str, blocking=True) -> Job:
        """
        Load a file into a source

        Args:
            filename (str): Name of the file
            source_id (str): ID of the source
            blocking (bool): Block until the job is complete

        Returns:
            job (Job): Data loading job including job status and metadata
        """
        files = {"file": open(filename, "rb")}

        # create job
        response = requests.post(f"{self.base_url}/{self.api_prefix}/sources/{source_id}/upload", files=files, headers=self.headers)
        if response.status_code != 200:
            raise ValueError(f"Failed to upload file to source: {response.text}")

        job = Job(**response.json())
        if blocking:
            # wait until job is completed
            while True:
                job = self.get_job(job.id)
                if job.status == JobStatus.completed:
                    break
                elif job.status == JobStatus.failed:
                    raise ValueError(f"Job failed: {job.metadata}")
                time.sleep(1)
        return job

    def delete_file_from_source(self, source_id: str, file_id: str) -> None:
        response = requests.delete(f"{self.base_url}/{self.api_prefix}/sources/{source_id}/{file_id}", headers=self.headers)
        if response.status_code not in [200, 204]:
            raise ValueError(f"Failed to delete tool: {response.text}")

    def create_source(self, name: str, embedding_config: Optional[EmbeddingConfig] = None) -> Source:
        """
        Create a source

        Args:
            name (str): Name of the source

        Returns:
            source (Source): Created source
        """
        assert embedding_config or self._default_embedding_config, f"Must specify embedding_config for source"
        source_create = SourceCreate(name=name, embedding_config=embedding_config or self._default_embedding_config)
        payload = source_create.model_dump()
        response = requests.post(f"{self.base_url}/{self.api_prefix}/sources", json=payload, headers=self.headers)
        response_json = response.json()
        return Source(**response_json)

    def list_attached_sources(self, agent_id: str) -> List[Source]:
        """
        List sources attached to an agent

        Args:
            agent_id (str): ID of the agent

        Returns:
            sources (List[Source]): List of sources
        """
        response = requests.get(f"{self.base_url}/{self.api_prefix}/agents/{agent_id}/sources", headers=self.headers)
        if response.status_code != 200:
            raise ValueError(f"Failed to list attached sources: {response.text}")
        return [Source(**source) for source in response.json()]

    def list_files_from_source(self, source_id: str, limit: int = 1000, after: Optional[str] = None) -> List[FileMetadata]:
        """
        List files from source with pagination support.

        Args:
            source_id (str): ID of the source
            limit (int): Number of files to return
            after (str): Get files after a certain time

        Returns:
            List[FileMetadata]: List of files
        """
        # Prepare query parameters for pagination
        params = {"limit": limit, "after": after}

        # Make the request to the FastAPI endpoint
        response = requests.get(f"{self.base_url}/{self.api_prefix}/sources/{source_id}/files", headers=self.headers, params=params)

        if response.status_code != 200:
            raise ValueError(f"Failed to list files with source id {source_id}: [{response.status_code}] {response.text}")

        # Parse the JSON response
        return [FileMetadata(**metadata) for metadata in response.json()]

    def update_source(self, source_id: str, name: Optional[str] = None) -> Source:
        """
        Update a source

        Args:
            source_id (str): ID of the source
            name (str): Name of the source

        Returns:
            source (Source): Updated source
        """
        request = SourceUpdate(name=name)
        response = requests.patch(f"{self.base_url}/{self.api_prefix}/sources/{source_id}", json=request.model_dump(), headers=self.headers)
        if response.status_code != 200:
            raise ValueError(f"Failed to update source: {response.text}")
        return Source(**response.json())

    def attach_source(self, source_id: str, agent_id: str) -> AgentState:
        """
        Attach a source to an agent

        Args:
            agent_id (str): ID of the agent
            source_id (str): ID of the source
            source_name (str): Name of the source
        """
        params = {"agent_id": agent_id}
        response = requests.patch(
            f"{self.base_url}/{self.api_prefix}/agents/{agent_id}/sources/attach/{source_id}", params=params, headers=self.headers
        )
        assert response.status_code == 200, f"Failed to attach source to agent: {response.text}"
        return AgentState(**response.json())

    def detach_source(self, source_id: str, agent_id: str) -> AgentState:
        """Detach a source from an agent"""
        params = {"agent_id": str(agent_id)}
        response = requests.patch(
            f"{self.base_url}/{self.api_prefix}/agents/{agent_id}/sources/detach/{source_id}", params=params, headers=self.headers
        )
        assert response.status_code == 200, f"Failed to detach source from agent: {response.text}"
        return AgentState(**response.json())

    # tools

    def get_tool_id(self, tool_name: str):
        """
        Get the ID of a tool

        Args:
            name (str): Name of the tool

        Returns:
            id (str): ID of the tool (`None` if not found)
        """
        response = requests.get(f"{self.base_url}/{self.api_prefix}/tools", headers=self.headers)
        if response.status_code != 200:
            raise ValueError(f"Failed to get tool: {response.text}")

        tools = [tool for tool in [Tool(**tool) for tool in response.json()] if tool.name == tool_name]
        if not tools:
            return None
        return tools[0].id

    def list_attached_tools(self, agent_id: str) -> List[Tool]:
        """
        List all tools attached to an agent.

        Args:
            agent_id (str): ID of the agent

        Returns:
            List[Tool]: A list of attached tools
        """
        response = requests.get(f"{self.base_url}/{self.api_prefix}/agents/{agent_id}/tools", headers=self.headers)
        if response.status_code != 200:
            raise ValueError(f"Failed to list attached tools: {response.text}")
        return [Tool(**tool) for tool in response.json()]

    def upsert_base_tools(self) -> List[Tool]:
        response = requests.post(f"{self.base_url}/{self.api_prefix}/tools/add-base-tools/", headers=self.headers)
        if response.status_code != 200:
            raise ValueError(f"Failed to add base tools: {response.text}")

        return [Tool(**tool) for tool in response.json()]

    def create_tool(
        self,
        func: Callable,
        tags: Optional[List[str]] = None,
        return_char_limit: int = FUNCTION_RETURN_CHAR_LIMIT,
    ) -> Tool:
        """
        Create a tool. This stores the source code of function on the server, so that the server can execute the function and generate an OpenAI JSON schemas for it when using with an agent.

        Args:
            func (callable): The function to create a tool for.
            name: (str): Name of the tool (must be unique per-user.)
            tags (Optional[List[str]], optional): Tags for the tool. Defaults to None.
            return_char_limit (int): The character limit for the tool's return value. Defaults to FUNCTION_RETURN_CHAR_LIMIT.

        Returns:
            tool (Tool): The created tool.
        """
        source_code = parse_source_code(func)
        source_type = "python"

        # call server function
        request = ToolCreate(source_type=source_type, source_code=source_code, return_char_limit=return_char_limit)
        if tags:
            request.tags = tags
        response = requests.post(f"{self.base_url}/{self.api_prefix}/tools", json=request.model_dump(), headers=self.headers)
        if response.status_code != 200:
            raise ValueError(f"Failed to create tool: {response.text}")
        return Tool(**response.json())

    def create_or_update_tool(
        self,
        func: Callable,
        tags: Optional[List[str]] = None,
        return_char_limit: int = FUNCTION_RETURN_CHAR_LIMIT,
    ) -> Tool:
        """
        Creates or updates a tool. This stores the source code of function on the server, so that the server can execute the function and generate an OpenAI JSON schemas for it when using with an agent.

        Args:
            func (callable): The function to create a tool for.
            name: (str): Name of the tool (must be unique per-user.)
            tags (Optional[List[str]], optional): Tags for the tool. Defaults to None.
            return_char_limit (int): The character limit for the tool's return value. Defaults to FUNCTION_RETURN_CHAR_LIMIT.

        Returns:
            tool (Tool): The created tool.
        """
        source_code = parse_source_code(func)
        source_type = "python"

        # call server function
        request = ToolCreate(source_type=source_type, source_code=source_code, return_char_limit=return_char_limit)
        if tags:
            request.tags = tags
        response = requests.put(f"{self.base_url}/{self.api_prefix}/tools", json=request.model_dump(), headers=self.headers)
        if response.status_code != 200:
            raise ValueError(f"Failed to create tool: {response.text}")
        return Tool(**response.json())

    def update_tool(
        self,
        id: str,
        description: Optional[str] = None,
        func: Optional[Callable] = None,
        tags: Optional[List[str]] = None,
        return_char_limit: int = FUNCTION_RETURN_CHAR_LIMIT,
    ) -> Tool:
        """
        Update a tool with provided parameters (name, func, tags)

        Args:
            id (str): ID of the tool
            name (str): Name of the tool
            func (callable): Function to wrap in a tool
            tags (List[str]): Tags for the tool
            return_char_limit (int): The character limit for the tool's return value. Defaults to FUNCTION_RETURN_CHAR_LIMIT.

        Returns:
            tool (Tool): Updated tool
        """
        if func:
            source_code = parse_source_code(func)
        else:
            source_code = None

        source_type = "python"

        request = ToolUpdate(
            description=description,
            source_type=source_type,
            source_code=source_code,
            tags=tags,
            return_char_limit=return_char_limit,
        )
        response = requests.patch(f"{self.base_url}/{self.api_prefix}/tools/{id}", json=request.model_dump(), headers=self.headers)
        if response.status_code != 200:
            raise ValueError(f"Failed to update tool: {response.text}")
        return Tool(**response.json())

    def list_tools(self, after: Optional[str] = None, limit: Optional[int] = 50) -> List[Tool]:
        """
        List available tools for the user.

        Returns:
            tools (List[Tool]): List of tools
        """
        params = {}
        if after:
            params["after"] = after
        if limit:
            params["limit"] = limit

        response = requests.get(f"{self.base_url}/{self.api_prefix}/tools", params=params, headers=self.headers)
        if response.status_code != 200:
            raise ValueError(f"Failed to list tools: {response.text}")
        return [Tool(**tool) for tool in response.json()]

    def delete_tool(self, name: str):
        """
        Delete a tool given the ID.

        Args:
            id (str): ID of the tool
        """
        response = requests.delete(f"{self.base_url}/{self.api_prefix}/tools/{name}", headers=self.headers)
        if response.status_code != 200:
            raise ValueError(f"Failed to delete tool: {response.text}")

    def get_tool(self, id: str) -> Optional[Tool]:
        """
        Get a tool give its ID.

        Args:
            id (str): ID of the tool

        Returns:
            tool (Tool): Tool
        """
        response = requests.get(f"{self.base_url}/{self.api_prefix}/tools/{id}", headers=self.headers)
        if response.status_code == 404:
            return None
        elif response.status_code != 200:
            raise ValueError(f"Failed to get tool: {response.text}")
        return Tool(**response.json())

    def set_default_llm_config(self, llm_config: LLMConfig):
        """
        Set the default LLM configuration

        Args:
            llm_config (LLMConfig): LLM configuration
        """
        self._default_llm_config = llm_config

    def set_default_embedding_config(self, embedding_config: EmbeddingConfig):
        """
        Set the default embedding configuration

        Args:
            embedding_config (EmbeddingConfig): Embedding configuration
        """
        self._default_embedding_config = embedding_config

    def list_llm_configs(self) -> List[LLMConfig]:
        """
        List available LLM configurations

        Returns:
            configs (List[LLMConfig]): List of LLM configurations
        """
        response = requests.get(f"{self.base_url}/{self.api_prefix}/models", headers=self.headers)
        if response.status_code != 200:
            raise ValueError(f"Failed to list LLM configs: {response.text}")
        return [LLMConfig(**config) for config in response.json()]

    def list_embedding_configs(self) -> List[EmbeddingConfig]:
        """
        List available embedding configurations

        Returns:
            configs (List[EmbeddingConfig]): List of embedding configurations
        """
        response = requests.get(f"{self.base_url}/{self.api_prefix}/models/embedding", headers=self.headers)
        if response.status_code != 200:
            raise ValueError(f"Failed to list embedding configs: {response.text}")
        return [EmbeddingConfig(**config) for config in response.json()]

    def list_orgs(self, after: Optional[str] = None, limit: Optional[int] = 50) -> List[Organization]:
        """
        Retrieves a list of all organizations in the database, with optional pagination.

        @param after: the pagination cursor, if any
        @param limit: the maximum number of organizations to retrieve
        @return: a list of Organization objects
        """
        params = {"after": after, "limit": limit}
        response = requests.get(f"{self.base_url}/{ADMIN_PREFIX}/orgs", headers=self.headers, params=params)
        if response.status_code != 200:
            raise ValueError(f"Failed to retrieve organizations: {response.text}")
        return [Organization(**org_data) for org_data in response.json()]

    def create_org(self, name: Optional[str] = None) -> Organization:
        """
        Creates an organization with the given name. If not provided, we generate a random one.

        @param name: the name of the organization
        @return: the created Organization
        """
        payload = {"name": name}
        response = requests.post(f"{self.base_url}/{ADMIN_PREFIX}/orgs", headers=self.headers, json=payload)
        if response.status_code != 200:
            raise ValueError(f"Failed to create org: {response.text}")
        return Organization(**response.json())

    def delete_org(self, org_id: str) -> Organization:
        """
        Deletes an organization by its ID.

        @param org_id: the ID of the organization to delete
        @return: the deleted Organization object
        """
        # Define query parameters with org_id
        params = {"org_id": org_id}

        # Make the DELETE request with query parameters
        response = requests.delete(f"{self.base_url}/{ADMIN_PREFIX}/orgs", headers=self.headers, params=params)

        if response.status_code == 404:
            raise ValueError(f"Organization with ID '{org_id}' does not exist")
        elif response.status_code != 200:
            raise ValueError(f"Failed to delete organization: {response.text}")

        # Parse and return the deleted organization
        return Organization(**response.json())

    def create_sandbox_config(self, config: Union[LocalSandboxConfig, E2BSandboxConfig]) -> SandboxConfig:
        """
        Create a new sandbox configuration.

        Args:
            config (Union[LocalSandboxConfig, E2BSandboxConfig]): The sandbox settings.

        Returns:
            SandboxConfig: The created sandbox configuration.
        """
        payload = {
            "config": config.model_dump(),
        }
        response = requests.post(f"{self.base_url}/{self.api_prefix}/sandbox-config", headers=self.headers, json=payload)
        if response.status_code != 200:
            raise ValueError(f"Failed to create sandbox config: {response.text}")
        return SandboxConfig(**response.json())

    def update_sandbox_config(self, sandbox_config_id: str, config: Union[LocalSandboxConfig, E2BSandboxConfig]) -> SandboxConfig:
        """
        Update an existing sandbox configuration.

        Args:
            sandbox_config_id (str): The ID of the sandbox configuration to update.
            config (Union[LocalSandboxConfig, E2BSandboxConfig]): The updated sandbox settings.

        Returns:
            SandboxConfig: The updated sandbox configuration.
        """
        payload = {
            "config": config.model_dump(),
        }
        response = requests.patch(
            f"{self.base_url}/{self.api_prefix}/sandbox-config/{sandbox_config_id}",
            headers=self.headers,
            json=payload,
        )
        if response.status_code != 200:
            raise ValueError(f"Failed to update sandbox config with ID '{sandbox_config_id}': {response.text}")
        return SandboxConfig(**response.json())

    def delete_sandbox_config(self, sandbox_config_id: str) -> None:
        """
        Delete a sandbox configuration.

        Args:
            sandbox_config_id (str): The ID of the sandbox configuration to delete.
        """
        response = requests.delete(f"{self.base_url}/{self.api_prefix}/sandbox-config/{sandbox_config_id}", headers=self.headers)
        if response.status_code == 404:
            raise ValueError(f"Sandbox config with ID '{sandbox_config_id}' does not exist")
        elif response.status_code != 204:
            raise ValueError(f"Failed to delete sandbox config with ID '{sandbox_config_id}': {response.text}")

    def list_sandbox_configs(self, limit: int = 50, after: Optional[str] = None) -> List[SandboxConfig]:
        """
        List all sandbox configurations.

        Args:
            limit (int, optional): The maximum number of sandbox configurations to return. Defaults to 50.
            after (Optional[str], optional): The pagination cursor for retrieving the next set of results.

        Returns:
            List[SandboxConfig]: A list of sandbox configurations.
        """
        params = {"limit": limit, "after": after}
        response = requests.get(f"{self.base_url}/{self.api_prefix}/sandbox-config", headers=self.headers, params=params)
        if response.status_code != 200:
            raise ValueError(f"Failed to list sandbox configs: {response.text}")
        return [SandboxConfig(**config_data) for config_data in response.json()]

    def create_sandbox_env_var(
        self, sandbox_config_id: str, key: str, value: str, description: Optional[str] = None
    ) -> SandboxEnvironmentVariable:
        """
        Create a new environment variable for a sandbox configuration.

        Args:
            sandbox_config_id (str): The ID of the sandbox configuration to associate the environment variable with.
            key (str): The name of the environment variable.
            value (str): The value of the environment variable.
            description (Optional[str], optional): A description of the environment variable. Defaults to None.

        Returns:
            SandboxEnvironmentVariable: The created environment variable.
        """
        payload = {"key": key, "value": value, "description": description}
        response = requests.post(
            f"{self.base_url}/{self.api_prefix}/sandbox-config/{sandbox_config_id}/environment-variable",
            headers=self.headers,
            json=payload,
        )
        if response.status_code != 200:
            raise ValueError(f"Failed to create environment variable for sandbox config ID '{sandbox_config_id}': {response.text}")
        return SandboxEnvironmentVariable(**response.json())

    def update_sandbox_env_var(
        self, env_var_id: str, key: Optional[str] = None, value: Optional[str] = None, description: Optional[str] = None
    ) -> SandboxEnvironmentVariable:
        """
        Update an existing environment variable.

        Args:
            env_var_id (str): The ID of the environment variable to update.
            key (Optional[str], optional): The updated name of the environment variable. Defaults to None.
            value (Optional[str], optional): The updated value of the environment variable. Defaults to None.
            description (Optional[str], optional): The updated description of the environment variable. Defaults to None.

        Returns:
            SandboxEnvironmentVariable: The updated environment variable.
        """
        payload = {k: v for k, v in {"key": key, "value": value, "description": description}.items() if v is not None}
        response = requests.patch(
            f"{self.base_url}/{self.api_prefix}/sandbox-config/environment-variable/{env_var_id}",
            headers=self.headers,
            json=payload,
        )
        if response.status_code != 200:
            raise ValueError(f"Failed to update environment variable with ID '{env_var_id}': {response.text}")
        return SandboxEnvironmentVariable(**response.json())

    def delete_sandbox_env_var(self, env_var_id: str) -> None:
        """
        Delete an environment variable by its ID.

        Args:
            env_var_id (str): The ID of the environment variable to delete.
        """
        response = requests.delete(
            f"{self.base_url}/{self.api_prefix}/sandbox-config/environment-variable/{env_var_id}", headers=self.headers
        )
        if response.status_code == 404:
            raise ValueError(f"Environment variable with ID '{env_var_id}' does not exist")
        elif response.status_code != 204:
            raise ValueError(f"Failed to delete environment variable with ID '{env_var_id}': {response.text}")

    def list_sandbox_env_vars(
        self, sandbox_config_id: str, limit: int = 50, after: Optional[str] = None
    ) -> List[SandboxEnvironmentVariable]:
        """
        List all environment variables associated with a sandbox configuration.

        Args:
            sandbox_config_id (str): The ID of the sandbox configuration to retrieve environment variables for.
            limit (int, optional): The maximum number of environment variables to return. Defaults to 50.
            after (Optional[str], optional): The pagination cursor for retrieving the next set of results.

        Returns:
            List[SandboxEnvironmentVariable]: A list of environment variables.
        """
        params = {"limit": limit, "after": after}
        response = requests.get(
            f"{self.base_url}/{self.api_prefix}/sandbox-config/{sandbox_config_id}/environment-variable",
            headers=self.headers,
            params=params,
        )
        if response.status_code != 200:
            raise ValueError(f"Failed to list environment variables for sandbox config ID '{sandbox_config_id}': {response.text}")
        return [SandboxEnvironmentVariable(**var_data) for var_data in response.json()]

    def update_agent_memory_block_label(self, agent_id: str, current_label: str, new_label: str) -> Memory:
        """Rename a block in the agent's core memory

        Args:
            agent_id (str): The agent ID
            current_label (str): The current label of the block
            new_label (str): The new label of the block

        Returns:
            memory (Memory): The updated memory
        """
        block = self.get_agent_memory_block(agent_id, current_label)
        return self.update_block(block.id, label=new_label)

    def attach_block(self, agent_id: str, block_id: str) -> AgentState:
        """
        Attach a block to an agent.

        Args:
            agent_id (str): ID of the agent
            block_id (str): ID of the block to attach
        """
        response = requests.patch(
            f"{self.base_url}/{self.api_prefix}/agents/{agent_id}/core-memory/blocks/attach/{block_id}",
            headers=self.headers,
        )
        if response.status_code != 200:
            raise ValueError(f"Failed to attach block to agent: {response.text}")
        return AgentState(**response.json())

    def detach_block(self, agent_id: str, block_id: str) -> AgentState:
        """
        Detach a block from an agent.

        Args:
            agent_id (str): ID of the agent
            block_id (str): ID of the block to detach
        """
        response = requests.patch(
            f"{self.base_url}/{self.api_prefix}/agents/{agent_id}/core-memory/blocks/detach/{block_id}", headers=self.headers
        )
        if response.status_code != 200:
            raise ValueError(f"Failed to detach block from agent: {response.text}")
        return AgentState(**response.json())

    def list_agent_memory_blocks(self, agent_id: str) -> List[Block]:
        """
        Get all the blocks in the agent's core memory

        Args:
            agent_id (str): The agent ID

        Returns:
            blocks (List[Block]): The blocks in the agent's core memory
        """
        response = requests.get(f"{self.base_url}/{self.api_prefix}/agents/{agent_id}/core-memory/blocks", headers=self.headers)
        if response.status_code != 200:
            raise ValueError(f"Failed to get agent memory blocks: {response.text}")
        return [Block(**block) for block in response.json()]

    def get_agent_memory_block(self, agent_id: str, label: str) -> Block:
        """
        Get a block in the agent's core memory by its label

        Args:
            agent_id (str): The agent ID
            label (str): The label in the agent's core memory

        Returns:
            block (Block): The block corresponding to the label
        """
        response = requests.get(
            f"{self.base_url}/{self.api_prefix}/agents/{agent_id}/core-memory/blocks/{label}",
            headers=self.headers,
        )
        if response.status_code != 200:
            raise ValueError(f"Failed to get agent memory block: {response.text}")
        return Block(**response.json())

    def update_agent_memory_block(
        self,
        agent_id: str,
        label: str,
        value: Optional[str] = None,
        limit: Optional[int] = None,
    ):
        """
        Update a block in the agent's core memory by specifying its label

        Args:
            agent_id (str): The agent ID
            label (str): The label of the block
            value (str): The new value of the block
            limit (int): The new limit of the block

        Returns:
            block (Block): The updated block
        """
        # setup data
        data = {}
        if value:
            data["value"] = value
        if limit:
            data["limit"] = limit
        response = requests.patch(
            f"{self.base_url}/{self.api_prefix}/agents/{agent_id}/core-memory/blocks/{label}",
            headers=self.headers,
            json=data,
        )
        if response.status_code != 200:
            raise ValueError(f"Failed to update agent memory block: {response.text}")
        return Block(**response.json())

    def update_block(
        self,
        block_id: str,
        label: Optional[str] = None,
        value: Optional[str] = None,
        limit: Optional[int] = None,
    ):
        """
        Update a block given the ID with the provided fields

        Args:
            block_id (str): ID of the block
            label (str): Label to assign to the block
            value (str): Value to assign to the block
            limit (int): Token limit to assign to the block

        Returns:
            block (Block): Updated block
        """
        data = {}
        if value:
            data["value"] = value
        if limit:
            data["limit"] = limit
        if label:
            data["label"] = label
        response = requests.patch(
            f"{self.base_url}/{self.api_prefix}/blocks/{block_id}",
            headers=self.headers,
            json=data,
        )
        if response.status_code != 200:
            raise ValueError(f"Failed to update block: {response.text}")
        return Block(**response.json())

    def get_run_messages(
        self,
        run_id: str,
        before: Optional[str] = None,
        after: Optional[str] = None,
        limit: Optional[int] = 100,
        ascending: bool = True,
        role: Optional[MessageRole] = None,
    ) -> List[LettaMessageUnion]:
        """
        Get messages associated with a job with filtering options.

        Args:
            job_id: ID of the job
            before: Cursor for pagination
            after: Cursor for pagination
            limit: Maximum number of messages to return
            ascending: Sort order by creation time
            role: Filter by message role (user/assistant/system/tool)
        Returns:
            List of messages matching the filter criteria
        """
        params = {
            "before": before,
            "after": after,
            "limit": limit,
            "ascending": ascending,
            "role": role,
        }
        # Remove None values
        params = {k: v for k, v in params.items() if v is not None}

        response = requests.get(f"{self.base_url}/{self.api_prefix}/runs/{run_id}/messages", params=params)
        if response.status_code != 200:
            raise ValueError(f"Failed to get run messages: {response.text}")
        return [LettaMessage(**message) for message in response.json()]

    def get_run_usage(
        self,
        run_id: str,
    ) -> List[UsageStatistics]:
        """
        Get usage statistics associated with a job.

        Args:
            job_id (str): ID of the job

        Returns:
            List[UsageStatistics]: List of usage statistics associated with the job
        """
        response = requests.get(
            f"{self.base_url}/{self.api_prefix}/runs/{run_id}/usage",
            headers=self.headers,
        )
        if response.status_code != 200:
            raise ValueError(f"Failed to get run usage statistics: {response.text}")
        return [UsageStatistics(**stat) for stat in [response.json()]]

    def get_run(self, run_id: str) -> Run:
        """
        Get a run by ID.

        Args:
            run_id (str): ID of the run

        Returns:
            run (Run): Run
        """
        response = requests.get(
            f"{self.base_url}/{self.api_prefix}/runs/{run_id}",
            headers=self.headers,
        )
        if response.status_code != 200:
            raise ValueError(f"Failed to get run: {response.text}")
        return Run(**response.json())

    def delete_run(self, run_id: str) -> None:
        """
        Delete a run by ID.

        Args:
            run_id (str): ID of the run
        """
        response = requests.delete(
            f"{self.base_url}/{self.api_prefix}/runs/{run_id}",
            headers=self.headers,
        )
        if response.status_code != 200:
            raise ValueError(f"Failed to delete run: {response.text}")

    def list_runs(self) -> List[Run]:
        """
        List all runs.

        Returns:
            runs (List[Run]): List of runs
        """
        response = requests.get(
            f"{self.base_url}/{self.api_prefix}/runs",
            headers=self.headers,
        )
        if response.status_code != 200:
            raise ValueError(f"Failed to list runs: {response.text}")
        return [Run(**run) for run in response.json()]

    def list_active_runs(self) -> List[Run]:
        """
        List all active runs.

        Returns:
            runs (List[Run]): List of active runs
        """
        response = requests.get(
            f"{self.base_url}/{self.api_prefix}/runs/active",
            headers=self.headers,
        )
        if response.status_code != 200:
            raise ValueError(f"Failed to list active runs: {response.text}")
        return [Run(**run) for run in response.json()]

    def get_tags(
        self,
        after: Optional[str] = None,
        limit: int = 100,
        query_text: Optional[str] = None,
    ) -> List[str]:
        """
        Get a list of all unique tags.

        Args:
            after: Optional cursor for pagination (first tag seen)
            limit: Optional maximum number of tags to return
            query_text: Optional text to filter tags

        Returns:
            List[str]: List of unique tags
        """
        params = {}
        if after:
            params["after"] = after
        if limit:
            params["limit"] = limit
        if query_text:
            params["query_text"] = query_text

        response = requests.get(f"{self.base_url}/{self.api_prefix}/tags", headers=self.headers, params=params)
        if response.status_code != 200:
            raise ValueError(f"Failed to get tags: {response.text}")
        return response.json()


class LocalClient(AbstractClient):
    """
    A local client for Letta, which corresponds to a single user.

    Attributes:
        user_id (str): The user ID.
        debug (bool): Whether to print debug information.
        interface (QueuingInterface): The interface for the client.
        server (SyncServer): The server for the client.
    """

    def __init__(
        self,
        user_id: Optional[str] = None,
        org_id: Optional[str] = None,
        debug: bool = False,
        default_llm_config: Optional[LLMConfig] = None,
        default_embedding_config: Optional[EmbeddingConfig] = None,
    ):
        """
        Initializes a new instance of Client class.

        Args:
            user_id (str): The user ID.
            debug (bool): Whether to print debug information.
        """

        from letta.server.server import SyncServer

        # set logging levels
        letta.utils.DEBUG = debug
        logging.getLogger().setLevel(logging.CRITICAL)

        # save default model config
        self._default_llm_config = default_llm_config
        self._default_embedding_config = default_embedding_config

        # create server
        self.interface = QueuingInterface(debug=debug)
        self.server = SyncServer(default_interface_factory=lambda: self.interface)

        # save org_id that `LocalClient` is associated with
        if org_id:
            self.org_id = org_id
        else:
            self.org_id = self.server.organization_manager.DEFAULT_ORG_ID
        # save user_id that `LocalClient` is associated with
        if user_id:
            self.user_id = user_id
        else:
            # get default user
            self.user_id = self.server.user_manager.DEFAULT_USER_ID

        self.user = self.server.user_manager.get_user_or_default(self.user_id)
        self.organization = self.server.get_organization_or_default(self.org_id)

    # agents
    def list_agents(
        self,
        query_text: Optional[str] = None,
        tags: Optional[List[str]] = None,
        limit: int = 100,
        before: Optional[str] = None,
        after: Optional[str] = None,
    ) -> List[AgentState]:
        self.interface.clear()

        return self.server.agent_manager.list_agents(
            actor=self.user, tags=tags, query_text=query_text, limit=limit, before=before, after=after
        )

    def agent_exists(self, agent_id: Optional[str] = None, agent_name: Optional[str] = None) -> bool:
        """
        Check if an agent exists

        Args:
            agent_id (str): ID of the agent
            agent_name (str): Name of the agent

        Returns:
            exists (bool): `True` if the agent exists, `False` otherwise
        """

        if not (agent_id or agent_name):
            raise ValueError(f"Either agent_id or agent_name must be provided")
        if agent_id and agent_name:
            raise ValueError(f"Only one of agent_id or agent_name can be provided")
        existing = self.list_agents()
        if agent_id:
            return str(agent_id) in [str(agent.id) for agent in existing]
        else:
            return agent_name in [str(agent.name) for agent in existing]

    def create_agent(
        self,
        name: Optional[str] = None,
        # agent config
        agent_type: Optional[AgentType] = AgentType.memgpt_agent,
        # model configs
        embedding_config: EmbeddingConfig = None,
        llm_config: LLMConfig = None,
        # memory
        memory: Memory = ChatMemory(human=get_human_text(DEFAULT_HUMAN), persona=get_persona_text(DEFAULT_PERSONA)),
        block_ids: Optional[List[str]] = None,
        # TODO: change to this when we are ready to migrate all the tests/examples (matches the REST API)
        # memory_blocks=[
        #    {"label": "human", "value": get_human_text(DEFAULT_HUMAN), "limit": 5000},
        #    {"label": "persona", "value": get_persona_text(DEFAULT_PERSONA), "limit": 5000},
        # ],
        # system
        system: Optional[str] = None,
        # tools
        tool_ids: Optional[List[str]] = None,
        tool_rules: Optional[List[BaseToolRule]] = None,
        include_base_tools: Optional[bool] = True,
        include_multi_agent_tools: bool = False,
        include_base_tool_rules: bool = True,
        # metadata
        metadata: Optional[Dict] = {"human:": DEFAULT_HUMAN, "persona": DEFAULT_PERSONA},
        description: Optional[str] = None,
        initial_message_sequence: Optional[List[Message]] = None,
        tags: Optional[List[str]] = None,
        message_buffer_autoclear: bool = False,
    ) -> AgentState:
        """Create an agent

        Args:
            name (str): Name of the agent
            embedding_config (EmbeddingConfig): Embedding configuration
            llm_config (LLMConfig): LLM configuration
            memory_blocks (List[Dict]): List of configurations for the memory blocks (placed in core-memory)
            system (str): System configuration
            tools (List[str]): List of tools
            tool_rules (Optional[List[BaseToolRule]]): List of tool rules
            include_base_tools (bool): Include base tools
            include_multi_agent_tools (bool): Include multi agent tools
            metadata (Dict): Metadata
            description (str): Description
            tags (List[str]): Tags for filtering agents

        Returns:
            agent_state (AgentState): State of the created agent
        """
        # construct list of tools
        tool_ids = tool_ids or []

        # check if default configs are provided
        assert embedding_config or self._default_embedding_config, f"Embedding config must be provided"
        assert llm_config or self._default_llm_config, f"LLM config must be provided"

        # TODO: This should not happen here, we need to have clear separation between create/add blocks
        for block in memory.get_blocks():
            self.server.block_manager.create_or_update_block(block, actor=self.user)

        # Also get any existing block_ids passed in
        block_ids = block_ids or []

        # create agent
        # Create the base parameters
        create_params = {
            "description": description,
            "metadata": metadata,
            "memory_blocks": [],
            "block_ids": [b.id for b in memory.get_blocks()] + block_ids,
            "tool_ids": tool_ids,
            "tool_rules": tool_rules,
            "include_base_tools": include_base_tools,
            "include_multi_agent_tools": include_multi_agent_tools,
            "include_base_tool_rules": include_base_tool_rules,
            "system": system,
            "agent_type": agent_type,
            "llm_config": llm_config if llm_config else self._default_llm_config,
            "embedding_config": embedding_config if embedding_config else self._default_embedding_config,
            "initial_message_sequence": initial_message_sequence,
            "tags": tags,
            "message_buffer_autoclear": message_buffer_autoclear,
        }

        # Only add name if it's not None
        if name is not None:
            create_params["name"] = name

        agent_state = self.server.create_agent(
            CreateAgent(**create_params),
            actor=self.user,
        )

        # TODO: get full agent state
        return self.server.agent_manager.get_agent_by_id(agent_state.id, actor=self.user)

    def update_agent(
        self,
        agent_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        system: Optional[str] = None,
        tool_ids: Optional[List[str]] = None,
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict] = None,
        llm_config: Optional[LLMConfig] = None,
        embedding_config: Optional[EmbeddingConfig] = None,
        message_ids: Optional[List[str]] = None,
    ):
        """
        Update an existing agent

        Args:
            agent_id (str): ID of the agent
            name (str): Name of the agent
            description (str): Description of the agent
            system (str): System configuration
            tools (List[str]): List of tools
            metadata (Dict): Metadata
            llm_config (LLMConfig): LLM configuration
            embedding_config (EmbeddingConfig): Embedding configuration
            message_ids (List[str]): List of message IDs
            tags (List[str]): Tags for filtering agents

        Returns:
            agent_state (AgentState): State of the updated agent
        """
        # TODO: add the ability to reset linked block_ids
        self.interface.clear()
        agent_state = self.server.agent_manager.update_agent(
            agent_id,
            UpdateAgent(
                name=name,
                system=system,
                tool_ids=tool_ids,
                tags=tags,
                description=description,
                metadata=metadata,
                llm_config=llm_config,
                embedding_config=embedding_config,
                message_ids=message_ids,
            ),
            actor=self.user,
        )
        return agent_state

    def get_tools_from_agent(self, agent_id: str) -> List[Tool]:
        """
        Get tools from an existing agent.

        Args:
            agent_id (str): ID of the agent

        Returns:
            List[Tool]: A list of Tool objs
        """
        self.interface.clear()
        return self.server.agent_manager.get_agent_by_id(agent_id=agent_id, actor=self.user).tools

    def attach_tool(self, agent_id: str, tool_id: str) -> AgentState:
        """
        Add tool to an existing agent

        Args:
            agent_id (str): ID of the agent
            tool_id (str): A tool id

        Returns:
            agent_state (AgentState): State of the updated agent
        """
        self.interface.clear()
        agent_state = self.server.agent_manager.attach_tool(agent_id=agent_id, tool_id=tool_id, actor=self.user)
        return agent_state

    def detach_tool(self, agent_id: str, tool_id: str) -> AgentState:
        """
        Removes tools from an existing agent

        Args:
            agent_id (str): ID of the agent
            tool_id (str): The tool id

        Returns:
            agent_state (AgentState): State of the updated agent
        """
        self.interface.clear()
        agent_state = self.server.agent_manager.detach_tool(agent_id=agent_id, tool_id=tool_id, actor=self.user)
        return agent_state

    def rename_agent(self, agent_id: str, new_name: str) -> AgentState:
        """
        Rename an agent

        Args:
            agent_id (str): ID of the agent
            new_name (str): New name for the agent

        Returns:
            agent_state (AgentState): State of the updated agent
        """
        return self.update_agent(agent_id, name=new_name)

    def delete_agent(self, agent_id: str) -> None:
        """
        Delete an agent

        Args:
            agent_id (str): ID of the agent to delete
        """
        self.server.agent_manager.delete_agent(agent_id=agent_id, actor=self.user)

    def get_agent_by_name(self, agent_name: str) -> AgentState:
        """
        Get an agent by its name

        Args:
            agent_name (str): Name of the agent

        Returns:
            agent_state (AgentState): State of the agent
        """
        self.interface.clear()
        return self.server.agent_manager.get_agent_by_name(agent_name=agent_name, actor=self.user)

    def get_agent(self, agent_id: str) -> AgentState:
        """
        Get an agent's state by its ID.

        Args:
            agent_id (str): ID of the agent

        Returns:
            agent_state (AgentState): State representation of the agent
        """
        self.interface.clear()
        return self.server.agent_manager.get_agent_by_id(agent_id=agent_id, actor=self.user)

    def get_agent_id(self, agent_name: str) -> Optional[str]:
        """
        Get the ID of an agent by name (names are unique per user)

        Args:
            agent_name (str): Name of the agent

        Returns:
            agent_id (str): ID of the agent
        """

        self.interface.clear()
        assert agent_name, f"Agent name must be provided"

        # TODO: Refactor this futher to not have downstream users expect Optionals - this should just error
        try:
            return self.server.agent_manager.get_agent_by_name(agent_name=agent_name, actor=self.user).id
        except NoResultFound:
            return None

    # memory
    def get_in_context_memory(self, agent_id: str) -> Memory:
        """
        Get the in-context (i.e. core) memory of an agent

        Args:
            agent_id (str): ID of the agent

        Returns:
            memory (Memory): In-context memory of the agent
        """
        memory = self.server.get_agent_memory(agent_id=agent_id, actor=self.user)
        return memory

    def get_core_memory(self, agent_id: str) -> Memory:
        return self.get_in_context_memory(agent_id)

    def update_in_context_memory(self, agent_id: str, section: str, value: Union[List[str], str]) -> Memory:
        """
        Update the in-context memory of an agent

        Args:
            agent_id (str): ID of the agent

        Returns:
            memory (Memory): The updated in-context memory of the agent

        """
        # TODO: implement this (not sure what it should look like)
        memory = self.server.update_agent_core_memory(agent_id=agent_id, label=section, value=value, actor=self.user)
        return memory

    def get_archival_memory_summary(self, agent_id: str) -> ArchivalMemorySummary:
        """
        Get a summary of the archival memory of an agent

        Args:
            agent_id (str): ID of the agent

        Returns:
            summary (ArchivalMemorySummary): Summary of the archival memory

        """
        return self.server.get_archival_memory_summary(agent_id=agent_id, actor=self.user)

    def get_recall_memory_summary(self, agent_id: str) -> RecallMemorySummary:
        """
        Get a summary of the recall memory of an agent

        Args:
            agent_id (str): ID of the agent

        Returns:
            summary (RecallMemorySummary): Summary of the recall memory
        """
        return self.server.get_recall_memory_summary(agent_id=agent_id, actor=self.user)

    def get_in_context_messages(self, agent_id: str) -> List[Message]:
        """
        Get in-context messages of an agent

        Args:
            agent_id (str): ID of the agent

        Returns:
            messages (List[Message]): List of in-context messages
        """
        return self.server.agent_manager.get_in_context_messages(agent_id=agent_id, actor=self.user)

    # agent interactions

    def send_messages(
        self,
        agent_id: str,
        messages: List[Union[Message | MessageCreate]],
    ):
        """
        Send pre-packed messages to an agent.

        Args:
            agent_id (str): ID of the agent
            messages (List[Union[Message | MessageCreate]]): List of messages to send

        Returns:
            response (LettaResponse): Response from the agent
        """
        self.interface.clear()
        usage = self.server.send_messages(actor=self.user, agent_id=agent_id, messages=messages)

        # format messages
        return LettaResponse(messages=messages, usage=usage)

    def send_message(
        self,
        message: str,
        role: str,
        name: Optional[str] = None,
        agent_id: Optional[str] = None,
        agent_name: Optional[str] = None,
        stream_steps: bool = False,
        stream_tokens: bool = False,
    ) -> LettaResponse:
        """
        Send a message to an agent

        Args:
            message (str): Message to send
            role (str): Role of the message
            agent_id (str): ID of the agent
            name(str): Name of the sender
            stream (bool): Stream the response (default: `False`)

        Returns:
            response (LettaResponse): Response from the agent
        """
        if not agent_id:
            # lookup agent by name
            assert agent_name, f"Either agent_id or agent_name must be provided"
            agent_id = self.get_agent_id(agent_name=agent_name)
            assert agent_id, f"Agent with name {agent_name} not found"

        if stream_steps or stream_tokens:
            # TODO: implement streaming with stream=True/False
            raise NotImplementedError
        self.interface.clear()

        usage = self.server.send_messages(
            actor=self.user,
            agent_id=agent_id,
            messages=[MessageCreate(role=MessageRole(role), content=message, name=name)],
        )

        ## TODO: need to make sure date/timestamp is propely passed
        ## TODO: update self.interface.to_list() to return actual Message objects
        ##       here, the message objects will have faulty created_by timestamps
        # messages = self.interface.to_list()
        # for m in messages:
        #    assert isinstance(m, Message), f"Expected Message object, got {type(m)}"
        # letta_messages = []
        # for m in messages:
        #    letta_messages += m.to_letta_message()
        # return LettaResponse(messages=letta_messages, usage=usage)

        # format messages
        messages = self.interface.to_list()
        letta_messages = []
        for m in messages:
            letta_messages += m.to_letta_message()

        return LettaResponse(messages=letta_messages, usage=usage)

    def user_message(self, agent_id: str, message: str) -> LettaResponse:
        """
        Send a message to an agent as a user

        Args:
            agent_id (str): ID of the agent
            message (str): Message to send

        Returns:
            response (LettaResponse): Response from the agent
        """
        self.interface.clear()
        return self.send_message(role="user", agent_id=agent_id, message=message)

    def run_command(self, agent_id: str, command: str) -> LettaResponse:
        """
        Run a command on the agent

        Args:
            agent_id (str): The agent ID
            command (str): The command to run

        Returns:
            LettaResponse: The response from the agent

        """
        self.interface.clear()
        usage = self.server.run_command(user_id=self.user_id, agent_id=agent_id, command=command)

        # NOTE: messages/usage may be empty, depending on the command
        return LettaResponse(messages=self.interface.to_list(), usage=usage)

    # archival memory

    # humans / personas

    def get_block_id(self, name: str, label: str) -> str:
        block = self.server.block_manager.get_blocks(actor=self.user, template_name=name, label=label, is_template=True)
        if not block:
            return None
        return block[0].id

    def create_human(self, name: str, text: str):
        """
        Create a human block template (saved human string to pre-fill `ChatMemory`)

        Args:
            name (str): Name of the human block
            text (str): Text of the human block

        Returns:
            human (Human): Human block
        """
        return self.server.block_manager.create_or_update_block(Human(template_name=name, value=text), actor=self.user)

    def create_persona(self, name: str, text: str):
        """
        Create a persona block template (saved persona string to pre-fill `ChatMemory`)

        Args:
            name (str): Name of the persona block
            text (str): Text of the persona block

        Returns:
            persona (Persona): Persona block
        """
        return self.server.block_manager.create_or_update_block(Persona(template_name=name, value=text), actor=self.user)

    def list_humans(self):
        """
        List available human block templates

        Returns:
            humans (List[Human]): List of human blocks
        """
        return self.server.block_manager.get_blocks(actor=self.user, label="human", is_template=True)

    def list_personas(self) -> List[Persona]:
        """
        List available persona block templates

        Returns:
            personas (List[Persona]): List of persona blocks
        """
        return self.server.block_manager.get_blocks(actor=self.user, label="persona", is_template=True)

    def update_human(self, human_id: str, text: str):
        """
        Update a human block template

        Args:
            human_id (str): ID of the human block
            text (str): Text of the human block

        Returns:
            human (Human): Updated human block
        """
        return self.server.block_manager.update_block(
            block_id=human_id, block_update=UpdateHuman(value=text, is_template=True), actor=self.user
        )

    def update_persona(self, persona_id: str, text: str):
        """
        Update a persona block template

        Args:
            persona_id (str): ID of the persona block
            text (str): Text of the persona block

        Returns:
            persona (Persona): Updated persona block
        """
        return self.server.block_manager.update_block(
            block_id=persona_id, block_update=UpdatePersona(value=text, is_template=True), actor=self.user
        )

    def get_persona(self, id: str) -> Persona:
        """
        Get a persona block template

        Args:
            id (str): ID of the persona block

        Returns:
            persona (Persona): Persona block
        """
        assert id, f"Persona ID must be provided"
        return Persona(**self.server.block_manager.get_block_by_id(id, actor=self.user).model_dump())

    def get_human(self, id: str) -> Human:
        """
        Get a human block template

        Args:
            id (str): ID of the human block

        Returns:
            human (Human): Human block
        """
        assert id, f"Human ID must be provided"
        return Human(**self.server.block_manager.get_block_by_id(id, actor=self.user).model_dump())

    def get_persona_id(self, name: str) -> str:
        """
        Get the ID of a persona block template

        Args:
            name (str): Name of the persona block

        Returns:
            id (str): ID of the persona block
        """
        persona = self.server.block_manager.get_blocks(actor=self.user, template_name=name, label="persona", is_template=True)
        if not persona:
            return None
        return persona[0].id

    def get_human_id(self, name: str) -> str:
        """
        Get the ID of a human block template

        Args:
            name (str): Name of the human block

        Returns:
            id (str): ID of the human block
        """
        human = self.server.block_manager.get_blocks(actor=self.user, template_name=name, label="human", is_template=True)
        if not human:
            return None
        return human[0].id

    def delete_persona(self, id: str):
        """
        Delete a persona block template

        Args:
            id (str): ID of the persona block
        """
        self.delete_block(id)

    def delete_human(self, id: str):
        """
        Delete a human block template

        Args:
            id (str): ID of the human block
        """
        self.delete_block(id)

    # tools
    def load_langchain_tool(self, langchain_tool: "LangChainBaseTool", additional_imports_module_attr_map: dict[str, str] = None) -> Tool:
        tool_create = ToolCreate.from_langchain(
            langchain_tool=langchain_tool,
            additional_imports_module_attr_map=additional_imports_module_attr_map,
        )
        return self.server.tool_manager.create_or_update_langchain_tool(tool_create=tool_create, actor=self.user)

    def load_composio_tool(self, action: "ActionType") -> Tool:
        tool_create = ToolCreate.from_composio(action_name=action.name)
        return self.server.tool_manager.create_or_update_composio_tool(tool_create=tool_create, actor=self.user)

    def create_tool(
        self,
        func,
        tags: Optional[List[str]] = None,
        description: Optional[str] = None,
        return_char_limit: int = FUNCTION_RETURN_CHAR_LIMIT,
    ) -> Tool:
        """
        Create a tool. This stores the source code of function on the server, so that the server can execute the function and generate an OpenAI JSON schemas for it when using with an agent.

        Args:
            func (callable): The function to create a tool for.
            tags (Optional[List[str]], optional): Tags for the tool. Defaults to None.
            description (str, optional): The description.
            return_char_limit (int): The character limit for the tool's return value. Defaults to FUNCTION_RETURN_CHAR_LIMIT.

        Returns:
            tool (Tool): The created tool.
        """
        # TODO: check if tool already exists
        # TODO: how to load modules?
        # parse source code/schema
        source_code = parse_source_code(func)
        source_type = "python"
        name = func.__name__  # Initialize name using function's __name__
        if not tags:
            tags = []

        # call server function
        return self.server.tool_manager.create_tool(
            Tool(
                source_type=source_type,
                source_code=source_code,
                name=name,
                tags=tags,
                description=description,
                return_char_limit=return_char_limit,
            ),
            actor=self.user,
        )

    def create_or_update_tool(
        self,
        func,
        tags: Optional[List[str]] = None,
        description: Optional[str] = None,
        return_char_limit: int = FUNCTION_RETURN_CHAR_LIMIT,
    ) -> Tool:
        """
        Creates or updates a tool. This stores the source code of function on the server, so that the server can execute the function and generate an OpenAI JSON schemas for it when using with an agent.

        Args:
            func (callable): The function to create a tool for.
            tags (Optional[List[str]], optional): Tags for the tool. Defaults to None.
            description (str, optional): The description.
            return_char_limit (int): The character limit for the tool's return value. Defaults to FUNCTION_RETURN_CHAR_LIMIT.

        Returns:
            tool (Tool): The created tool.
        """
        source_code = parse_source_code(func)
        source_type = "python"
        if not tags:
            tags = []

        # call server function
        return self.server.tool_manager.create_or_update_tool(
            Tool(
                source_type=source_type,
                source_code=source_code,
                tags=tags,
                description=description,
                return_char_limit=return_char_limit,
            ),
            actor=self.user,
        )

    def update_tool(
        self,
        id: str,
        description: Optional[str] = None,
        func: Optional[Callable] = None,
        tags: Optional[List[str]] = None,
        return_char_limit: int = FUNCTION_RETURN_CHAR_LIMIT,
    ) -> Tool:
        """
        Update a tool with provided parameters (name, func, tags)

        Args:
            id (str): ID of the tool
            func (callable): Function to wrap in a tool
            tags (List[str]): Tags for the tool
            return_char_limit (int): The character limit for the tool's return value. Defaults to FUNCTION_RETURN_CHAR_LIMIT.

        Returns:
            tool (Tool): Updated tool
        """
        update_data = {
            "source_type": "python",  # Always include source_type
            "source_code": parse_source_code(func) if func else None,
            "tags": tags,
            "description": description,
            "return_char_limit": return_char_limit,
        }

        # Filter out any None values from the dictionary
        update_data = {key: value for key, value in update_data.items() if value is not None}

        return self.server.tool_manager.update_tool_by_id(tool_id=id, tool_update=ToolUpdate(**update_data), actor=self.user)

    def list_tools(self, after: Optional[str] = None, limit: Optional[int] = 50) -> List[Tool]:
        """
        List available tools for the user.

        Returns:
            tools (List[Tool]): List of tools
        """
        return self.server.tool_manager.list_tools(after=after, limit=limit, actor=self.user)

    def get_tool(self, id: str) -> Optional[Tool]:
        """
        Get a tool given its ID.

        Args:
            id (str): ID of the tool

        Returns:
            tool (Tool): Tool
        """
        return self.server.tool_manager.get_tool_by_id(id, actor=self.user)

    def delete_tool(self, id: str):
        """
        Delete a tool given the ID.

        Args:
            id (str): ID of the tool
        """
        return self.server.tool_manager.delete_tool_by_id(id, actor=self.user)

    def get_tool_id(self, name: str) -> Optional[str]:
        """
        Get the ID of a tool from its name. The client will use the org_id it is configured with.

        Args:
            name (str): Name of the tool

        Returns:
            id (str): ID of the tool (`None` if not found)
        """
        tool = self.server.tool_manager.get_tool_by_name(tool_name=name, actor=self.user)
        return tool.id if tool else None

    def list_attached_tools(self, agent_id: str) -> List[Tool]:
        """
        List all tools attached to an agent.

        Args:
            agent_id (str): ID of the agent

        Returns:
            List[Tool]: List of tools attached to the agent
        """
        return self.server.agent_manager.list_attached_tools(agent_id=agent_id, actor=self.user)

    def load_data(self, connector: DataConnector, source_name: str):
        """
        Load data into a source

        Args:
            connector (DataConnector): Data connector
            source_name (str): Name of the source
        """
        self.server.load_data(user_id=self.user_id, connector=connector, source_name=source_name)

    def load_file_to_source(self, filename: str, source_id: str, blocking=True):
        """
        Load a file into a source

        Args:
            filename (str): Name of the file
            source_id (str): ID of the source
            blocking (bool): Block until the job is complete

        Returns:
            job (Job): Data loading job including job status and metadata
        """
        job = Job(
            user_id=self.user_id,
            status=JobStatus.created,
            metadata={"type": "embedding", "filename": filename, "source_id": source_id},
        )
        job = self.server.job_manager.create_job(pydantic_job=job, actor=self.user)

        # TODO: implement blocking vs. non-blocking
        self.server.load_file_to_source(source_id=source_id, file_path=filename, job_id=job.id, actor=self.user)
        return job

    def delete_file_from_source(self, source_id: str, file_id: str) -> None:
        self.server.source_manager.delete_file(file_id, actor=self.user)

    def get_job(self, job_id: str):
        return self.server.job_manager.get_job_by_id(job_id=job_id, actor=self.user)

    def delete_job(self, job_id: str):
        return self.server.job_manager.delete_job_by_id(job_id=job_id, actor=self.user)

    def list_jobs(self):
        return self.server.job_manager.list_jobs(actor=self.user)

    def list_active_jobs(self):
        return self.server.job_manager.list_jobs(actor=self.user, statuses=[JobStatus.created, JobStatus.running])

    def create_source(self, name: str, embedding_config: Optional[EmbeddingConfig] = None) -> Source:
        """
        Create a source

        Args:
            name (str): Name of the source

        Returns:
            source (Source): Created source
        """
        assert embedding_config or self._default_embedding_config, f"Must specify embedding_config for source"
        source = Source(
            name=name, embedding_config=embedding_config or self._default_embedding_config, organization_id=self.user.organization_id
        )
        return self.server.source_manager.create_source(source=source, actor=self.user)

    def delete_source(self, source_id: str):
        """
        Delete a source

        Args:
            source_id (str): ID of the source
        """

        # TODO: delete source data
        self.server.delete_source(source_id=source_id, actor=self.user)

    def get_source(self, source_id: str) -> Source:
        """
        Get a source given the ID.

        Args:
            source_id (str): ID of the source

        Returns:
            source (Source): Source
        """
        return self.server.source_manager.get_source_by_id(source_id=source_id, actor=self.user)

    def get_source_id(self, source_name: str) -> str:
        """
        Get the ID of a source

        Args:
            source_name (str): Name of the source

        Returns:
            source_id (str): ID of the source
        """
        return self.server.source_manager.get_source_by_name(source_name=source_name, actor=self.user).id

    def attach_source(self, agent_id: str, source_id: Optional[str] = None, source_name: Optional[str] = None) -> AgentState:
        """
        Attach a source to an agent

        Args:
            agent_id (str): ID of the agent
            source_id (str): ID of the source
            source_name (str): Name of the source
        """
        if source_name:
            source = self.server.source_manager.get_source_by_id(source_id=source_id, actor=self.user)
            source_id = source.id

        return self.server.agent_manager.attach_source(source_id=source_id, agent_id=agent_id, actor=self.user)

    def detach_source(self, agent_id: str, source_id: Optional[str] = None, source_name: Optional[str] = None) -> AgentState:
        """
        Detach a source from an agent by removing all `Passage` objects that were loaded from the source from archival memory.
        Args:
            agent_id (str): ID of the agent
            source_id (str): ID of the source
            source_name (str): Name of the source
        Returns:
            source (Source): Detached source
        """
        if source_name:
            source = self.server.source_manager.get_source_by_id(source_id=source_id, actor=self.user)
            source_id = source.id
        return self.server.agent_manager.detach_source(agent_id=agent_id, source_id=source_id, actor=self.user)

    def list_sources(self) -> List[Source]:
        """
        List available sources

        Returns:
            sources (List[Source]): List of sources
        """

        return self.server.list_all_sources(actor=self.user)

    def list_attached_sources(self, agent_id: str) -> List[Source]:
        """
        List sources attached to an agent

        Args:
            agent_id (str): ID of the agent

        Returns:
            sources (List[Source]): List of sources
        """
        return self.server.agent_manager.list_attached_sources(agent_id=agent_id, actor=self.user)

    def list_files_from_source(self, source_id: str, limit: int = 1000, after: Optional[str] = None) -> List[FileMetadata]:
        """
        List files from source.

        Args:
            source_id (str): ID of the source
            limit (int): The # of items to return
            after (str): The cursor for fetching the next page

        Returns:
            files (List[FileMetadata]): List of files
        """
        return self.server.source_manager.list_files(source_id=source_id, limit=limit, after=after, actor=self.user)

    def update_source(self, source_id: str, name: Optional[str] = None) -> Source:
        """
        Update a source

        Args:
            source_id (str): ID of the source
            name (str): Name of the source

        Returns:
            source (Source): Updated source
        """
        # TODO should the arg here just be "source_update: Source"?
        request = SourceUpdate(name=name)
        return self.server.source_manager.update_source(source_id=source_id, source_update=request, actor=self.user)

    # archival memory

    def insert_archival_memory(self, agent_id: str, memory: str) -> List[Passage]:
        """
        Insert archival memory into an agent

        Args:
            agent_id (str): ID of the agent
            memory (str): Memory string to insert

        Returns:
            passages (List[Passage]): List of inserted passages
        """
        return self.server.insert_archival_memory(agent_id=agent_id, memory_contents=memory, actor=self.user)

    def delete_archival_memory(self, agent_id: str, memory_id: str):
        """
        Delete archival memory from an agent

        Args:
            agent_id (str): ID of the agent
            memory_id (str): ID of the memory
        """
        self.server.delete_archival_memory(memory_id=memory_id, actor=self.user)

    def get_archival_memory(
        self, agent_id: str, before: Optional[str] = None, after: Optional[str] = None, limit: Optional[int] = 1000
    ) -> List[Passage]:
        """
        Get archival memory from an agent with pagination.

        Args:
            agent_id (str): ID of the agent
            before (str): Get memories before a certain time
            after (str): Get memories after a certain time
            limit (int): Limit number of memories

        Returns:
            passages (List[Passage]): List of passages
        """

        return self.server.get_agent_archival(user_id=self.user_id, agent_id=agent_id, limit=limit)

    # recall memory

    def get_messages(
        self, agent_id: str, before: Optional[str] = None, after: Optional[str] = None, limit: Optional[int] = 1000
    ) -> List[LettaMessage]:
        """
        Get messages from an agent with pagination.

        Args:
            agent_id (str): ID of the agent
            before (str): Get messages before a certain time
            after (str): Get messages after a certain time
            limit (int): Limit number of messages

        Returns:
            messages (List[Message]): List of messages
        """

        self.interface.clear()
        return self.server.get_agent_recall(
            user_id=self.user_id,
            agent_id=agent_id,
            before=before,
            after=after,
            limit=limit,
            reverse=True,
            return_message_object=False,
        )

    def list_blocks(self, label: Optional[str] = None, templates_only: Optional[bool] = True) -> List[Block]:
        """
        List available blocks

        Args:
            label (str): Label of the block
            templates_only (bool): List only templates

        Returns:
            blocks (List[Block]): List of blocks
        """
        return self.server.block_manager.get_blocks(actor=self.user, label=label, is_template=templates_only)

    def create_block(
        self, label: str, value: str, limit: Optional[int] = None, template_name: Optional[str] = None, is_template: bool = False
    ) -> Block:  #
        """
        Create a block

        Args:
            label (str): Label of the block
            name (str): Name of the block
            text (str): Text of the block
            limit (int): Character of the block

        Returns:
            block (Block): Created block
        """
        block = Block(label=label, template_name=template_name, value=value, is_template=is_template)
        if limit:
            block.limit = limit
        return self.server.block_manager.create_or_update_block(block, actor=self.user)

    def update_block(self, block_id: str, name: Optional[str] = None, text: Optional[str] = None, limit: Optional[int] = None) -> Block:
        """
        Update a block

        Args:
            block_id (str): ID of the block
            name (str): Name of the block
            text (str): Text of the block

        Returns:
            block (Block): Updated block
        """
        return self.server.block_manager.update_block(
            block_id=block_id,
            block_update=BlockUpdate(template_name=name, value=text, limit=limit if limit else self.get_block(block_id).limit),
            actor=self.user,
        )

    def get_block(self, block_id: str) -> Block:
        """
        Get a block

        Args:
            block_id (str): ID of the block

        Returns:
            block (Block): Block
        """
        return self.server.block_manager.get_block_by_id(block_id, actor=self.user)

    def delete_block(self, id: str) -> Block:
        """
        Delete a block

        Args:
            id (str): ID of the block

        Returns:
            block (Block): Deleted block
        """
        return self.server.block_manager.delete_block(id, actor=self.user)

    def set_default_llm_config(self, llm_config: LLMConfig):
        """
        Set the default LLM configuration for agents.

        Args:
            llm_config (LLMConfig): LLM configuration
        """
        self._default_llm_config = llm_config

    def set_default_embedding_config(self, embedding_config: EmbeddingConfig):
        """
        Set the default embedding configuration for agents.

        Args:
            embedding_config (EmbeddingConfig): Embedding configuration
        """
        self._default_embedding_config = embedding_config

    def list_llm_configs(self) -> List[LLMConfig]:
        """
        List available LLM configurations

        Returns:
            configs (List[LLMConfig]): List of LLM configurations
        """
        return self.server.list_llm_models()

    def list_embedding_configs(self) -> List[EmbeddingConfig]:
        """
        List available embedding configurations

        Returns:
            configs (List[EmbeddingConfig]): List of embedding configurations
        """
        return self.server.list_embedding_models()

    def create_org(self, name: Optional[str] = None) -> Organization:
        return self.server.organization_manager.create_organization(pydantic_org=Organization(name=name))

    def list_orgs(self, after: Optional[str] = None, limit: Optional[int] = 50) -> List[Organization]:
        return self.server.organization_manager.list_organizations(limit=limit, after=after)

    def delete_org(self, org_id: str) -> Organization:
        return self.server.organization_manager.delete_organization_by_id(org_id=org_id)

    def create_sandbox_config(self, config: Union[LocalSandboxConfig, E2BSandboxConfig]) -> SandboxConfig:
        """
        Create a new sandbox configuration.
        """
        config_create = SandboxConfigCreate(config=config)
        return self.server.sandbox_config_manager.create_or_update_sandbox_config(sandbox_config_create=config_create, actor=self.user)

    def update_sandbox_config(self, sandbox_config_id: str, config: Union[LocalSandboxConfig, E2BSandboxConfig]) -> SandboxConfig:
        """
        Update an existing sandbox configuration.
        """
        sandbox_update = SandboxConfigUpdate(config=config)
        return self.server.sandbox_config_manager.update_sandbox_config(
            sandbox_config_id=sandbox_config_id, sandbox_update=sandbox_update, actor=self.user
        )

    def delete_sandbox_config(self, sandbox_config_id: str) -> None:
        """
        Delete a sandbox configuration.
        """
        return self.server.sandbox_config_manager.delete_sandbox_config(sandbox_config_id=sandbox_config_id, actor=self.user)

    def list_sandbox_configs(self, limit: int = 50, after: Optional[str] = None) -> List[SandboxConfig]:
        """
        List all sandbox configurations.
        """
        return self.server.sandbox_config_manager.list_sandbox_configs(actor=self.user, limit=limit, after=after)

    def create_sandbox_env_var(
        self, sandbox_config_id: str, key: str, value: str, description: Optional[str] = None
    ) -> SandboxEnvironmentVariable:
        """
        Create a new environment variable for a sandbox configuration.
        """
        env_var_create = SandboxEnvironmentVariableCreate(key=key, value=value, description=description)
        return self.server.sandbox_config_manager.create_sandbox_env_var(
            env_var_create=env_var_create, sandbox_config_id=sandbox_config_id, actor=self.user
        )

    def update_sandbox_env_var(
        self, env_var_id: str, key: Optional[str] = None, value: Optional[str] = None, description: Optional[str] = None
    ) -> SandboxEnvironmentVariable:
        """
        Update an existing environment variable.
        """
        env_var_update = SandboxEnvironmentVariableUpdate(key=key, value=value, description=description)
        return self.server.sandbox_config_manager.update_sandbox_env_var(
            env_var_id=env_var_id, env_var_update=env_var_update, actor=self.user
        )

    def delete_sandbox_env_var(self, env_var_id: str) -> None:
        """
        Delete an environment variable by its ID.
        """
        return self.server.sandbox_config_manager.delete_sandbox_env_var(env_var_id=env_var_id, actor=self.user)

    def list_sandbox_env_vars(
        self, sandbox_config_id: str, limit: int = 50, after: Optional[str] = None
    ) -> List[SandboxEnvironmentVariable]:
        """
        List all environment variables associated with a sandbox configuration.
        """
        return self.server.sandbox_config_manager.list_sandbox_env_vars(
            sandbox_config_id=sandbox_config_id, actor=self.user, limit=limit, after=after
        )

    def update_agent_memory_block_label(self, agent_id: str, current_label: str, new_label: str) -> Memory:
        """Rename a block in the agent's core memory

        Args:
            agent_id (str): The agent ID
            current_label (str): The current label of the block
            new_label (str): The new label of the block

        Returns:
            memory (Memory): The updated memory
        """
        block = self.get_agent_memory_block(agent_id, current_label)
        return self.update_block(block.id, label=new_label)

    def get_agent_memory_blocks(self, agent_id: str) -> List[Block]:
        """
        Get all the blocks in the agent's core memory

        Args:
            agent_id (str): The agent ID

        Returns:
            blocks (List[Block]): The blocks in the agent's core memory
        """
        agent = self.server.agent_manager.get_agent_by_id(agent_id=agent_id, actor=self.user)
        return agent.memory.blocks

    def get_agent_memory_block(self, agent_id: str, label: str) -> Block:
        """
        Get a block in the agent's core memory by its label

        Args:
            agent_id (str): The agent ID
            label (str): The label in the agent's core memory

        Returns:
            block (Block): The block corresponding to the label
        """
        return self.server.agent_manager.get_block_with_label(agent_id=agent_id, block_label=label, actor=self.user)

    def update_agent_memory_block(
        self,
        agent_id: str,
        label: str,
        value: Optional[str] = None,
        limit: Optional[int] = None,
    ):
        """
        Update a block in the agent's core memory by specifying its label

        Args:
            agent_id (str): The agent ID
            label (str): The label of the block
            value (str): The new value of the block
            limit (int): The new limit of the block

        Returns:
            block (Block): The updated block
        """
        block = self.get_agent_memory_block(agent_id, label)
        data = {}
        if value:
            data["value"] = value
        if limit:
            data["limit"] = limit
        return self.server.block_manager.update_block(block.id, actor=self.user, block_update=BlockUpdate(**data))

    def update_block(
        self,
        block_id: str,
        label: Optional[str] = None,
        value: Optional[str] = None,
        limit: Optional[int] = None,
    ):
        """
        Update a block given the ID with the provided fields

        Args:
            block_id (str): ID of the block
            label (str): Label to assign to the block
            value (str): Value to assign to the block
            limit (int): Token limit to assign to the block

        Returns:
            block (Block): Updated block
        """
        data = {}
        if value:
            data["value"] = value
        if limit:
            data["limit"] = limit
        if label:
            data["label"] = label
        return self.server.block_manager.update_block(block_id, actor=self.user, block_update=BlockUpdate(**data))

    def attach_block(self, agent_id: str, block_id: str) -> AgentState:
        """
        Attach a block to an agent.

        Args:
            agent_id (str): ID of the agent
            block_id (str): ID of the block to attach
        """
        return self.server.agent_manager.attach_block(agent_id=agent_id, block_id=block_id, actor=self.user)

    def detach_block(self, agent_id: str, block_id: str) -> AgentState:
        """
        Detach a block from an agent.

        Args:
            agent_id (str): ID of the agent
            block_id (str): ID of the block to detach
        """
        return self.server.agent_manager.detach_block(agent_id=agent_id, block_id=block_id, actor=self.user)

    def get_run_messages(
        self,
        run_id: str,
        before: Optional[str] = None,
        after: Optional[str] = None,
        limit: Optional[int] = 100,
        ascending: bool = True,
        role: Optional[MessageRole] = None,
    ) -> List[LettaMessageUnion]:
        """
        Get messages associated with a job with filtering options.

        Args:
            run_id: ID of the run
            before: Cursor for pagination
            after: Cursor for pagination
            limit: Maximum number of messages to return
            ascending: Sort order by creation time
            role: Filter by message role (user/assistant/system/tool)
        Returns:
            List of messages matching the filter criteria
        """
        params = {
            "before": before,
            "after": after,
            "limit": limit,
            "ascending": ascending,
            "role": role,
        }

        return self.server.job_manager.get_run_messages(run_id=run_id, actor=self.user, **params)

    def get_run_usage(
        self,
        run_id: str,
    ) -> List[UsageStatistics]:
        """
        Get usage statistics associated with a job.

        Args:
            run_id (str): ID of the run

        Returns:
            List[UsageStatistics]: List of usage statistics associated with the run
        """
        usage = self.server.job_manager.get_job_usage(job_id=run_id, actor=self.user)
        return [
            UsageStatistics(completion_tokens=stat.completion_tokens, prompt_tokens=stat.prompt_tokens, total_tokens=stat.total_tokens)
            for stat in usage
        ]

    def get_run(self, run_id: str) -> Run:
        """
        Get a run by ID.

        Args:
            run_id (str): ID of the run

        Returns:
            run (Run): Run
        """
        return self.server.job_manager.get_job_by_id(job_id=run_id, actor=self.user)

    def delete_run(self, run_id: str) -> None:
        """
        Delete a run by ID.

        Args:
            run_id (str): ID of the run
        """
        return self.server.job_manager.delete_job_by_id(job_id=run_id, actor=self.user)

    def list_runs(self) -> List[Run]:
        """
        List all runs.

        Returns:
            runs (List[Run]): List of runs
        """
        return self.server.job_manager.list_jobs(actor=self.user, job_type=JobType.RUN)

    def list_active_runs(self) -> List[Run]:
        """
        List all active runs.

        Returns:
            runs (List[Run]): List of active runs
        """
        return self.server.job_manager.list_jobs(actor=self.user, job_type=JobType.RUN, statuses=[JobStatus.created, JobStatus.running])

    def get_tags(
        self,
        after: Optional[str] = None,
        limit: Optional[int] = None,
        query_text: Optional[str] = None,
    ) -> List[str]:
        """
        Get all tags.

        Returns:
            tags (List[str]): List of tags
        """
        return self.server.agent_manager.list_tags(actor=self.user, after=after, limit=limit, query_text=query_text)
