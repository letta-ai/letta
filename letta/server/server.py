import asyncio
import json
import os
import traceback
import warnings
from abc import abstractmethod
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple, Union

import httpx
from anthropic import AsyncAnthropic
from composio.client import Composio
from composio.client.collections import ActionModel, AppModel
from fastapi import HTTPException
from fastapi.responses import StreamingResponse

import letta.constants as constants
import letta.server.utils as server_utils
import letta.system as system
from letta.agent import Agent, save_agent
from letta.config import LettaConfig
from letta.constants import LETTA_TOOL_EXECUTION_DIR
from letta.data_sources.connectors import DataConnector, load_data
from letta.errors import HandleNotFoundError
from letta.functions.mcp_client.types import MCPServerType, MCPTool, MCPToolHealth, SSEServerConfig, StdioServerConfig
from letta.functions.schema_validator import validate_complete_json_schema
from letta.groups.helpers import load_multi_agent
from letta.helpers.datetime_helpers import get_utc_time
from letta.helpers.json_helpers import json_dumps, json_loads

# TODO use custom interface
from letta.interface import AgentInterface  # abstract
from letta.interface import CLIInterface  # for printing to terminal
from letta.log import get_logger
from letta.orm.errors import NoResultFound
from letta.otel.tracing import log_event, trace_method
from letta.prompts.gpt_system import get_system_text
from letta.schemas.agent import AgentState, AgentType, CreateAgent, UpdateAgent
from letta.schemas.block import Block, BlockUpdate, CreateBlock
from letta.schemas.embedding_config import EmbeddingConfig

# openai schemas
from letta.schemas.enums import JobStatus, MessageStreamStatus, ProviderCategory, ProviderType, SandboxType, ToolSourceType
from letta.schemas.environment_variables import SandboxEnvironmentVariableCreate
from letta.schemas.group import GroupCreate, ManagerType, SleeptimeManager, VoiceSleeptimeManager
from letta.schemas.job import Job, JobUpdate
from letta.schemas.letta_message import LegacyLettaMessage, LettaMessage, MessageType, ToolReturnMessage
from letta.schemas.letta_message_content import TextContent
from letta.schemas.letta_response import LettaResponse
from letta.schemas.letta_stop_reason import LettaStopReason, StopReasonType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.memory import ArchivalMemorySummary, Memory, RecallMemorySummary
from letta.schemas.message import Message, MessageCreate, MessageUpdate
from letta.schemas.passage import Passage, PassageUpdate
from letta.schemas.pip_requirement import PipRequirement
from letta.schemas.providers import (
    AnthropicProvider,
    AzureProvider,
    BedrockProvider,
    DeepSeekProvider,
    GoogleAIProvider,
    GoogleVertexProvider,
    GroqProvider,
    LettaProvider,
    LMStudioOpenAIProvider,
    OllamaProvider,
    OpenAIProvider,
    Provider,
    TogetherProvider,
    VLLMProvider,
    XAIProvider,
)
from letta.schemas.sandbox_config import LocalSandboxConfig, SandboxConfigCreate
from letta.schemas.source import Source
from letta.schemas.tool import Tool
from letta.schemas.usage import LettaUsageStatistics
from letta.schemas.user import User
from letta.server.rest_api.chat_completions_interface import ChatCompletionsStreamingInterface
from letta.server.rest_api.interface import StreamingServerInterface
from letta.server.rest_api.utils import sse_async_generator
from letta.services.agent_manager import AgentManager
from letta.services.agent_serialization_manager import AgentSerializationManager
from letta.services.archive_manager import ArchiveManager
from letta.services.block_manager import BlockManager
from letta.services.file_manager import FileManager
from letta.services.files_agents_manager import FileAgentManager
from letta.services.group_manager import GroupManager
from letta.services.helpers.tool_execution_helper import prepare_local_sandbox
from letta.services.identity_manager import IdentityManager
from letta.services.job_manager import JobManager
from letta.services.llm_batch_manager import LLMBatchManager
from letta.services.mcp.base_client import AsyncBaseMCPClient
from letta.services.mcp.sse_client import MCP_CONFIG_TOPLEVEL_KEY, AsyncSSEMCPClient
from letta.services.mcp.stdio_client import AsyncStdioMCPClient
from letta.services.mcp_manager import MCPManager
from letta.services.message_manager import MessageManager
from letta.services.organization_manager import OrganizationManager
from letta.services.passage_manager import PassageManager
from letta.services.provider_manager import ProviderManager
from letta.services.sandbox_config_manager import SandboxConfigManager
from letta.services.source_manager import SourceManager
from letta.services.step_manager import StepManager
from letta.services.telemetry_manager import TelemetryManager
from letta.services.tool_executor.tool_execution_manager import ToolExecutionManager
from letta.services.tool_manager import ToolManager
from letta.services.user_manager import UserManager
from letta.settings import DatabaseChoice, model_settings, settings, tool_settings
from letta.streaming_interface import AgentChunkStreamingInterface
from letta.utils import get_friendly_error_msg, get_persona_text, make_key

config = LettaConfig.load()
logger = get_logger(__name__)


class Server(object):
    """Abstract server class that supports multi-agent multi-user"""

    @abstractmethod
    def list_agents(self, user_id: str) -> dict:
        """List all available agents to a user"""
        raise NotImplementedError

    @abstractmethod
    def get_agent_memory(self, user_id: str, agent_id: str) -> dict:
        """Return the memory of an agent (core memory + non-core statistics)"""
        raise NotImplementedError

    @abstractmethod
    def get_server_config(self, user_id: str) -> dict:
        """Return the base config"""
        raise NotImplementedError

    @abstractmethod
    def update_agent_core_memory(self, user_id: str, agent_id: str, label: str, actor: User) -> Memory:
        """Update the agents core memory block, return the new state"""
        raise NotImplementedError

    @abstractmethod
    def create_agent(
        self,
        request: CreateAgent,
        actor: User,
        # interface
        interface: Union[AgentInterface, None] = None,
    ) -> AgentState:
        """Create a new agent using a config"""
        raise NotImplementedError

    @abstractmethod
    def user_message(self, user_id: str, agent_id: str, message: str) -> None:
        """Process a message from the user, internally calls step"""
        raise NotImplementedError

    @abstractmethod
    def system_message(self, user_id: str, agent_id: str, message: str) -> None:
        """Process a message from the system, internally calls step"""
        raise NotImplementedError

    @abstractmethod
    def send_messages(self, user_id: str, agent_id: str, input_messages: List[MessageCreate]) -> None:
        """Send a list of messages to the agent"""
        raise NotImplementedError

    @abstractmethod
    def run_command(self, user_id: str, agent_id: str, command: str) -> Union[str, None]:
        """Run a command on the agent, e.g. /memory

        May return a string with a message generated by the command
        """
        raise NotImplementedError


class SyncServer(Server):
    """Simple single-threaded / blocking server process"""

    def __init__(
        self,
        chaining: bool = True,
        max_chaining_steps: Optional[int] = 100,
        default_interface_factory: Callable[[], AgentChunkStreamingInterface] = lambda: CLIInterface(),
        init_with_default_org_and_user: bool = True,
        # default_interface: AgentInterface = CLIInterface(),
        # default_persistence_manager_cls: PersistenceManager = LocalStateManager,
        # auth_mode: str = "none",  # "none, "jwt", "external"
    ):
        """Server process holds in-memory agents that are being run"""
        # chaining = whether or not to run again if request_heartbeat=true
        self.chaining = chaining

        # if chaining == true, what's the max number of times we'll chain before yielding?
        # none = no limit, can go on forever
        self.max_chaining_steps = max_chaining_steps

        # The default interface that will get assigned to agents ON LOAD
        self.default_interface_factory = default_interface_factory

        # Initialize the metadata store
        config = LettaConfig.load()
        if settings.database_engine is DatabaseChoice.POSTGRES:
            config.recall_storage_type = "postgres"
            config.recall_storage_uri = settings.letta_pg_uri_no_default
            config.archival_storage_type = "postgres"
            config.archival_storage_uri = settings.letta_pg_uri_no_default
        config.save()
        self.config = config

        # Managers that interface with data models
        self.organization_manager = OrganizationManager()
        self.passage_manager = PassageManager()
        self.user_manager = UserManager()
        self.tool_manager = ToolManager()
        self.mcp_manager = MCPManager()
        self.block_manager = BlockManager()
        self.source_manager = SourceManager()
        self.sandbox_config_manager = SandboxConfigManager()
        self.message_manager = MessageManager()
        self.job_manager = JobManager()
        self.agent_manager = AgentManager()
        self.archive_manager = ArchiveManager()
        self.provider_manager = ProviderManager()
        self.step_manager = StepManager()
        self.identity_manager = IdentityManager()
        self.group_manager = GroupManager()
        self.batch_manager = LLMBatchManager()
        self.telemetry_manager = TelemetryManager()
        self.file_agent_manager = FileAgentManager()
        self.file_manager = FileManager()

        self.agent_serialization_manager = AgentSerializationManager(
            agent_manager=self.agent_manager,
            tool_manager=self.tool_manager,
            source_manager=self.source_manager,
            block_manager=self.block_manager,
            group_manager=self.group_manager,
            mcp_manager=self.mcp_manager,
            file_manager=self.file_manager,
            file_agent_manager=self.file_agent_manager,
            message_manager=self.message_manager,
        )

        # A resusable httpx client
        timeout = httpx.Timeout(connect=10.0, read=20.0, write=10.0, pool=10.0)
        limits = httpx.Limits(max_connections=100, max_keepalive_connections=80, keepalive_expiry=300)
        self.httpx_client = httpx.AsyncClient(timeout=timeout, follow_redirects=True, limits=limits)

        # Make default user and org
        if init_with_default_org_and_user:
            self.default_org = self.organization_manager.create_default_organization()
            self.default_user = self.user_manager.create_default_user()
            self.tool_manager.upsert_base_tools(actor=self.default_user)

            # Add composio keys to the tool sandbox env vars of the org
            if tool_settings.composio_api_key:
                manager = SandboxConfigManager()
                sandbox_config = manager.get_or_create_default_sandbox_config(sandbox_type=SandboxType.LOCAL, actor=self.default_user)

                manager.create_sandbox_env_var(
                    SandboxEnvironmentVariableCreate(key="COMPOSIO_API_KEY", value=tool_settings.composio_api_key),
                    sandbox_config_id=sandbox_config.id,
                    actor=self.default_user,
                )

            # For OSS users, create a local sandbox config
            oss_default_user = self.user_manager.get_default_user()
            use_venv = False if not tool_settings.tool_exec_venv_name else True
            venv_name = tool_settings.tool_exec_venv_name or "venv"
            tool_dir = tool_settings.tool_exec_dir or LETTA_TOOL_EXECUTION_DIR

            venv_dir = Path(tool_dir) / venv_name
            tool_path = Path(tool_dir)

            if tool_path.exists() and not tool_path.is_dir():
                logger.error(f"LETTA_TOOL_SANDBOX_DIR exists but is not a directory: {tool_dir}")
            else:
                if not tool_path.exists():
                    logger.warning(f"LETTA_TOOL_SANDBOX_DIR does not exist, creating now: {tool_dir}")
                    tool_path.mkdir(parents=True, exist_ok=True)

                if tool_settings.tool_exec_venv_name and not venv_dir.is_dir():
                    logger.warning(
                        f"Provided LETTA_TOOL_SANDBOX_VENV_NAME is not a valid venv ({venv_dir}), one will be created for you during tool execution."
                    )

                sandbox_config_create = SandboxConfigCreate(
                    config=LocalSandboxConfig(sandbox_dir=tool_settings.tool_exec_dir, use_venv=use_venv, venv_name=venv_name)
                )
                sandbox_config = self.sandbox_config_manager.create_or_update_sandbox_config(
                    sandbox_config_create=sandbox_config_create, actor=oss_default_user
                )
                logger.info(f"Successfully created default local sandbox config:\n{sandbox_config.get_local_config().model_dump()}")

                if use_venv and tool_settings.tool_exec_autoreload_venv:
                    prepare_local_sandbox(
                        sandbox_config.get_local_config(),
                        env=os.environ.copy(),
                        force_recreate=True,
                    )

        # collect providers (always has Letta as a default)
        self._enabled_providers: List[Provider] = [LettaProvider(name="letta")]
        if model_settings.openai_api_key:
            self._enabled_providers.append(
                OpenAIProvider(
                    name="openai",
                    api_key=model_settings.openai_api_key,
                    base_url=model_settings.openai_api_base,
                )
            )
        if model_settings.anthropic_api_key:
            self._enabled_providers.append(
                AnthropicProvider(
                    name="anthropic",
                    api_key=model_settings.anthropic_api_key,
                )
            )
        if model_settings.ollama_base_url:
            self._enabled_providers.append(
                OllamaProvider(
                    name="ollama",
                    base_url=model_settings.ollama_base_url,
                    api_key=None,
                    default_prompt_formatter=model_settings.default_prompt_formatter,
                )
            )
        if model_settings.gemini_api_key:
            self._enabled_providers.append(
                GoogleAIProvider(
                    name="google_ai",
                    api_key=model_settings.gemini_api_key,
                )
            )
        if model_settings.google_cloud_location and model_settings.google_cloud_project:
            self._enabled_providers.append(
                GoogleVertexProvider(
                    name="google_vertex",
                    google_cloud_project=model_settings.google_cloud_project,
                    google_cloud_location=model_settings.google_cloud_location,
                )
            )
        if model_settings.azure_api_key and model_settings.azure_base_url:
            assert model_settings.azure_api_version, "AZURE_API_VERSION is required"
            self._enabled_providers.append(
                AzureProvider(
                    name="azure",
                    api_key=model_settings.azure_api_key,
                    base_url=model_settings.azure_base_url,
                    api_version=model_settings.azure_api_version,
                )
            )
        if model_settings.groq_api_key:
            self._enabled_providers.append(
                GroqProvider(
                    name="groq",
                    api_key=model_settings.groq_api_key,
                )
            )
        if model_settings.together_api_key:
            self._enabled_providers.append(
                TogetherProvider(
                    name="together",
                    api_key=model_settings.together_api_key,
                    default_prompt_formatter=model_settings.default_prompt_formatter,
                )
            )
        if model_settings.vllm_api_base:
            # vLLM exposes both a /chat/completions and a /completions endpoint
            # NOTE: to use the /chat/completions endpoint, you need to specify extra flags on vLLM startup
            # see: https://docs.vllm.ai/en/stable/features/tool_calling.html
            # e.g. "... --enable-auto-tool-choice --tool-call-parser hermes"
            self._enabled_providers.append(
                VLLMProvider(
                    name="vllm",
                    base_url=model_settings.vllm_api_base,
                    default_prompt_formatter=model_settings.default_prompt_formatter,
                )
            )

        if model_settings.aws_access_key_id and model_settings.aws_secret_access_key and model_settings.aws_default_region:
            self._enabled_providers.append(
                BedrockProvider(
                    name="bedrock",
                    region=model_settings.aws_default_region,
                )
            )
        # Attempt to enable LM Studio by default
        if model_settings.lmstudio_base_url:
            # Auto-append v1 to the base URL
            lmstudio_url = (
                model_settings.lmstudio_base_url
                if model_settings.lmstudio_base_url.endswith("/v1")
                else model_settings.lmstudio_base_url + "/v1"
            )
            self._enabled_providers.append(LMStudioOpenAIProvider(name="lmstudio_openai", base_url=lmstudio_url))
        if model_settings.deepseek_api_key:
            self._enabled_providers.append(DeepSeekProvider(name="deepseek", api_key=model_settings.deepseek_api_key))
        if model_settings.xai_api_key:
            self._enabled_providers.append(XAIProvider(name="xai", api_key=model_settings.xai_api_key))

        # For MCP
        # TODO: remove this
        """Initialize the MCP clients (there may be multiple)"""
        self.mcp_clients: Dict[str, AsyncBaseMCPClient] = {}

        # TODO: Remove these in memory caches
        self._llm_config_cache = {}
        self._embedding_config_cache = {}

        # TODO: Replace this with the Anthropic client we have in house
        self.anthropic_async_client = AsyncAnthropic()

    async def init_mcp_clients(self):
        # TODO: remove this
        mcp_server_configs = self.get_mcp_servers()

        for server_name, server_config in mcp_server_configs.items():
            if server_config.type == MCPServerType.SSE:
                self.mcp_clients[server_name] = AsyncSSEMCPClient(server_config)
            elif server_config.type == MCPServerType.STDIO:
                self.mcp_clients[server_name] = AsyncStdioMCPClient(server_config)
            else:
                raise ValueError(f"Invalid MCP server config: {server_config}")

            try:
                await self.mcp_clients[server_name].connect_to_server()
            except Exception as e:
                logger.error(e)
                self.mcp_clients.pop(server_name)

        # Print out the tools that are connected
        for server_name, client in self.mcp_clients.items():
            logger.info(f"Attempting to fetch tools from MCP server: {server_name}")
            mcp_tools = await client.list_tools()
            logger.info(f"MCP tools connected: {', '.join([t.name for t in mcp_tools])}")
            logger.debug(f"MCP tools: {', '.join([str(t) for t in mcp_tools])}")

    def load_agent(self, agent_id: str, actor: User, interface: Union[AgentInterface, None] = None) -> Agent:
        """Updated method to load agents from persisted storage"""
        agent_state = self.agent_manager.get_agent_by_id(agent_id=agent_id, actor=actor)
        # TODO: Think about how to integrate voice sleeptime into sleeptime
        # TODO: Voice sleeptime agents turn into normal agents when being messaged
        if agent_state.multi_agent_group and agent_state.multi_agent_group.manager_type != ManagerType.voice_sleeptime:
            return load_multi_agent(
                group=agent_state.multi_agent_group, agent_state=agent_state, actor=actor, interface=interface, mcp_clients=self.mcp_clients
            )

        interface = interface or self.default_interface_factory()
        return Agent(agent_state=agent_state, interface=interface, user=actor, mcp_clients=self.mcp_clients)

    def _step(
        self,
        actor: User,
        agent_id: str,
        input_messages: List[MessageCreate],
        interface: Union[AgentInterface, None] = None,  # needed to getting responses
        put_inner_thoughts_first: bool = True,
        # timestamp: Optional[datetime],
    ) -> LettaUsageStatistics:
        """Send the input message through the agent"""
        # TODO: Thread actor directly through this function, since the top level caller most likely already retrieved the user
        logger.debug(f"Got input messages: {input_messages}")
        letta_agent = None
        try:
            letta_agent = self.load_agent(agent_id=agent_id, interface=interface, actor=actor)
            if letta_agent is None:
                raise KeyError(f"Agent (user={actor.id}, agent={agent_id}) is not loaded")

            # Determine whether or not to token stream based on the capability of the interface
            token_streaming = letta_agent.interface.streaming_mode if hasattr(letta_agent.interface, "streaming_mode") else False

            logger.debug("Starting agent step")
            if interface:
                metadata = interface.metadata if hasattr(interface, "metadata") else None
            else:
                metadata = None

            usage_stats = letta_agent.step(
                input_messages=input_messages,
                chaining=self.chaining,
                max_chaining_steps=self.max_chaining_steps,
                stream=token_streaming,
                skip_verify=True,
                metadata=metadata,
                put_inner_thoughts_first=put_inner_thoughts_first,
            )

        except Exception as e:
            logger.error(f"Error in server._step: {e}")
            print(traceback.print_exc())
            raise
        finally:
            logger.debug("Calling step_yield()")
            if letta_agent:
                letta_agent.interface.step_yield()

        return usage_stats

    def _command(self, user_id: str, agent_id: str, command: str) -> LettaUsageStatistics:
        """Process a CLI command"""
        # TODO: Thread actor directly through this function, since the top level caller most likely already retrieved the user
        actor = self.user_manager.get_user_or_default(user_id=user_id)

        logger.debug(f"Got command: {command}")

        # Get the agent object (loaded in memory)
        letta_agent = self.load_agent(agent_id=agent_id, actor=actor)
        usage = None

        if command.lower() == "exit":
            # exit not supported on server.py
            raise ValueError(command)

        elif command.lower() == "save" or command.lower() == "savechat":
            save_agent(letta_agent)

        elif command.lower() == "attach":
            # Different from CLI, we extract the data source name from the command
            command = command.strip().split()
            try:
                data_source = int(command[1])
            except:
                raise ValueError(command)

            # attach data to agent from source
            letta_agent.attach_source(
                user=self.user_manager.get_user_by_id(user_id=user_id),
                source_id=data_source,
                source_manager=self.source_manager,
                agent_manager=self.agent_manager,
            )

        elif command.lower() == "dump" or command.lower().startswith("dump "):
            # Check if there's an additional argument that's an integer
            command = command.strip().split()
            amount = int(command[1]) if len(command) > 1 and command[1].isdigit() else 0
            if amount == 0:
                letta_agent.interface.print_messages(letta_agent.messages, dump=True)
            else:
                letta_agent.interface.print_messages(letta_agent.messages[-min(amount, len(letta_agent.messages)) :], dump=True)

        elif command.lower() == "dumpraw":
            letta_agent.interface.print_messages_raw(letta_agent.messages)

        elif command.lower() == "memory":
            ret_str = "\nDumping memory contents:\n" + f"\n{str(letta_agent.agent_state.memory)}" + f"\n{str(letta_agent.passage_manager)}"
            return ret_str

        elif command.lower() == "pop" or command.lower().startswith("pop "):
            # Check if there's an additional argument that's an integer
            command = command.strip().split()
            pop_amount = int(command[1]) if len(command) > 1 and command[1].isdigit() else 3
            n_messages = len(letta_agent.messages)
            MIN_MESSAGES = 2
            if n_messages <= MIN_MESSAGES:
                logger.debug(f"Agent only has {n_messages} messages in stack, none left to pop")
            elif n_messages - pop_amount < MIN_MESSAGES:
                logger.debug(f"Agent only has {n_messages} messages in stack, cannot pop more than {n_messages - MIN_MESSAGES}")
            else:
                logger.debug(f"Popping last {pop_amount} messages from stack")
                for _ in range(min(pop_amount, len(letta_agent.messages))):
                    letta_agent.messages.pop()

        elif command.lower() == "retry":
            # TODO this needs to also modify the persistence manager
            logger.debug("Retrying for another answer")
            while len(letta_agent.messages) > 0:
                if letta_agent.messages[-1].get("role") == "user":
                    # we want to pop up to the last user message and send it again
                    letta_agent.messages[-1].get("content")
                    letta_agent.messages.pop()
                    break
                letta_agent.messages.pop()

        elif command.lower() == "rethink" or command.lower().startswith("rethink "):
            # TODO this needs to also modify the persistence manager
            if len(command) < len("rethink "):
                logger.warning("Missing text after the command")
            else:
                for x in range(len(letta_agent.messages) - 1, 0, -1):
                    if letta_agent.messages[x].get("role") == "assistant":
                        text = command[len("rethink ") :].strip()
                        letta_agent.messages[x].update({"content": text})
                        break

        elif command.lower() == "rewrite" or command.lower().startswith("rewrite "):
            # TODO this needs to also modify the persistence manager
            if len(command) < len("rewrite "):
                logger.warning("Missing text after the command")
            else:
                for x in range(len(letta_agent.messages) - 1, 0, -1):
                    if letta_agent.messages[x].get("role") == "assistant":
                        text = command[len("rewrite ") :].strip()
                        args = json_loads(letta_agent.messages[x].get("function_call").get("arguments"))
                        args["message"] = text
                        letta_agent.messages[x].get("function_call").update({"arguments": json_dumps(args)})
                        break

        # No skip options
        elif command.lower() == "wipe":
            # exit not supported on server.py
            raise ValueError(command)

        elif command.lower() == "heartbeat":
            input_message = system.get_heartbeat()
            usage = self._step(actor=actor, agent_id=agent_id, input_message=input_message)

        elif command.lower() == "memorywarning":
            input_message = system.get_token_limit_warning()
            usage = self._step(actor=actor, agent_id=agent_id, input_message=input_message)

        if not usage:
            usage = LettaUsageStatistics()

        return usage

    def user_message(
        self,
        user_id: str,
        agent_id: str,
        message: Union[str, Message],
        timestamp: Optional[datetime] = None,
    ) -> LettaUsageStatistics:
        """Process an incoming user message and feed it through the Letta agent"""
        try:
            actor = self.user_manager.get_user_by_id(user_id=user_id)
        except NoResultFound:
            raise ValueError(f"User user_id={user_id} does not exist")

        try:
            agent = self.agent_manager.get_agent_by_id(agent_id=agent_id, actor=actor)
        except NoResultFound:
            raise ValueError(f"Agent agent_id={agent_id} does not exist")

        # Basic input sanitization
        if isinstance(message, str):
            if len(message) == 0:
                raise ValueError(f"Invalid input: '{message}'")

            # If the input begins with a command prefix, reject
            elif message.startswith("/"):
                raise ValueError(f"Invalid input: '{message}'")

            packaged_user_message = system.package_user_message(
                user_message=message,
                timezone=agent.timezone,
            )

            # NOTE: eventually deprecate and only allow passing Message types
            message = MessageCreate(
                agent_id=agent_id,
                role="user",
                content=[TextContent(text=packaged_user_message)],
            )

        # Run the agent state forward
        usage = self._step(actor=actor, agent_id=agent_id, input_messages=[message])
        return usage

    def system_message(
        self,
        user_id: str,
        agent_id: str,
        message: Union[str, Message],
        timestamp: Optional[datetime] = None,
    ) -> LettaUsageStatistics:
        """Process an incoming system message and feed it through the Letta agent"""
        try:
            actor = self.user_manager.get_user_by_id(user_id=user_id)
        except NoResultFound:
            raise ValueError(f"User user_id={user_id} does not exist")

        try:
            agent = self.agent_manager.get_agent_by_id(agent_id=agent_id, actor=actor)
        except NoResultFound:
            raise ValueError(f"Agent agent_id={agent_id} does not exist")

        # Basic input sanitization
        if isinstance(message, str):
            if len(message) == 0:
                raise ValueError(f"Invalid input: '{message}'")

            # If the input begins with a command prefix, reject
            elif message.startswith("/"):
                raise ValueError(f"Invalid input: '{message}'")

            packaged_system_message = system.package_system_message(system_message=message)

            # NOTE: eventually deprecate and only allow passing Message types
            # Convert to a Message object

            if timestamp:
                message = Message(
                    agent_id=agent_id,
                    role="system",
                    content=[TextContent(text=packaged_system_message)],
                    created_at=timestamp,
                )
            else:
                message = Message(
                    agent_id=agent_id,
                    role="system",
                    content=[TextContent(text=packaged_system_message)],
                )

        if isinstance(message, Message):
            # Can't have a null text field
            message_text = message.content[0].text
            if message_text is None or len(message_text) == 0:
                raise ValueError(f"Invalid input: '{message_text}'")
            # If the input begins with a command prefix, reject
            elif message_text.startswith("/"):
                raise ValueError(f"Invalid input: '{message_text}'")

        else:
            raise TypeError(f"Invalid input: '{message}' - type {type(message)}")

        if timestamp:
            # Override the timestamp with what the caller provided
            message.created_at = timestamp

        # Run the agent state forward
        return self._step(actor=actor, agent_id=agent_id, input_messages=message)

    # TODO: Deprecate this
    def send_messages(
        self,
        actor: User,
        agent_id: str,
        input_messages: List[MessageCreate],
        wrap_user_message: bool = True,
        wrap_system_message: bool = True,
        interface: Union[AgentInterface, ChatCompletionsStreamingInterface, None] = None,  # needed for responses
        metadata: Optional[dict] = None,  # Pass through metadata to interface
        put_inner_thoughts_first: bool = True,
    ) -> LettaUsageStatistics:
        """Send a list of messages to the agent."""

        # Store metadata in interface if provided
        if metadata and hasattr(interface, "metadata"):
            interface.metadata = metadata

        # Run the agent state forward
        return self._step(
            actor=actor,
            agent_id=agent_id,
            input_messages=input_messages,
            interface=interface,
            put_inner_thoughts_first=put_inner_thoughts_first,
        )

    # @LockingServer.agent_lock_decorator
    def run_command(self, user_id: str, agent_id: str, command: str) -> LettaUsageStatistics:
        """Run a command on the agent"""
        # If the input begins with a command prefix, attempt to process it as a command
        if command.startswith("/"):
            if len(command) > 1:
                command = command[1:]  # strip the prefix
        return self._command(user_id=user_id, agent_id=agent_id, command=command)

    @trace_method
    def get_cached_llm_config(self, actor: User, **kwargs):
        key = make_key(**kwargs)
        if key not in self._llm_config_cache:
            self._llm_config_cache[key] = self.get_llm_config_from_handle(actor=actor, **kwargs)
        return self._llm_config_cache[key]

    @trace_method
    async def get_cached_llm_config_async(self, actor: User, **kwargs):
        key = make_key(**kwargs)
        if key not in self._llm_config_cache:
            self._llm_config_cache[key] = await self.get_llm_config_from_handle_async(actor=actor, **kwargs)
        return self._llm_config_cache[key]

    @trace_method
    def get_cached_embedding_config(self, actor: User, **kwargs):
        key = make_key(**kwargs)
        if key not in self._embedding_config_cache:
            self._embedding_config_cache[key] = self.get_embedding_config_from_handle(actor=actor, **kwargs)
        return self._embedding_config_cache[key]

    # @async_redis_cache(key_func=lambda (actor, **kwargs): actor.id + hash(kwargs))
    @trace_method
    async def get_cached_embedding_config_async(self, actor: User, **kwargs):
        key = make_key(**kwargs)
        if key not in self._embedding_config_cache:
            self._embedding_config_cache[key] = await self.get_embedding_config_from_handle_async(actor=actor, **kwargs)
        return self._embedding_config_cache[key]

    @trace_method
    def create_agent(
        self,
        request: CreateAgent,
        actor: User,
        interface: AgentInterface | None = None,
    ) -> AgentState:
        warnings.warn("This method is deprecated, use create_agent_async where possible.", DeprecationWarning, stacklevel=2)
        if request.llm_config is None:
            if request.model is None:
                raise ValueError("Must specify either model or llm_config in request")
            config_params = {
                "handle": request.model,
                "context_window_limit": request.context_window_limit,
                "max_tokens": request.max_tokens,
                "max_reasoning_tokens": request.max_reasoning_tokens,
                "enable_reasoner": request.enable_reasoner,
            }
            log_event(name="start get_cached_llm_config", attributes=config_params)
            request.llm_config = self.get_cached_llm_config(actor=actor, **config_params)
            log_event(name="end get_cached_llm_config", attributes=config_params)

        if request.embedding_config is None:
            if request.embedding is None:
                raise ValueError("Must specify either embedding or embedding_config in request")
            embedding_config_params = {
                "handle": request.embedding,
                "embedding_chunk_size": request.embedding_chunk_size or constants.DEFAULT_EMBEDDING_CHUNK_SIZE,
            }
            log_event(name="start get_cached_embedding_config", attributes=embedding_config_params)
            request.embedding_config = self.get_cached_embedding_config(actor=actor, **embedding_config_params)
            log_event(name="end get_cached_embedding_config", attributes=embedding_config_params)

        log_event(name="start create_agent db")
        main_agent = self.agent_manager.create_agent(
            agent_create=request,
            actor=actor,
        )
        log_event(name="end create_agent db")

        if request.enable_sleeptime:
            if request.agent_type == AgentType.voice_convo_agent:
                main_agent = self.create_voice_sleeptime_agent(main_agent=main_agent, actor=actor)
            else:
                main_agent = self.create_sleeptime_agent(main_agent=main_agent, actor=actor)

        return main_agent

    @trace_method
    async def create_agent_async(
        self,
        request: CreateAgent,
        actor: User,
    ) -> AgentState:
        if request.llm_config is None:
            if request.model is None:
                if settings.default_llm_handle is None:
                    raise ValueError("Must specify either model or llm_config in request")
                else:
                    request.model = settings.default_llm_handle
            config_params = {
                "handle": request.model,
                "context_window_limit": request.context_window_limit,
                "max_tokens": request.max_tokens,
                "max_reasoning_tokens": request.max_reasoning_tokens,
                "enable_reasoner": request.enable_reasoner,
            }
            log_event(name="start get_cached_llm_config", attributes=config_params)
            request.llm_config = await self.get_cached_llm_config_async(actor=actor, **config_params)
            log_event(name="end get_cached_llm_config", attributes=config_params)

        if request.reasoning is None:
            request.reasoning = request.llm_config.enable_reasoner or request.llm_config.put_inner_thoughts_in_kwargs

        if request.embedding_config is None:
            if request.embedding is None:
                if settings.default_embedding_handle is None:
                    raise ValueError("Must specify either embedding or embedding_config in request")
                else:
                    request.embedding = settings.default_embedding_handle
            embedding_config_params = {
                "handle": request.embedding,
                "embedding_chunk_size": request.embedding_chunk_size or constants.DEFAULT_EMBEDDING_CHUNK_SIZE,
            }
            log_event(name="start get_cached_embedding_config", attributes=embedding_config_params)
            request.embedding_config = await self.get_cached_embedding_config_async(actor=actor, **embedding_config_params)
            log_event(name="end get_cached_embedding_config", attributes=embedding_config_params)

        log_event(name="start create_agent db")
        main_agent = await self.agent_manager.create_agent_async(
            agent_create=request,
            actor=actor,
        )
        log_event(name="end create_agent db")

        log_event(name="start insert_files_into_context_window db")
        if request.source_ids:
            for source_id in request.source_ids:
                files = await self.file_manager.list_files(source_id, actor, include_content=True)
                await self.agent_manager.insert_files_into_context_window(
                    agent_state=main_agent, file_metadata_with_content=files, actor=actor
                )

            main_agent = await self.agent_manager.refresh_file_blocks(agent_state=main_agent, actor=actor)
            main_agent = await self.agent_manager.attach_missing_files_tools_async(agent_state=main_agent, actor=actor)
        log_event(name="end insert_files_into_context_window db")

        if request.enable_sleeptime:
            if request.agent_type == AgentType.voice_convo_agent:
                main_agent = await self.create_voice_sleeptime_agent_async(main_agent=main_agent, actor=actor)
            else:
                main_agent = await self.create_sleeptime_agent_async(main_agent=main_agent, actor=actor)

        return main_agent

    def update_agent(
        self,
        agent_id: str,
        request: UpdateAgent,
        actor: User,
    ) -> AgentState:
        if request.model is not None:
            request.llm_config = self.get_llm_config_from_handle(handle=request.model, actor=actor)

        if request.embedding is not None:
            request.embedding_config = self.get_embedding_config_from_handle(handle=request.embedding, actor=actor)

        if request.enable_sleeptime:
            agent = self.agent_manager.get_agent_by_id(agent_id=agent_id, actor=actor)
            if agent.multi_agent_group is None:
                if agent.agent_type == AgentType.voice_convo_agent:
                    self.create_voice_sleeptime_agent(main_agent=agent, actor=actor)
                else:
                    self.create_sleeptime_agent(main_agent=agent, actor=actor)

        return self.agent_manager.update_agent(
            agent_id=agent_id,
            agent_update=request,
            actor=actor,
        )

    async def update_agent_async(
        self,
        agent_id: str,
        request: UpdateAgent,
        actor: User,
    ) -> AgentState:
        if request.model is not None:
            request.llm_config = await self.get_llm_config_from_handle_async(handle=request.model, actor=actor)

        if request.embedding is not None:
            request.embedding_config = await self.get_embedding_config_from_handle_async(handle=request.embedding, actor=actor)

        if request.enable_sleeptime:
            agent = await self.agent_manager.get_agent_by_id_async(agent_id=agent_id, actor=actor)
            if agent.multi_agent_group is None:
                if agent.agent_type == AgentType.voice_convo_agent:
                    await self.create_voice_sleeptime_agent_async(main_agent=agent, actor=actor)
                else:
                    await self.create_sleeptime_agent_async(main_agent=agent, actor=actor)

        return await self.agent_manager.update_agent_async(
            agent_id=agent_id,
            agent_update=request,
            actor=actor,
        )

    def create_sleeptime_agent(self, main_agent: AgentState, actor: User) -> AgentState:
        request = CreateAgent(
            name=main_agent.name + "-sleeptime",
            agent_type=AgentType.sleeptime_agent,
            block_ids=[block.id for block in main_agent.memory.blocks],
            memory_blocks=[
                CreateBlock(
                    label="memory_persona",
                    value=get_persona_text("sleeptime_memory_persona"),
                ),
            ],
            llm_config=main_agent.llm_config,
            embedding_config=main_agent.embedding_config,
            project_id=main_agent.project_id,
        )
        sleeptime_agent = self.agent_manager.create_agent(
            agent_create=request,
            actor=actor,
        )
        self.group_manager.create_group(
            group=GroupCreate(
                description="",
                agent_ids=[sleeptime_agent.id],
                manager_config=SleeptimeManager(
                    manager_agent_id=main_agent.id,
                    sleeptime_agent_frequency=5,
                ),
            ),
            actor=actor,
        )
        return self.agent_manager.get_agent_by_id(agent_id=main_agent.id, actor=actor)

    async def create_sleeptime_agent_async(self, main_agent: AgentState, actor: User) -> AgentState:
        request = CreateAgent(
            name=main_agent.name + "-sleeptime",
            agent_type=AgentType.sleeptime_agent,
            block_ids=[block.id for block in main_agent.memory.blocks],
            memory_blocks=[
                CreateBlock(
                    label="memory_persona",
                    value=get_persona_text("sleeptime_memory_persona"),
                ),
            ],
            llm_config=main_agent.llm_config,
            embedding_config=main_agent.embedding_config,
            project_id=main_agent.project_id,
        )
        sleeptime_agent = await self.agent_manager.create_agent_async(
            agent_create=request,
            actor=actor,
        )
        await self.group_manager.create_group_async(
            group=GroupCreate(
                description="",
                agent_ids=[sleeptime_agent.id],
                manager_config=SleeptimeManager(
                    manager_agent_id=main_agent.id,
                    sleeptime_agent_frequency=5,
                ),
            ),
            actor=actor,
        )
        return await self.agent_manager.get_agent_by_id_async(agent_id=main_agent.id, actor=actor)

    def create_voice_sleeptime_agent(self, main_agent: AgentState, actor: User) -> AgentState:
        # TODO: Inject system
        request = CreateAgent(
            name=main_agent.name + "-sleeptime",
            agent_type=AgentType.voice_sleeptime_agent,
            block_ids=[block.id for block in main_agent.memory.blocks],
            memory_blocks=[
                CreateBlock(
                    label="memory_persona",
                    value=get_persona_text("voice_memory_persona"),
                ),
            ],
            llm_config=LLMConfig.default_config("gpt-4.1"),
            embedding_config=main_agent.embedding_config,
            project_id=main_agent.project_id,
        )
        voice_sleeptime_agent = self.agent_manager.create_agent(
            agent_create=request,
            actor=actor,
        )
        self.group_manager.create_group(
            group=GroupCreate(
                description="Low latency voice chat with async memory management.",
                agent_ids=[voice_sleeptime_agent.id],
                manager_config=VoiceSleeptimeManager(
                    manager_agent_id=main_agent.id,
                    max_message_buffer_length=constants.DEFAULT_MAX_MESSAGE_BUFFER_LENGTH,
                    min_message_buffer_length=constants.DEFAULT_MIN_MESSAGE_BUFFER_LENGTH,
                ),
            ),
            actor=actor,
        )
        return self.agent_manager.get_agent_by_id(agent_id=main_agent.id, actor=actor)

    async def create_voice_sleeptime_agent_async(self, main_agent: AgentState, actor: User) -> AgentState:
        # TODO: Inject system
        request = CreateAgent(
            name=main_agent.name + "-sleeptime",
            agent_type=AgentType.voice_sleeptime_agent,
            block_ids=[block.id for block in main_agent.memory.blocks],
            memory_blocks=[
                CreateBlock(
                    label="memory_persona",
                    value=get_persona_text("voice_memory_persona"),
                ),
            ],
            llm_config=LLMConfig.default_config("gpt-4.1"),
            embedding_config=main_agent.embedding_config,
            project_id=main_agent.project_id,
        )
        voice_sleeptime_agent = await self.agent_manager.create_agent_async(
            agent_create=request,
            actor=actor,
        )
        await self.group_manager.create_group_async(
            group=GroupCreate(
                description="Low latency voice chat with async memory management.",
                agent_ids=[voice_sleeptime_agent.id],
                manager_config=VoiceSleeptimeManager(
                    manager_agent_id=main_agent.id,
                    max_message_buffer_length=constants.DEFAULT_MAX_MESSAGE_BUFFER_LENGTH,
                    min_message_buffer_length=constants.DEFAULT_MIN_MESSAGE_BUFFER_LENGTH,
                ),
            ),
            actor=actor,
        )
        return await self.agent_manager.get_agent_by_id_async(agent_id=main_agent.id, actor=actor)

    # convert name->id

    # TODO: These can be moved to agent_manager
    def get_agent_memory(self, agent_id: str, actor: User) -> Memory:
        """Return the memory of an agent (core memory)"""
        return self.agent_manager.get_agent_by_id(agent_id=agent_id, actor=actor).memory

    async def get_agent_memory_async(self, agent_id: str, actor: User) -> Memory:
        """Return the memory of an agent (core memory)"""
        agent = await self.agent_manager.get_agent_by_id_async(agent_id=agent_id, actor=actor)
        return agent.memory

    def get_archival_memory_summary(self, agent_id: str, actor: User) -> ArchivalMemorySummary:
        return ArchivalMemorySummary(size=self.agent_manager.passage_size(actor=actor, agent_id=agent_id))

    def get_recall_memory_summary(self, agent_id: str, actor: User) -> RecallMemorySummary:
        return RecallMemorySummary(size=self.message_manager.size(actor=actor, agent_id=agent_id))

    async def get_agent_archival_async(
        self,
        agent_id: str,
        actor: User,
        after: Optional[str] = None,
        before: Optional[str] = None,
        limit: Optional[int] = 100,
        query_text: Optional[str] = None,
        ascending: Optional[bool] = True,
    ) -> List[Passage]:
        # iterate over records
        records = await self.agent_manager.list_agent_passages_async(
            actor=actor,
            agent_id=agent_id,
            after=after,
            query_text=query_text,
            before=before,
            ascending=ascending,
            limit=limit,
        )
        return records

    async def insert_archival_memory_async(self, agent_id: str, memory_contents: str, actor: User) -> List[Passage]:
        # Get the agent object (loaded in memory)
        agent_state = await self.agent_manager.get_agent_by_id_async(agent_id=agent_id, actor=actor)

        # Insert passages into the archive
        passages = await self.passage_manager.insert_passage(agent_state=agent_state, text=memory_contents, actor=actor)

        return passages

    def modify_archival_memory(self, agent_id: str, memory_id: str, passage: PassageUpdate, actor: User) -> List[Passage]:
        passage = Passage(**passage.model_dump(exclude_unset=True, exclude_none=True))
        passages = self.passage_manager.update_passage_by_id(passage_id=memory_id, passage=passage, actor=actor)
        return passages

    async def delete_archival_memory_async(self, memory_id: str, actor: User):
        # TODO check if it exists first, and throw error if not
        # TODO: need to also rebuild the prompt here
        passage = await self.passage_manager.get_passage_by_id_async(passage_id=memory_id, actor=actor)

        # delete the passage
        await self.passage_manager.delete_passage_by_id_async(passage_id=memory_id, actor=actor)

    def get_agent_recall(
        self,
        user_id: str,
        agent_id: str,
        after: Optional[str] = None,
        before: Optional[str] = None,
        limit: Optional[int] = 100,
        group_id: Optional[str] = None,
        reverse: Optional[bool] = False,
        return_message_object: bool = True,
        use_assistant_message: bool = True,
        assistant_message_tool_name: str = constants.DEFAULT_MESSAGE_TOOL,
        assistant_message_tool_kwarg: str = constants.DEFAULT_MESSAGE_TOOL_KWARG,
    ) -> Union[List[Message], List[LettaMessage]]:
        # TODO: Thread actor directly through this function, since the top level caller most likely already retrieved the user

        actor = self.user_manager.get_user_or_default(user_id=user_id)

        records = self.message_manager.list_messages_for_agent(
            agent_id=agent_id,
            actor=actor,
            after=after,
            before=before,
            limit=limit,
            ascending=not reverse,
            group_id=group_id,
        )

        if not return_message_object:
            records = Message.to_letta_messages_from_list(
                messages=records,
                use_assistant_message=use_assistant_message,
                assistant_message_tool_name=assistant_message_tool_name,
                assistant_message_tool_kwarg=assistant_message_tool_kwarg,
                reverse=reverse,
            )

        if reverse:
            records = records[::-1]

        return records

    async def get_agent_recall_async(
        self,
        agent_id: str,
        actor: User,
        after: Optional[str] = None,
        before: Optional[str] = None,
        limit: Optional[int] = 100,
        group_id: Optional[str] = None,
        reverse: Optional[bool] = False,
        return_message_object: bool = True,
        use_assistant_message: bool = True,
        assistant_message_tool_name: str = constants.DEFAULT_MESSAGE_TOOL,
        assistant_message_tool_kwarg: str = constants.DEFAULT_MESSAGE_TOOL_KWARG,
        include_err: Optional[bool] = None,
    ) -> Union[List[Message], List[LettaMessage]]:
        records = await self.message_manager.list_messages_for_agent_async(
            agent_id=agent_id,
            actor=actor,
            after=after,
            before=before,
            limit=limit,
            ascending=not reverse,
            group_id=group_id,
            include_err=include_err,
        )

        if not return_message_object:
            records = Message.to_letta_messages_from_list(
                messages=records,
                use_assistant_message=use_assistant_message,
                assistant_message_tool_name=assistant_message_tool_name,
                assistant_message_tool_kwarg=assistant_message_tool_kwarg,
                reverse=reverse,
                include_err=include_err,
            )

        if reverse:
            records = records[::-1]

        return records

    def get_server_config(self, include_defaults: bool = False) -> dict:
        """Return the base config"""

        def clean_keys(config):
            config_copy = config.copy()
            for k, v in config.items():
                if k == "key" or "_key" in k:
                    config_copy[k] = server_utils.shorten_key_middle(v, chars_each_side=5)
            return config_copy

        # TODO: do we need a separate server config?
        base_config = vars(self.config)
        clean_base_config = clean_keys(base_config)

        response = {"config": clean_base_config}

        if include_defaults:
            default_config = vars(LettaConfig())
            clean_default_config = clean_keys(default_config)
            response["defaults"] = clean_default_config

        return response

    def update_agent_core_memory(self, agent_id: str, label: str, value: str, actor: User) -> Memory:
        """Update the value of a block in the agent's memory"""

        # get the block id
        block = self.agent_manager.get_block_with_label(agent_id=agent_id, block_label=label, actor=actor)

        # update the block
        self.block_manager.update_block(block_id=block.id, block_update=BlockUpdate(value=value), actor=actor)

        # rebuild system prompt for agent, potentially changed
        return self.agent_manager.rebuild_system_prompt(agent_id=agent_id, actor=actor).memory

    async def delete_source(self, source_id: str, actor: User):
        """Delete a data source"""
        await self.source_manager.delete_source(source_id=source_id, actor=actor)

        # delete data from passage store
        passages_to_be_deleted = await self.agent_manager.list_passages_async(actor=actor, source_id=source_id, limit=None)
        await self.passage_manager.delete_source_passages_async(actor=actor, passages=passages_to_be_deleted)

        # TODO: delete data from agent passage stores (?)

    async def load_file_to_source(self, source_id: str, file_path: str, job_id: str, actor: User) -> Job:
        # update job
        job = await self.job_manager.get_job_by_id_async(job_id, actor=actor)
        job.status = JobStatus.running
        await self.job_manager.update_job_by_id_async(job_id=job_id, job_update=JobUpdate(**job.model_dump()), actor=actor)

        # try:
        from letta.data_sources.connectors import DirectoryConnector

        # TODO: move this into a thread
        source = await self.source_manager.get_source_by_id(source_id=source_id)
        if source is None:
            raise ValueError(f"Source {source_id} does not exist")
        connector = DirectoryConnector(input_files=[file_path])
        num_passages, num_documents = await self.load_data(user_id=source.created_by_id, source_name=source.name, connector=connector)

        # update all agents who have this source attached
        agent_states = await self.source_manager.list_attached_agents(source_id=source_id, actor=actor)
        for agent_state in agent_states:
            agent_id = agent_state.id

            # Attach source to agent
            curr_passage_size = await self.agent_manager.passage_size_async(actor=actor, agent_id=agent_id)
            agent_state = await self.agent_manager.attach_source_async(agent_id=agent_state.id, source_id=source_id, actor=actor)
            new_passage_size = await self.agent_manager.passage_size_async(actor=actor, agent_id=agent_id)
            assert new_passage_size >= curr_passage_size  # in case empty files are added

        # update job status
        job.status = JobStatus.completed
        job.metadata["num_passages"] = num_passages
        job.metadata["num_documents"] = num_documents
        await self.job_manager.update_job_by_id_async(job_id=job_id, job_update=JobUpdate(**job.model_dump()), actor=actor)

        return job

    async def load_file_to_source_via_mistral(self):
        pass

    async def sleeptime_document_ingest_async(
        self, main_agent: AgentState, source: Source, actor: User, clear_history: bool = False
    ) -> None:
        # TEMPORARILY DISABLE UNTIL V2
        # sleeptime_agent_state = await self.create_document_sleeptime_agent_async(main_agent, source, actor, clear_history)
        # sleeptime_agent = LettaAgent(
        #     agent_id=sleeptime_agent_state.id,
        #     message_manager=self.message_manager,
        #     agent_manager=self.agent_manager,
        #     block_manager=self.block_manager,
        #     job_manager=self.job_manager,
        #     passage_manager=self.passage_manager,
        #     actor=actor,
        #     step_manager=self.step_manager,
        #     telemetry_manager=self.telemetry_manager if settings.llm_api_logging else NoopTelemetryManager(),
        # )
        # passages = await self.agent_manager.list_passages_async(actor=actor, source_id=source.id)
        # for passage in passages:
        #     await sleeptime_agent.step(
        #         input_messages=[
        #             MessageCreate(role="user", content=passage.text),
        #         ]
        #     )
        # await self.agent_manager.delete_agent_async(agent_id=sleeptime_agent_state.id, actor=actor)
        pass

    async def _remove_file_from_agent(self, agent_id: str, file_id: str, actor: User) -> None:
        """
        Internal method to remove a document block for an agent.
        """
        try:
            await self.file_agent_manager.detach_file(
                agent_id=agent_id,
                file_id=file_id,
                actor=actor,
            )
        except NoResultFound:
            logger.info(f"File {file_id} already removed from agent {agent_id}, skipping...")

    async def remove_file_from_context_windows(self, source_id: str, file_id: str, actor: User) -> None:
        """
        Remove the document from the context window of all agents
        attached to the given source.
        """
        # Use the optimized ids_only parameter
        agent_ids = await self.source_manager.list_attached_agents(source_id=source_id, actor=actor, ids_only=True)

        # Return early if no agents
        if not agent_ids:
            return

        logger.info(f"Removing file from context window for source: {source_id}")
        logger.info(f"Attached agents: {agent_ids}")

        # Create agent-file pairs for bulk deletion
        agent_file_pairs = [(agent_id, file_id) for agent_id in agent_ids]

        # Bulk delete in a single query
        deleted_count = await self.file_agent_manager.detach_file_bulk(agent_file_pairs=agent_file_pairs, actor=actor)

        logger.info(f"Removed file {file_id} from {deleted_count} agent context windows")

    async def remove_files_from_context_window(self, agent_state: AgentState, file_ids: List[str], actor: User) -> None:
        """
        Remove multiple documents from the context window of an agent
        attached to the given source.
        """
        logger.info(f"Removing files from context window for agent_state: {agent_state.id}")
        logger.info(f"Files to remove: {file_ids}")

        # Create agent-file pairs for bulk deletion
        agent_file_pairs = [(agent_state.id, file_id) for file_id in file_ids]

        # Bulk delete in a single query
        deleted_count = await self.file_agent_manager.detach_file_bulk(agent_file_pairs=agent_file_pairs, actor=actor)

        logger.info(f"Removed {deleted_count} files from agent {agent_state.id}")

    async def create_document_sleeptime_agent_async(
        self, main_agent: AgentState, source: Source, actor: User, clear_history: bool = False
    ) -> AgentState:
        try:
            block = await self.agent_manager.get_block_with_label_async(agent_id=main_agent.id, block_label=source.name, actor=actor)
        except:
            block = await self.block_manager.create_or_update_block_async(Block(label=source.name, value=""), actor=actor)
            await self.agent_manager.attach_block_async(agent_id=main_agent.id, block_id=block.id, actor=actor)

        if clear_history and block.value != "":
            block = await self.block_manager.update_block_async(block_id=block.id, block_update=BlockUpdate(value=""), actor=actor)

        request = CreateAgent(
            name=main_agent.name + "-doc-sleeptime",
            system=get_system_text("sleeptime_doc_ingest"),
            agent_type=AgentType.sleeptime_agent,
            block_ids=[block.id],
            memory_blocks=[
                CreateBlock(
                    label="persona",
                    value=get_persona_text("sleeptime_doc_persona"),
                ),
                CreateBlock(
                    label="instructions",
                    value=source.instructions,
                ),
            ],
            llm_config=main_agent.llm_config,
            embedding_config=main_agent.embedding_config,
            project_id=main_agent.project_id,
            include_base_tools=False,
            tools=constants.BASE_SLEEPTIME_TOOLS,
        )
        return await self.agent_manager.create_agent_async(
            agent_create=request,
            actor=actor,
        )

    async def load_data(
        self,
        user_id: str,
        connector: DataConnector,
        source_name: str,
    ) -> Tuple[int, int]:
        """Load data from a DataConnector into a source for a specified user_id"""
        # TODO: this should be implemented as a batch job or at least async, since it may take a long time

        # load data from a data source into the document store
        actor = await self.user_manager.get_actor_by_id_async(actor_id=user_id)
        source = await self.source_manager.get_source_by_name(source_name=source_name, actor=actor)
        if source is None:
            raise ValueError(f"Data source {source_name} does not exist for user {user_id}")

        # load data into the document store
        passage_count, document_count = await load_data(connector, source, self.passage_manager, self.file_manager, actor=actor)
        return passage_count, document_count

    def list_all_sources(self, actor: User) -> List[Source]:
        # TODO: legacy: remove
        """List all sources (w/ extra metadata) belonging to a user"""

        sources = self.source_manager.list_sources(actor=actor)

        # Add extra metadata to the sources
        sources_with_metadata = []
        for source in sources:
            # count number of passages
            num_passages = self.agent_manager.passage_size(actor=actor, source_id=source.id)

            # TODO: add when files table implemented
            ## count number of files
            # document_conn = StorageConnector.get_storage_connector(TableType.FILES, self.config, user_id=user_id)
            # num_documents = document_conn.size({"data_source": source.name})
            num_documents = 0

            agents = self.source_manager.list_attached_agents(source_id=source.id, actor=actor)
            # add the agent name information
            attached_agents = [{"id": agent.id, "name": agent.name} for agent in agents]

            # Overwrite metadata field, should be empty anyways
            source.metadata = dict(
                num_documents=num_documents,
                num_passages=num_passages,
                attached_agents=attached_agents,
            )

            sources_with_metadata.append(source)

        return sources_with_metadata

    def update_agent_message(self, message_id: str, request: MessageUpdate, actor: User) -> Message:
        """Update the details of a message associated with an agent"""

        # Get the current message
        return self.message_manager.update_message_by_id(message_id=message_id, message_update=request, actor=actor)

    def list_llm_models(
        self,
        actor: User,
        provider_category: Optional[List[ProviderCategory]] = None,
        provider_name: Optional[str] = None,
        provider_type: Optional[ProviderType] = None,
    ) -> List[LLMConfig]:
        """List available models"""
        llm_models = []
        for provider in self.get_enabled_providers(
            provider_category=provider_category,
            provider_name=provider_name,
            provider_type=provider_type,
            actor=actor,
        ):
            try:
                llm_models.extend(provider.list_llm_models())
            except Exception as e:
                import traceback

                traceback.print_exc()
                warnings.warn(f"An error occurred while listing LLM models for provider {provider}: {e}")

        llm_models.extend(self.get_local_llm_configs())

        return llm_models

    @trace_method
    async def list_llm_models_async(
        self,
        actor: User,
        provider_category: Optional[List[ProviderCategory]] = None,
        provider_name: Optional[str] = None,
        provider_type: Optional[ProviderType] = None,
    ) -> List[LLMConfig]:
        """Asynchronously list available models with maximum concurrency"""
        import asyncio

        providers = await self.get_enabled_providers_async(
            provider_category=provider_category,
            provider_name=provider_name,
            provider_type=provider_type,
            actor=actor,
        )

        async def get_provider_models(provider: Provider) -> list[LLMConfig]:
            try:
                async with asyncio.timeout(constants.GET_PROVIDERS_TIMEOUT_SECONDS):
                    return await provider.list_llm_models_async()
            except asyncio.TimeoutError:
                warnings.warn(f"Timeout while listing LLM models for provider {provider}")
                return []
            except Exception as e:
                traceback.print_exc()
                warnings.warn(f"Error while listing LLM models for provider {provider}: {e}")
                return []

        # Execute all provider model listing tasks concurrently
        provider_results = await asyncio.gather(*[get_provider_models(provider) for provider in providers])

        # Flatten the results
        llm_models = []
        for models in provider_results:
            llm_models.extend(models)

        # Get local configs - if this is potentially slow, consider making it async too
        local_configs = self.get_local_llm_configs()
        llm_models.extend(local_configs)

        return llm_models

    def list_embedding_models(self, actor: User) -> List[EmbeddingConfig]:
        """List available embedding models"""
        embedding_models = []
        for provider in self.get_enabled_providers(actor):
            try:
                embedding_models.extend(provider.list_embedding_models())
            except Exception as e:
                warnings.warn(f"An error occurred while listing embedding models for provider {provider}: {e}")
        return embedding_models

    async def list_embedding_models_async(self, actor: User) -> List[EmbeddingConfig]:
        """Asynchronously list available embedding models with maximum concurrency"""
        import asyncio

        # Get all eligible providers first
        providers = await self.get_enabled_providers_async(actor=actor)

        # Fetch embedding models from each provider concurrently
        async def get_provider_embedding_models(provider):
            try:
                # All providers now have list_embedding_models_async
                return await provider.list_embedding_models_async()
            except Exception as e:
                import traceback

                traceback.print_exc()
                warnings.warn(f"An error occurred while listing embedding models for provider {provider}: {e}")
                return []

        # Execute all provider model listing tasks concurrently
        provider_results = await asyncio.gather(*[get_provider_embedding_models(provider) for provider in providers])

        # Flatten the results
        embedding_models = []
        for models in provider_results:
            embedding_models.extend(models)

        return embedding_models

    def get_enabled_providers(
        self,
        actor: User,
        provider_category: Optional[List[ProviderCategory]] = None,
        provider_name: Optional[str] = None,
        provider_type: Optional[ProviderType] = None,
    ) -> List[Provider]:
        providers = []
        if not provider_category or ProviderCategory.base in provider_category:
            providers_from_env = [p for p in self._enabled_providers]
            providers.extend(providers_from_env)

        if not provider_category or ProviderCategory.byok in provider_category:
            providers_from_db = self.provider_manager.list_providers(
                name=provider_name,
                provider_type=provider_type,
                actor=actor,
            )
            providers_from_db = [p.cast_to_subtype() for p in providers_from_db]
            providers.extend(providers_from_db)

        if provider_name is not None:
            providers = [p for p in providers if p.name == provider_name]

        if provider_type is not None:
            providers = [p for p in providers if p.provider_type == provider_type]

        return providers

    async def get_enabled_providers_async(
        self,
        actor: User,
        provider_category: Optional[List[ProviderCategory]] = None,
        provider_name: Optional[str] = None,
        provider_type: Optional[ProviderType] = None,
    ) -> List[Provider]:
        providers = []
        if not provider_category or ProviderCategory.base in provider_category:
            providers_from_env = [p for p in self._enabled_providers]
            providers.extend(providers_from_env)

        if not provider_category or ProviderCategory.byok in provider_category:
            providers_from_db = await self.provider_manager.list_providers_async(
                name=provider_name,
                provider_type=provider_type,
                actor=actor,
            )
            providers_from_db = [p.cast_to_subtype() for p in providers_from_db]
            providers.extend(providers_from_db)

        if provider_name is not None:
            providers = [p for p in providers if p.name == provider_name]

        if provider_type is not None:
            providers = [p for p in providers if p.provider_type == provider_type]

        return providers

    @trace_method
    def get_llm_config_from_handle(
        self,
        actor: User,
        handle: str,
        context_window_limit: Optional[int] = None,
        max_tokens: Optional[int] = None,
        max_reasoning_tokens: Optional[int] = None,
        enable_reasoner: Optional[bool] = None,
    ) -> LLMConfig:
        try:
            provider_name, model_name = handle.split("/", 1)
            provider = self.get_provider_from_name(provider_name, actor)

            llm_configs = [config for config in provider.list_llm_models() if config.handle == handle]
            if not llm_configs:
                llm_configs = [config for config in provider.list_llm_models() if config.model == model_name]
            if not llm_configs:
                available_handles = [config.handle for config in provider.list_llm_models()]
                raise HandleNotFoundError(handle, available_handles)
        except ValueError as e:
            llm_configs = [config for config in self.get_local_llm_configs() if config.handle == handle]
            if not llm_configs:
                llm_configs = [config for config in self.get_local_llm_configs() if config.model == model_name]
            if not llm_configs:
                raise e

        if len(llm_configs) == 1:
            llm_config = llm_configs[0]
        elif len(llm_configs) > 1:
            raise ValueError(f"Multiple LLM models with name {model_name} supported by {provider_name}")
        else:
            llm_config = llm_configs[0]

        if context_window_limit is not None:
            if context_window_limit > llm_config.context_window:
                raise ValueError(f"Context window limit ({context_window_limit}) is greater than maximum of ({llm_config.context_window})")
            llm_config.context_window = context_window_limit
        else:
            llm_config.context_window = min(llm_config.context_window, model_settings.global_max_context_window_limit)

        if max_tokens is not None:
            llm_config.max_tokens = max_tokens
        if max_reasoning_tokens is not None:
            if not max_tokens or max_reasoning_tokens > max_tokens:
                raise ValueError(f"Max reasoning tokens ({max_reasoning_tokens}) must be less than max tokens ({max_tokens})")
            llm_config.max_reasoning_tokens = max_reasoning_tokens
        if enable_reasoner is not None:
            llm_config.enable_reasoner = enable_reasoner
            if enable_reasoner and llm_config.model_endpoint_type == "anthropic":
                llm_config.put_inner_thoughts_in_kwargs = False

        return llm_config

    @trace_method
    async def get_llm_config_from_handle_async(
        self,
        actor: User,
        handle: str,
        context_window_limit: Optional[int] = None,
        max_tokens: Optional[int] = None,
        max_reasoning_tokens: Optional[int] = None,
        enable_reasoner: Optional[bool] = None,
    ) -> LLMConfig:
        try:
            provider_name, model_name = handle.split("/", 1)
            provider = await self.get_provider_from_name_async(provider_name, actor)

            all_llm_configs = await provider.list_llm_models_async()
            llm_configs = [config for config in all_llm_configs if config.handle == handle]
            if not llm_configs:
                llm_configs = [config for config in all_llm_configs if config.model == model_name]
            if not llm_configs:
                available_handles = [config.handle for config in all_llm_configs]
                raise HandleNotFoundError(handle, available_handles)
        except ValueError as e:
            llm_configs = [config for config in self.get_local_llm_configs() if config.handle == handle]
            if not llm_configs:
                llm_configs = [config for config in self.get_local_llm_configs() if config.model == model_name]
            if not llm_configs:
                raise e

        if len(llm_configs) == 1:
            llm_config = llm_configs[0]
        elif len(llm_configs) > 1:
            raise ValueError(f"Multiple LLM models with name {model_name} supported by {provider_name}")
        else:
            llm_config = llm_configs[0]

        if context_window_limit is not None:
            if context_window_limit > llm_config.context_window:
                raise ValueError(f"Context window limit ({context_window_limit}) is greater than maximum of ({llm_config.context_window})")
            llm_config.context_window = context_window_limit
        else:
            llm_config.context_window = min(llm_config.context_window, model_settings.global_max_context_window_limit)

        if max_tokens is not None:
            llm_config.max_tokens = max_tokens
        if max_reasoning_tokens is not None:
            if not max_tokens or max_reasoning_tokens > max_tokens:
                raise ValueError(f"Max reasoning tokens ({max_reasoning_tokens}) must be less than max tokens ({max_tokens})")
            llm_config.max_reasoning_tokens = max_reasoning_tokens
        if enable_reasoner is not None:
            llm_config.enable_reasoner = enable_reasoner
            if enable_reasoner and llm_config.model_endpoint_type == "anthropic":
                llm_config.put_inner_thoughts_in_kwargs = False

        return llm_config

    @trace_method
    def get_embedding_config_from_handle(
        self, actor: User, handle: str, embedding_chunk_size: int = constants.DEFAULT_EMBEDDING_CHUNK_SIZE
    ) -> EmbeddingConfig:
        try:
            provider_name, model_name = handle.split("/", 1)
            provider = self.get_provider_from_name(provider_name, actor)

            embedding_configs = [config for config in provider.list_embedding_models() if config.handle == handle]
            if not embedding_configs:
                raise ValueError(f"Embedding model {model_name} is not supported by {provider_name}")
        except ValueError as e:
            # search local configs
            embedding_configs = [config for config in self.get_local_embedding_configs() if config.handle == handle]
            if not embedding_configs:
                raise e

        if len(embedding_configs) == 1:
            embedding_config = embedding_configs[0]
        elif len(embedding_configs) > 1:
            raise ValueError(f"Multiple embedding models with name {model_name} supported by {provider_name}")
        else:
            embedding_config = embedding_configs[0]

        if embedding_chunk_size:
            embedding_config.embedding_chunk_size = embedding_chunk_size

        return embedding_config

    @trace_method
    async def get_embedding_config_from_handle_async(
        self, actor: User, handle: str, embedding_chunk_size: int = constants.DEFAULT_EMBEDDING_CHUNK_SIZE
    ) -> EmbeddingConfig:
        try:
            provider_name, model_name = handle.split("/", 1)
            provider = await self.get_provider_from_name_async(provider_name, actor)

            all_embedding_configs = await provider.list_embedding_models_async()
            embedding_configs = [config for config in all_embedding_configs if config.handle == handle]
            if not embedding_configs:
                raise ValueError(f"Embedding model {model_name} is not supported by {provider_name}")
        except ValueError as e:
            # search local configs
            embedding_configs = [config for config in self.get_local_embedding_configs() if config.handle == handle]
            if not embedding_configs:
                raise e

        if len(embedding_configs) == 1:
            embedding_config = embedding_configs[0]
        elif len(embedding_configs) > 1:
            raise ValueError(f"Multiple embedding models with name {model_name} supported by {provider_name}")
        else:
            embedding_config = embedding_configs[0]

        if embedding_chunk_size:
            embedding_config.embedding_chunk_size = embedding_chunk_size

        return embedding_config

    def get_provider_from_name(self, provider_name: str, actor: User) -> Provider:
        providers = [provider for provider in self.get_enabled_providers(actor) if provider.name == provider_name]
        if not providers:
            raise ValueError(
                f"Provider {provider_name} is not supported (supported providers: {', '.join([provider.name for provider in self._enabled_providers])})"
            )
        elif len(providers) > 1:
            raise ValueError(f"Multiple providers with name {provider_name} supported")
        else:
            provider = providers[0]

        return provider

    async def get_provider_from_name_async(self, provider_name: str, actor: User) -> Provider:
        all_providers = await self.get_enabled_providers_async(actor)
        providers = [provider for provider in all_providers if provider.name == provider_name]
        if not providers:
            raise ValueError(
                f"Provider {provider_name} is not supported (supported providers: {', '.join([provider.name for provider in self._enabled_providers])})"
            )
        elif len(providers) > 1:
            raise ValueError(f"Multiple providers with name {provider_name} supported")
        else:
            provider = providers[0]

        return provider

    def get_local_llm_configs(self):
        llm_models = []
        try:
            llm_configs_dir = os.path.expanduser("~/.letta/llm_configs")
            if os.path.exists(llm_configs_dir):
                for filename in os.listdir(llm_configs_dir):
                    if filename.endswith(".json"):
                        filepath = os.path.join(llm_configs_dir, filename)
                        try:
                            with open(filepath, "r") as f:
                                config_data = json.load(f)
                                llm_config = LLMConfig(**config_data)
                                llm_models.append(llm_config)
                        except (json.JSONDecodeError, ValueError) as e:
                            warnings.warn(f"Error parsing LLM config file {filename}: {e}")
        except Exception as e:
            warnings.warn(f"Error reading LLM configs directory: {e}")
        return llm_models

    def get_local_embedding_configs(self):
        embedding_models = []
        try:
            embedding_configs_dir = os.path.expanduser("~/.letta/embedding_configs")
            if os.path.exists(embedding_configs_dir):
                for filename in os.listdir(embedding_configs_dir):
                    if filename.endswith(".json"):
                        filepath = os.path.join(embedding_configs_dir, filename)
                        try:
                            with open(filepath, "r") as f:
                                config_data = json.load(f)
                                embedding_config = EmbeddingConfig(**config_data)
                                embedding_models.append(embedding_config)
                        except (json.JSONDecodeError, ValueError) as e:
                            warnings.warn(f"Error parsing embedding config file {filename}: {e}")
        except Exception as e:
            warnings.warn(f"Error reading embedding configs directory: {e}")
        return embedding_models

    def add_llm_model(self, request: LLMConfig) -> LLMConfig:
        """Add a new LLM model"""

    def add_embedding_model(self, request: EmbeddingConfig) -> EmbeddingConfig:
        """Add a new embedding model"""

    async def run_tool_from_source(
        self,
        actor: User,
        tool_args: Dict[str, str],
        tool_source: str,
        tool_env_vars: Optional[Dict[str, str]] = None,
        tool_source_type: Optional[str] = None,
        tool_name: Optional[str] = None,
        tool_args_json_schema: Optional[Dict[str, Any]] = None,
        tool_json_schema: Optional[Dict[str, Any]] = None,
        pip_requirements: Optional[List[PipRequirement]] = None,
    ) -> ToolReturnMessage:
        """Run a tool from source code"""

        if tool_source_type not in (None, ToolSourceType.python, ToolSourceType.typescript):
            raise ValueError("Tool source type is not supported at this time. Found {tool_source_type}")

        # If tools_json_schema is explicitly passed in, override it on the created Tool object
        if tool_json_schema:
            tool = Tool(
                name=tool_name,
                source_code=tool_source,
                json_schema=tool_json_schema,
                pip_requirements=pip_requirements,
                source_type=tool_source_type,
            )
        else:
            # NOTE: we're creating a floating Tool object and NOT persisting to DB
            tool = Tool(
                name=tool_name,
                source_code=tool_source,
                args_json_schema=tool_args_json_schema,
                pip_requirements=pip_requirements,
                source_type=tool_source_type,
            )

        assert tool.name is not None, "Failed to create tool object"

        # TODO eventually allow using agent state in tools
        agent_state = None

        # Next, attempt to run the tool with the sandbox
        try:
            tool_execution_manager = ToolExecutionManager(
                agent_state=agent_state,
                message_manager=self.message_manager,
                agent_manager=self.agent_manager,
                block_manager=self.block_manager,
                job_manager=self.job_manager,
                passage_manager=self.passage_manager,
                actor=actor,
                sandbox_env_vars=tool_env_vars,
            )
            # TODO: Integrate sandbox result
            tool_execution_result = await tool_execution_manager.execute_tool_async(
                function_name=tool_name,
                function_args=tool_args,
                tool=tool,
            )
            return ToolReturnMessage(
                id="null",
                tool_call_id="null",
                date=get_utc_time(),
                status=tool_execution_result.status,
                tool_return=str(tool_execution_result.func_return),
                stdout=tool_execution_result.stdout,
                stderr=tool_execution_result.stderr,
            )

        except Exception as e:
            func_return = get_friendly_error_msg(function_name=tool.name, exception_name=type(e).__name__, exception_message=str(e))
            return ToolReturnMessage(
                id="null",
                tool_call_id="null",
                date=get_utc_time(),
                status="error",
                tool_return=func_return,
                stdout=[],
                stderr=[traceback.format_exc()],
            )

    # Composio wrappers
    @staticmethod
    def get_composio_client(api_key: Optional[str] = None):
        if api_key:
            return Composio(api_key=api_key)
        elif tool_settings.composio_api_key:
            return Composio(api_key=tool_settings.composio_api_key)
        else:
            return Composio()

    @staticmethod
    def get_composio_apps(api_key: Optional[str] = None) -> List["AppModel"]:
        """Get a list of all Composio apps with actions"""
        apps = SyncServer.get_composio_client(api_key=api_key).apps.get()
        apps_with_actions = []
        for app in apps:
            # A bit of hacky logic until composio patches this
            if app.meta["actionsCount"] > 0 and not app.name.lower().endswith("_beta"):
                apps_with_actions.append(app)

        return apps_with_actions

    def get_composio_actions_from_app_name(self, composio_app_name: str, api_key: Optional[str] = None) -> List["ActionModel"]:
        actions = self.get_composio_client(api_key=api_key).actions.get(apps=[composio_app_name])
        # Filter out deprecated composio actions
        return [action for action in actions if "deprecated" not in action.description.lower()]

    # MCP wrappers
    # TODO support both command + SSE servers (via config)
    def get_mcp_servers(self) -> dict[str, Union[SSEServerConfig, StdioServerConfig]]:
        """List the MCP servers in the config (doesn't test that they are actually working)"""

        # TODO implement non-flatfile mechanism
        if not tool_settings.mcp_read_from_config:
            return {}
            # raise RuntimeError("MCP config file disabled. Enable it in settings.")

        mcp_server_list = {}

        # Attempt to read from ~/.letta/mcp_config.json
        mcp_config_path = os.path.join(constants.LETTA_DIR, constants.MCP_CONFIG_NAME)
        if os.path.exists(mcp_config_path):
            with open(mcp_config_path, "r") as f:
                try:
                    mcp_config = json.load(f)
                except Exception as e:
                    logger.error(f"Failed to parse MCP config file ({mcp_config_path}) as json: {e}")
                    return mcp_server_list

                # Proper formatting is "mcpServers" key at the top level,
                # then a dict with the MCP server name as the key,
                # with the value being the schema from StdioServerParameters
                if MCP_CONFIG_TOPLEVEL_KEY in mcp_config:
                    for server_name, server_params_raw in mcp_config[MCP_CONFIG_TOPLEVEL_KEY].items():
                        # No support for duplicate server names
                        if server_name in mcp_server_list:
                            logger.error(f"Duplicate MCP server name found (skipping): {server_name}")
                            continue

                        if "url" in server_params_raw:
                            # Attempt to parse the server params as an SSE server
                            try:
                                server_params = SSEServerConfig(
                                    server_name=server_name,
                                    server_url=server_params_raw["url"],
                                )
                                mcp_server_list[server_name] = server_params
                            except Exception as e:
                                logger.error(f"Failed to parse server params for MCP server {server_name} (skipping): {e}")
                                continue
                        else:
                            # Attempt to parse the server params as a StdioServerParameters
                            try:
                                server_params = StdioServerConfig(
                                    server_name=server_name,
                                    command=server_params_raw["command"],
                                    args=server_params_raw.get("args", []),
                                    env=server_params_raw.get("env", {}),
                                )
                                mcp_server_list[server_name] = server_params
                            except Exception as e:
                                logger.error(f"Failed to parse server params for MCP server {server_name} (skipping): {e}")
                                continue

        # If the file doesn't exist, return empty dictionary
        return mcp_server_list

    async def get_tools_from_mcp_server(self, mcp_server_name: str) -> List[MCPTool]:
        """List the tools in an MCP server. Requires a client to be created."""
        if mcp_server_name not in self.mcp_clients:
            raise ValueError(f"No client was created for MCP server: {mcp_server_name}")

        tools = await self.mcp_clients[mcp_server_name].list_tools()
        # Add health information to each tool
        for tool in tools:
            if tool.inputSchema:
                health_status, reasons = validate_complete_json_schema(tool.inputSchema)
                tool.health = MCPToolHealth(status=health_status.value, reasons=reasons)

        return tools

    async def add_mcp_server_to_config(
        self, server_config: Union[SSEServerConfig, StdioServerConfig], allow_upsert: bool = True
    ) -> List[Union[SSEServerConfig, StdioServerConfig]]:
        """Add a new server config to the MCP config file"""

        # TODO implement non-flatfile mechanism
        if not tool_settings.mcp_read_from_config:
            raise RuntimeError("MCP config file disabled. Enable it in settings.")

        # If the config file doesn't exist, throw an error.
        mcp_config_path = os.path.join(constants.LETTA_DIR, constants.MCP_CONFIG_NAME)
        if not os.path.exists(mcp_config_path):
            # Create the file if it doesn't exist
            logger.debug(f"MCP config file not found, creating new file at: {mcp_config_path}")

        # If the file does exist, attempt to parse it get calling get_mcp_servers
        try:
            current_mcp_servers = self.get_mcp_servers()
        except Exception as e:
            # Raise an error telling the user to fix the config file
            logger.error(f"Failed to parse MCP config file at {mcp_config_path}: {e}")
            raise ValueError(f"Failed to parse MCP config file {mcp_config_path}")

        # Check if the server name is already in the config
        if server_config.server_name in current_mcp_servers and not allow_upsert:
            raise ValueError(f"Server name {server_config.server_name} is already in the config file")

        # Attempt to initialize the connection to the server
        if server_config.type == MCPServerType.SSE:
            new_mcp_client = AsyncSSEMCPClient(server_config)
        elif server_config.type == MCPServerType.STDIO:
            new_mcp_client = AsyncStdioMCPClient(server_config)
        else:
            raise ValueError(f"Invalid MCP server config: {server_config}")
        try:
            await new_mcp_client.connect_to_server()
        except:
            logger.exception(f"Failed to connect to MCP server: {server_config.server_name}")
            raise RuntimeError(f"Failed to connect to MCP server: {server_config.server_name}")
        # Print out the tools that are connected
        logger.info(f"Attempting to fetch tools from MCP server: {server_config.server_name}")
        new_mcp_tools = await new_mcp_client.list_tools()
        logger.info(f"MCP tools connected: {', '.join([t.name for t in new_mcp_tools])}")
        logger.debug(f"MCP tools: {', '.join([str(t) for t in new_mcp_tools])}")

        # Now that we've confirmed the config is working, let's add it to the client list
        self.mcp_clients[server_config.server_name] = new_mcp_client

        # Add to the server file
        current_mcp_servers[server_config.server_name] = server_config

        # Write out the file, and make sure to in include the top-level mcpConfig
        try:
            new_mcp_file = {MCP_CONFIG_TOPLEVEL_KEY: {k: v.to_dict() for k, v in current_mcp_servers.items()}}
            with open(mcp_config_path, "w") as f:
                json.dump(new_mcp_file, f, indent=4)
        except Exception as e:
            logger.error(f"Failed to write MCP config file at {mcp_config_path}: {e}")
            raise ValueError(f"Failed to write MCP config file {mcp_config_path}")

        return list(current_mcp_servers.values())

    def delete_mcp_server_from_config(self, server_name: str) -> dict[str, Union[SSEServerConfig, StdioServerConfig]]:
        """Delete a server config from the MCP config file"""

        # TODO implement non-flatfile mechanism
        if not tool_settings.mcp_read_from_config:
            raise RuntimeError("MCP config file disabled. Enable it in settings.")

        # If the config file doesn't exist, throw an error.
        mcp_config_path = os.path.join(constants.LETTA_DIR, constants.MCP_CONFIG_NAME)
        if not os.path.exists(mcp_config_path):
            # If the file doesn't exist, raise an error
            raise FileNotFoundError(f"MCP config file not found: {mcp_config_path}")

        # If the file does exist, attempt to parse it get calling get_mcp_servers
        try:
            current_mcp_servers = self.get_mcp_servers()
        except Exception as e:
            # Raise an error telling the user to fix the config file
            logger.error(f"Failed to parse MCP config file at {mcp_config_path}: {e}")
            raise ValueError(f"Failed to parse MCP config file {mcp_config_path}")

        # Check if the server name is already in the config
        # If it's not, throw an error
        if server_name not in current_mcp_servers:
            raise ValueError(f"Server name {server_name} not found in MCP config file")

        # Remove from the server file
        del current_mcp_servers[server_name]

        # Write out the file, and make sure to in include the top-level mcpConfig
        try:
            new_mcp_file = {MCP_CONFIG_TOPLEVEL_KEY: {k: v.to_dict() for k, v in current_mcp_servers.items()}}
            with open(mcp_config_path, "w") as f:
                json.dump(new_mcp_file, f, indent=4)
        except Exception as e:
            logger.error(f"Failed to write MCP config file at {mcp_config_path}: {e}")
            raise ValueError(f"Failed to write MCP config file {mcp_config_path}")

        return list(current_mcp_servers.values())

    @trace_method
    async def send_message_to_agent(
        self,
        agent_id: str,
        actor: User,
        # role: MessageRole,
        input_messages: List[MessageCreate],
        stream_steps: bool,
        stream_tokens: bool,
        # related to whether or not we return `LettaMessage`s or `Message`s
        chat_completion_mode: bool = False,
        # Support for AssistantMessage
        use_assistant_message: bool = True,
        assistant_message_tool_name: str = constants.DEFAULT_MESSAGE_TOOL,
        assistant_message_tool_kwarg: str = constants.DEFAULT_MESSAGE_TOOL_KWARG,
        metadata: Optional[dict] = None,
        request_start_timestamp_ns: Optional[int] = None,
        include_return_message_types: Optional[List[MessageType]] = None,
    ) -> Union[StreamingResponse, LettaResponse]:
        """Split off into a separate function so that it can be imported in the /chat/completion proxy."""
        # TODO: @charles is this the correct way to handle?
        include_final_message = True

        if not stream_steps and stream_tokens:
            raise HTTPException(status_code=400, detail="stream_steps must be 'true' if stream_tokens is 'true'")

        # For streaming response
        try:
            # TODO: move this logic into server.py

            # Get the generator object off of the agent's streaming interface
            # This will be attached to the POST SSE request used under-the-hood
            letta_agent = self.load_agent(agent_id=agent_id, actor=actor)

            # Disable token streaming if not OpenAI or Anthropic
            # TODO: cleanup this logic
            llm_config = letta_agent.agent_state.llm_config
            # supports_token_streaming = ["openai", "anthropic", "xai", "deepseek"]
            supports_token_streaming = ["openai", "anthropic", "deepseek"]  # TODO re-enable xAI once streaming is patched
            if stream_tokens and (llm_config.model_endpoint_type not in supports_token_streaming):
                warnings.warn(
                    f"Token streaming is only supported for models with type {' or '.join(supports_token_streaming)} in the model_endpoint: agent has endpoint type {llm_config.model_endpoint_type} and {llm_config.model_endpoint}. Setting stream_tokens to False."
                )
                stream_tokens = False

            # Create a new interface per request
            letta_agent.interface = StreamingServerInterface(
                # multi_step=True,  # would we ever want to disable this?
                use_assistant_message=use_assistant_message,
                assistant_message_tool_name=assistant_message_tool_name,
                assistant_message_tool_kwarg=assistant_message_tool_kwarg,
                inner_thoughts_in_kwargs=(
                    llm_config.put_inner_thoughts_in_kwargs if llm_config.put_inner_thoughts_in_kwargs is not None else False
                ),
                # inner_thoughts_kwarg=INNER_THOUGHTS_KWARG,
            )
            streaming_interface = letta_agent.interface
            if not isinstance(streaming_interface, StreamingServerInterface):
                raise ValueError(f"Agent has wrong type of interface: {type(streaming_interface)}")

            # Enable token-streaming within the request if desired
            streaming_interface.streaming_mode = stream_tokens
            # "chatcompletion mode" does some remapping and ignores inner thoughts
            streaming_interface.streaming_chat_completion_mode = chat_completion_mode

            # streaming_interface.allow_assistant_message = stream
            # streaming_interface.function_call_legacy_mode = stream

            # Allow AssistantMessage is desired by client
            # streaming_interface.use_assistant_message = use_assistant_message
            # streaming_interface.assistant_message_tool_name = assistant_message_tool_name
            # streaming_interface.assistant_message_tool_kwarg = assistant_message_tool_kwarg

            # Related to JSON buffer reader
            # streaming_interface.inner_thoughts_in_kwargs = (
            #     llm_config.put_inner_thoughts_in_kwargs if llm_config.put_inner_thoughts_in_kwargs is not None else False
            # )

            # Offload the synchronous message_func to a separate thread
            streaming_interface.stream_start()
            task = asyncio.create_task(
                asyncio.to_thread(
                    self.send_messages,
                    actor=actor,
                    agent_id=agent_id,
                    input_messages=input_messages,
                    interface=streaming_interface,
                    metadata=metadata,
                )
            )

            if stream_steps:
                # return a stream
                return StreamingResponse(
                    sse_async_generator(
                        streaming_interface.get_generator(),
                        usage_task=task,
                        finish_message=include_final_message,
                        request_start_timestamp_ns=request_start_timestamp_ns,
                        llm_config=llm_config,
                    ),
                    media_type="text/event-stream",
                )

            else:
                # buffer the stream, then return the list
                generated_stream = []
                async for message in streaming_interface.get_generator():
                    assert (
                        isinstance(message, LettaMessage)
                        or isinstance(message, LegacyLettaMessage)
                        or isinstance(message, MessageStreamStatus)
                    ), type(message)
                    generated_stream.append(message)
                    if message == MessageStreamStatus.done:
                        break

                # Get rid of the stream status messages
                filtered_stream = [d for d in generated_stream if not isinstance(d, MessageStreamStatus)]

                # Apply message type filtering if specified
                if include_return_message_types is not None:
                    filtered_stream = [msg for msg in filtered_stream if msg.message_type in include_return_message_types]

                usage = await task

                # By default the stream will be messages of type LettaMessage or LettaLegacyMessage
                # If we want to convert these to Message, we can use the attached IDs
                # NOTE: we will need to de-duplicate the Messsage IDs though (since Assistant->Inner+Func_Call)
                # TODO: eventually update the interface to use `Message` and `MessageChunk` (new) inside the deque instead
                return LettaResponse(
                    messages=filtered_stream,
                    stop_reason=LettaStopReason(stop_reason=StopReasonType.end_turn.value),
                    usage=usage,
                )

        except HTTPException:
            raise
        except Exception as e:
            print(e)
            import traceback

            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"{e}")

    @trace_method
    async def send_group_message_to_agent(
        self,
        group_id: str,
        actor: User,
        input_messages: Union[List[Message], List[MessageCreate]],
        stream_steps: bool,
        stream_tokens: bool,
        chat_completion_mode: bool = False,
        # Support for AssistantMessage
        use_assistant_message: bool = True,
        assistant_message_tool_name: str = constants.DEFAULT_MESSAGE_TOOL,
        assistant_message_tool_kwarg: str = constants.DEFAULT_MESSAGE_TOOL_KWARG,
        metadata: Optional[dict] = None,
    ) -> Union[StreamingResponse, LettaResponse]:
        include_final_message = True
        if not stream_steps and stream_tokens:
            raise ValueError("stream_steps must be 'true' if stream_tokens is 'true'")

        group = await self.group_manager.retrieve_group_async(group_id=group_id, actor=actor)
        agent_state_id = group.manager_agent_id or (group.agent_ids[0] if len(group.agent_ids) > 0 else None)
        agent_state = await self.agent_manager.get_agent_by_id_async(agent_id=agent_state_id, actor=actor) if agent_state_id else None
        letta_multi_agent = load_multi_agent(group=group, agent_state=agent_state, actor=actor)

        llm_config = letta_multi_agent.agent_state.llm_config
        supports_token_streaming = ["openai", "anthropic", "deepseek"]
        if stream_tokens and (llm_config.model_endpoint_type not in supports_token_streaming):
            warnings.warn(
                f"Token streaming is only supported for models with type {' or '.join(supports_token_streaming)} in the model_endpoint: agent has endpoint type {llm_config.model_endpoint_type} and {llm_config.model_endpoint}. Setting stream_tokens to False."
            )
            stream_tokens = False

        # Create a new interface per request
        letta_multi_agent.interface = StreamingServerInterface(
            use_assistant_message=use_assistant_message,
            assistant_message_tool_name=assistant_message_tool_name,
            assistant_message_tool_kwarg=assistant_message_tool_kwarg,
            inner_thoughts_in_kwargs=(
                llm_config.put_inner_thoughts_in_kwargs if llm_config.put_inner_thoughts_in_kwargs is not None else False
            ),
        )
        streaming_interface = letta_multi_agent.interface
        if not isinstance(streaming_interface, StreamingServerInterface):
            raise ValueError(f"Agent has wrong type of interface: {type(streaming_interface)}")
        streaming_interface.streaming_mode = stream_tokens
        streaming_interface.streaming_chat_completion_mode = chat_completion_mode
        if metadata and hasattr(streaming_interface, "metadata"):
            streaming_interface.metadata = metadata

        streaming_interface.stream_start()
        task = asyncio.create_task(
            asyncio.to_thread(
                letta_multi_agent.step,
                input_messages=input_messages,
                chaining=self.chaining,
                max_chaining_steps=self.max_chaining_steps,
            )
        )

        if stream_steps:
            # return a stream
            return StreamingResponse(
                sse_async_generator(
                    streaming_interface.get_generator(),
                    usage_task=task,
                    finish_message=include_final_message,
                ),
                media_type="text/event-stream",
            )

        else:
            # buffer the stream, then return the list
            generated_stream = []
            async for message in streaming_interface.get_generator():
                assert (
                    isinstance(message, LettaMessage) or isinstance(message, LegacyLettaMessage) or isinstance(message, MessageStreamStatus)
                ), type(message)
                generated_stream.append(message)
                if message == MessageStreamStatus.done:
                    break

            # Get rid of the stream status messages
            filtered_stream = [d for d in generated_stream if not isinstance(d, MessageStreamStatus)]
            usage = await task

            # By default the stream will be messages of type LettaMessage or LettaLegacyMessage
            # If we want to convert these to Message, we can use the attached IDs
            # NOTE: we will need to de-duplicate the Messsage IDs though (since Assistant->Inner+Func_Call)
            # TODO: eventually update the interface to use `Message` and `MessageChunk` (new) inside the deque instead
            return LettaResponse(
                messages=filtered_stream,
                stop_reason=LettaStopReason(stop_reason=StopReasonType.end_turn.value),
                usage=usage,
            )
