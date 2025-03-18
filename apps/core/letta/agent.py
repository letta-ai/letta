import json
import time
import traceback
import warnings
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Tuple, Union

from openai.types.beta.function_tool import FunctionTool as OpenAITool

from letta.constants import (
    CLI_WARNING_PREFIX,
    COMPOSIO_ENTITY_ENV_VAR_KEY,
    ERROR_MESSAGE_PREFIX,
    FIRST_MESSAGE_ATTEMPTS,
    FUNC_FAILED_HEARTBEAT_MESSAGE,
    LETTA_CORE_TOOL_MODULE_NAME,
    LETTA_MULTI_AGENT_TOOL_MODULE_NAME,
    LLM_MAX_TOKENS,
    REQ_HEARTBEAT_MESSAGE,
)
from letta.errors import ContextWindowExceededError
from letta.functions.ast_parsers import coerce_dict_args_by_annotations, get_function_annotations_from_source
from letta.functions.functions import get_function_from_module
from letta.functions.helpers import execute_composio_action, generate_composio_action_from_func_name
from letta.functions.mcp_client.base_client import BaseMCPClient
from letta.helpers import ToolRulesSolver
from letta.helpers.composio_helpers import get_composio_api_key
from letta.helpers.datetime_helpers import get_utc_time
from letta.helpers.json_helpers import json_dumps, json_loads
from letta.interface import AgentInterface
from letta.llm_api.helpers import calculate_summarizer_cutoff, get_token_counts_for_messages, is_context_overflow_error
from letta.llm_api.llm_api_tools import create
from letta.llm_api.llm_client import LLMClient
from letta.local_llm.utils import num_tokens_from_functions, num_tokens_from_messages
from letta.log import get_logger
from letta.memory import summarize_messages
from letta.orm import User
from letta.orm.enums import ToolType
from letta.schemas.agent import AgentState, AgentStepResponse, UpdateAgent
from letta.schemas.block import BlockUpdate
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.enums import MessageRole
from letta.schemas.letta_message_content import TextContent
from letta.schemas.memory import ContextWindowOverview, Memory
from letta.schemas.message import Message, ToolReturn
from letta.schemas.openai.chat_completion_response import ChatCompletionResponse
from letta.schemas.openai.chat_completion_response import Message as ChatCompletionMessage
from letta.schemas.openai.chat_completion_response import UsageStatistics
from letta.schemas.sandbox_config import SandboxRunResult
from letta.schemas.tool import Tool
from letta.schemas.tool_rule import TerminalToolRule
from letta.schemas.usage import LettaUsageStatistics
from letta.services.agent_manager import AgentManager
from letta.services.block_manager import BlockManager
from letta.services.helpers.agent_manager_helper import check_supports_structured_output, compile_memory_metadata_block
from letta.services.job_manager import JobManager
from letta.services.message_manager import MessageManager
from letta.services.passage_manager import PassageManager
from letta.services.provider_manager import ProviderManager
from letta.services.step_manager import StepManager
from letta.services.tool_execution_sandbox import ToolExecutionSandbox
from letta.services.tool_manager import ToolManager
from letta.settings import summarizer_settings
from letta.streaming_interface import StreamingRefreshCLIInterface
from letta.system import get_heartbeat, get_token_limit_warning, package_function_response, package_summarize_message, package_user_message
from letta.tracing import log_event, trace_method
from letta.utils import count_tokens, get_friendly_error_msg, get_tool_call_id, log_telemetry, parse_json, validate_function_response

logger = get_logger(__name__)


class BaseAgent(ABC):
    """
    Abstract class for all agents.
    Only one interface is required: step.
    """

    @abstractmethod
    def step(
        self,
        messages: Union[Message, List[Message]],
    ) -> LettaUsageStatistics:
        """
        Top-level event message handler for the agent.
        """
        raise NotImplementedError


class Agent(BaseAgent):
    def __init__(
        self,
        interface: Optional[Union[AgentInterface, StreamingRefreshCLIInterface]],
        agent_state: AgentState,  # in-memory representation of the agent state (read from multiple tables)
        user: User,
        # extras
        first_message_verify_mono: bool = True,  # TODO move to config?
        # MCP sessions, state held in-memory in the server
        mcp_clients: Optional[Dict[str, BaseMCPClient]] = None,
        save_last_response: bool = False,
    ):
        assert isinstance(agent_state.memory, Memory), f"Memory object is not of type Memory: {type(agent_state.memory)}"
        # Hold a copy of the state that was used to init the agent
        self.agent_state = agent_state
        assert isinstance(self.agent_state.memory, Memory), f"Memory object is not of type Memory: {type(self.agent_state.memory)}"

        self.user = user

        # initialize a tool rules solver
        if agent_state.tool_rules:
            # if there are tool rules, print out a warning
            for rule in agent_state.tool_rules:
                if not isinstance(rule, TerminalToolRule):
                    warnings.warn("Tool rules only work reliably for the latest OpenAI models that support structured outputs.")
                    break

        self.tool_rules_solver = ToolRulesSolver(tool_rules=agent_state.tool_rules)

        # gpt-4, gpt-3.5-turbo, ...
        self.model = self.agent_state.llm_config.model
        self.supports_structured_output = check_supports_structured_output(model=self.model, tool_rules=agent_state.tool_rules)

        # state managers
        self.block_manager = BlockManager()

        # Interface must implement:
        # - internal_monologue
        # - assistant_message
        # - function_message
        # ...
        # Different interfaces can handle events differently
        # e.g., print in CLI vs send a discord message with a discord bot
        self.interface = interface

        # Create the persistence manager object based on the AgentState info
        self.message_manager = MessageManager()
        self.passage_manager = PassageManager()
        self.provider_manager = ProviderManager()
        self.agent_manager = AgentManager()
        self.job_manager = JobManager()
        self.step_manager = StepManager()

        # State needed for heartbeat pausing

        self.first_message_verify_mono = first_message_verify_mono

        # Controls if the convo memory pressure warning is triggered
        # When an alert is sent in the message queue, set this to True (to avoid repeat alerts)
        # When the summarizer is run, set this back to False (to reset)
        self.agent_alerted_about_memory_pressure = False

        # Load last function response from message history
        self.last_function_response = self.load_last_function_response()

        # Save last responses in memory
        self.save_last_response = save_last_response
        self.last_response_messages = []

        # Logger that the Agent specifically can use, will also report the agent_state ID with the logs
        self.logger = get_logger(agent_state.id)

        # MCPClient, state/sessions managed by the server
        self.mcp_clients = mcp_clients

    def load_last_function_response(self):
        """Load the last function response from message history"""
        in_context_messages = self.agent_manager.get_in_context_messages(agent_id=self.agent_state.id, actor=self.user)
        for i in range(len(in_context_messages) - 1, -1, -1):
            msg = in_context_messages[i]
            if msg.role == MessageRole.tool and msg.content and len(msg.content) == 1 and isinstance(msg.content[0], TextContent):
                text_content = msg.content[0].text
                try:
                    response_json = json.loads(text_content)
                    if response_json.get("message"):
                        return response_json["message"]
                except (json.JSONDecodeError, KeyError):
                    raise ValueError(f"Invalid JSON format in message: {text_content}")
        return None

    def update_memory_if_changed(self, new_memory: Memory) -> bool:
        """
        Update internal memory object and system prompt if there have been modifications.

        Args:
            new_memory (Memory): the new memory object to compare to the current memory object

        Returns:
            modified (bool): whether the memory was updated
        """
        if self.agent_state.memory.compile() != new_memory.compile():
            # update the blocks (LRW) in the DB
            for label in self.agent_state.memory.list_block_labels():
                updated_value = new_memory.get_block(label).value
                if updated_value != self.agent_state.memory.get_block(label).value:
                    # update the block if it's changed
                    block_id = self.agent_state.memory.get_block(label).id
                    block = self.block_manager.update_block(
                        block_id=block_id, block_update=BlockUpdate(value=updated_value), actor=self.user
                    )

            # refresh memory from DB (using block ids)
            self.agent_state.memory = Memory(
                blocks=[self.block_manager.get_block_by_id(block.id, actor=self.user) for block in self.agent_state.memory.get_blocks()]
            )

            # NOTE: don't do this since re-buildin the memory is handled at the start of the step
            # rebuild memory - this records the last edited timestamp of the memory
            # TODO: pass in update timestamp from block edit time
            self.agent_state = self.agent_manager.rebuild_system_prompt(agent_id=self.agent_state.id, actor=self.user)

            return True
        return False

    # TODO: Refactor into separate class v.s. large if/elses here
    def execute_tool_and_persist_state(
        self, function_name: str, function_args: dict, target_letta_tool: Tool
    ) -> tuple[Any, Optional[SandboxRunResult]]:
        """
        Execute tool modifications and persist the state of the agent.
        Note: only some agent state modifications will be persisted, such as data in the AgentState ORM and block data
        """
        # TODO: add agent manager here
        orig_memory_str = self.agent_state.memory.compile()

        # TODO: need to have an AgentState object that actually has full access to the block data
        # this is because the sandbox tools need to be able to access block.value to edit this data
        try:
            if target_letta_tool.tool_type == ToolType.LETTA_CORE:
                # base tools are allowed to access the `Agent` object and run on the database
                callable_func = get_function_from_module(LETTA_CORE_TOOL_MODULE_NAME, function_name)
                function_args["self"] = self  # need to attach self to arg since it's dynamically linked
                function_response = callable_func(**function_args)
            elif target_letta_tool.tool_type == ToolType.LETTA_MULTI_AGENT_CORE:
                callable_func = get_function_from_module(LETTA_MULTI_AGENT_TOOL_MODULE_NAME, function_name)
                function_args["self"] = self  # need to attach self to arg since it's dynamically linked
                function_response = callable_func(**function_args)
            elif target_letta_tool.tool_type == ToolType.LETTA_MEMORY_CORE:
                callable_func = get_function_from_module(LETTA_CORE_TOOL_MODULE_NAME, function_name)
                agent_state_copy = self.agent_state.__deepcopy__()
                function_args["agent_state"] = agent_state_copy  # need to attach self to arg since it's dynamically linked
                function_response = callable_func(**function_args)
                self.update_memory_if_changed(agent_state_copy.memory)
            elif target_letta_tool.tool_type == ToolType.EXTERNAL_COMPOSIO:
                action_name = generate_composio_action_from_func_name(target_letta_tool.name)
                # Get entity ID from the agent_state
                entity_id = None
                for env_var in self.agent_state.tool_exec_environment_variables:
                    if env_var.key == COMPOSIO_ENTITY_ENV_VAR_KEY:
                        entity_id = env_var.value
                # Get composio_api_key
                composio_api_key = get_composio_api_key(actor=self.user, logger=self.logger)
                function_response = execute_composio_action(
                    action_name=action_name, args=function_args, api_key=composio_api_key, entity_id=entity_id
                )
            elif target_letta_tool.tool_type == ToolType.EXTERNAL_MCP:
                # Get the server name from the tool tag
                # TODO make a property instead?
                server_name = target_letta_tool.tags[0].split(":")[1]

                # Get the MCPClient from the server's handle
                # TODO these don't get raised properly
                if not self.mcp_clients:
                    raise ValueError(f"No MCP client available to use")
                if server_name not in self.mcp_clients:
                    raise ValueError(f"Unknown MCP server name: {server_name}")
                mcp_client = self.mcp_clients[server_name]
                if not isinstance(mcp_client, BaseMCPClient):
                    raise RuntimeError(f"Expected an MCPClient, but got: {type(mcp_client)}")

                # Check that tool exists
                available_tools = mcp_client.list_tools()
                available_tool_names = [t.name for t in available_tools]
                if function_name not in available_tool_names:
                    raise ValueError(
                        f"{function_name} is not available in MCP server {server_name}. Please check your `~/.letta/mcp_config.json` file."
                    )

                function_response, is_error = mcp_client.execute_tool(tool_name=function_name, tool_args=function_args)
                sandbox_run_result = SandboxRunResult(status="error" if is_error else "success")
                return function_response, sandbox_run_result
            else:
                try:
                    # Parse the source code to extract function annotations
                    annotations = get_function_annotations_from_source(target_letta_tool.source_code, function_name)
                    # Coerce the function arguments to the correct types based on the annotations
                    function_args = coerce_dict_args_by_annotations(function_args, annotations)
                except ValueError as e:
                    self.logger.debug(f"Error coercing function arguments: {e}")

                # execute tool in a sandbox
                # TODO: allow agent_state to specify which sandbox to execute tools in
                # TODO: This is only temporary, can remove after we publish a pip package with this object
                agent_state_copy = self.agent_state.__deepcopy__()
                agent_state_copy.tools = []
                agent_state_copy.tool_rules = []

                sandbox_run_result = ToolExecutionSandbox(function_name, function_args, self.user, tool_object=target_letta_tool).run(
                    agent_state=agent_state_copy
                )
                function_response, updated_agent_state = sandbox_run_result.func_return, sandbox_run_result.agent_state
                assert orig_memory_str == self.agent_state.memory.compile(), "Memory should not be modified in a sandbox tool"
                if updated_agent_state is not None:
                    self.update_memory_if_changed(updated_agent_state.memory)
                return function_response, sandbox_run_result
        except Exception as e:
            # Need to catch error here, or else trunction wont happen
            # TODO: modify to function execution error
            function_response = get_friendly_error_msg(
                function_name=function_name, exception_name=type(e).__name__, exception_message=str(e)
            )
            return function_response, SandboxRunResult(status="error")

        return function_response, None

    def _handle_function_error_response(
        self,
        error_msg: str,
        tool_call_id: str,
        function_name: str,
        function_args: dict,
        function_response: str,
        messages: List[Message],
        tool_returns: Optional[List[ToolReturn]] = None,
        include_function_failed_message: bool = False,
    ) -> List[Message]:
        """
        Handle error from function call response
        """
        # Update tool rules
        self.last_function_response = function_response
        self.tool_rules_solver.update_tool_usage(function_name)

        # Extend conversation with function response
        function_response = package_function_response(False, error_msg)
        new_message = Message.dict_to_message(
            agent_id=self.agent_state.id,
            user_id=self.agent_state.created_by_id,
            model=self.model,
            openai_message_dict={
                "role": "tool",
                "name": function_name,
                "content": function_response,
                "tool_call_id": tool_call_id,
            },
            tool_returns=tool_returns,
        )
        messages.append(new_message)
        self.interface.function_message(f"Error: {error_msg}", msg_obj=new_message)
        if include_function_failed_message:
            self.interface.function_message(f"Ran {function_name}({function_args})", msg_obj=new_message)

        # Return updated messages
        return messages

    @trace_method
    def _get_ai_reply(
        self,
        message_sequence: List[Message],
        function_call: Optional[str] = None,
        first_message: bool = False,
        stream: bool = False,  # TODO move to config?
        empty_response_retry_limit: int = 3,
        backoff_factor: float = 0.5,  # delay multiplier for exponential backoff
        max_delay: float = 10.0,  # max delay between retries
        step_count: Optional[int] = None,
        last_function_failed: bool = False,
        put_inner_thoughts_first: bool = True,
    ) -> ChatCompletionResponse:
        """Get response from LLM API with robust retry mechanism."""
        log_telemetry(self.logger, "_get_ai_reply start")
        available_tools = set([t.name for t in self.agent_state.tools])
        allowed_tool_names = self.tool_rules_solver.get_allowed_tool_names(
            available_tools=available_tools, last_function_response=self.last_function_response
        )
        agent_state_tool_jsons = [t.json_schema for t in self.agent_state.tools]

        allowed_functions = (
            agent_state_tool_jsons
            if not allowed_tool_names
            else [func for func in agent_state_tool_jsons if func["name"] in allowed_tool_names]
        )

        # Don't allow a tool to be called if it failed last time
        if last_function_failed and self.tool_rules_solver.tool_call_history:
            allowed_functions = [f for f in allowed_functions if f["name"] != self.tool_rules_solver.tool_call_history[-1]]
            if not allowed_functions:
                return None

        # For the first message, force the initial tool if one is specified
        force_tool_call = None
        if (
            step_count is not None
            and step_count == 0
            and not self.supports_structured_output
            and len(self.tool_rules_solver.init_tool_rules) > 0
        ):
            force_tool_call = self.tool_rules_solver.init_tool_rules[0].tool_name
        # Force a tool call if exactly one tool is specified
        elif step_count is not None and step_count > 0 and len(allowed_tool_names) == 1:
            force_tool_call = allowed_tool_names[0]

        for attempt in range(1, empty_response_retry_limit + 1):
            try:
                log_telemetry(self.logger, "_get_ai_reply create start")
                # New LLM client flow
                llm_client = LLMClient.create(
                    agent_id=self.agent_state.id,
                    llm_config=self.agent_state.llm_config,
                    put_inner_thoughts_first=put_inner_thoughts_first,
                    actor_id=self.agent_state.created_by_id,
                )

                if llm_client and not stream:
                    response = llm_client.send_llm_request(
                        messages=message_sequence,
                        tools=allowed_functions,
                        tool_call=function_call,
                        stream=stream,
                        first_message=first_message,
                        force_tool_call=force_tool_call,
                    )
                else:
                    # Fallback to existing flow
                    response = create(
                        llm_config=self.agent_state.llm_config,
                        messages=message_sequence,
                        user_id=self.agent_state.created_by_id,
                        functions=allowed_functions,
                        # functions_python=self.functions_python, do we need this?
                        function_call=function_call,
                        first_message=first_message,
                        force_tool_call=force_tool_call,
                        stream=stream,
                        stream_interface=self.interface,
                        put_inner_thoughts_first=put_inner_thoughts_first,
                    )
                log_telemetry(self.logger, "_get_ai_reply create finish")

                # These bottom two are retryable
                if len(response.choices) == 0 or response.choices[0] is None:
                    raise ValueError(f"API call returned an empty message: {response}")

                if response.choices[0].finish_reason not in ["stop", "function_call", "tool_calls"]:
                    if response.choices[0].finish_reason == "length":
                        # This is not retryable, hence RuntimeError v.s. ValueError
                        raise RuntimeError("Finish reason was length (maximum context length)")
                    else:
                        raise ValueError(f"Bad finish reason from API: {response.choices[0].finish_reason}")
                log_telemetry(self.logger, "_handle_ai_response finish")
                return response

            except ValueError as ve:
                if attempt >= empty_response_retry_limit:
                    warnings.warn(f"Retry limit reached. Final error: {ve}")
                    log_telemetry(self.logger, "_handle_ai_response finish ValueError")
                    raise Exception(f"Retries exhausted and no valid response received. Final error: {ve}")
                else:
                    delay = min(backoff_factor * (2 ** (attempt - 1)), max_delay)
                    warnings.warn(f"Attempt {attempt} failed: {ve}. Retrying in {delay} seconds...")
                    time.sleep(delay)

            except Exception as e:
                # For non-retryable errors, exit immediately
                log_telemetry(self.logger, "_handle_ai_response finish generic Exception")
                raise e

        log_telemetry(self.logger, "_handle_ai_response finish catch-all exception")
        raise Exception("Retries exhausted and no valid response received.")

    @trace_method
    def _handle_ai_response(
        self,
        response_message: ChatCompletionMessage,  # TODO should we eventually move the Message creation outside of this function?
        override_tool_call_id: bool = False,
        # If we are streaming, we needed to create a Message ID ahead of time,
        # and now we want to use it in the creation of the Message object
        # TODO figure out a cleaner way to do this
        response_message_id: Optional[str] = None,
    ) -> Tuple[List[Message], bool, bool]:
        """Handles parsing and function execution"""
        log_telemetry(self.logger, "_handle_ai_response start")
        # Hacky failsafe for now to make sure we didn't implement the streaming Message ID creation incorrectly
        if response_message_id is not None:
            assert response_message_id.startswith("message-"), response_message_id

        messages = []  # append these to the history when done
        function_name = None
        function_args = {}

        # Step 2: check if LLM wanted to call a function
        if response_message.function_call or (response_message.tool_calls is not None and len(response_message.tool_calls) > 0):
            if response_message.function_call:
                raise DeprecationWarning(response_message)
            if response_message.tool_calls is not None and len(response_message.tool_calls) > 1:
                # raise NotImplementedError(f">1 tool call not supported")
                # TODO eventually support sequential tool calling
                self.logger.warning(f">1 tool call not supported, using index=0 only\n{response_message.tool_calls}")
                response_message.tool_calls = [response_message.tool_calls[0]]
            assert response_message.tool_calls is not None and len(response_message.tool_calls) > 0

            # generate UUID for tool call
            if override_tool_call_id or response_message.function_call:
                warnings.warn("Overriding the tool call can result in inconsistent tool call IDs during streaming")
                tool_call_id = get_tool_call_id()  # needs to be a string for JSON
                response_message.tool_calls[0].id = tool_call_id
            else:
                tool_call_id = response_message.tool_calls[0].id
                assert tool_call_id is not None  # should be defined

            # only necessary to add the tool_cal_id to a function call (antipattern)
            # response_message_dict = response_message.model_dump()
            # response_message_dict["tool_call_id"] = tool_call_id

            # role: assistant (requesting tool call, set tool call ID)
            messages.append(
                # NOTE: we're recreating the message here
                # TODO should probably just overwrite the fields?
                Message.dict_to_message(
                    id=response_message_id,
                    agent_id=self.agent_state.id,
                    user_id=self.agent_state.created_by_id,
                    model=self.model,
                    openai_message_dict=response_message.model_dump(),
                )
            )  # extend conversation with assistant's reply
            self.logger.info(f"Function call message: {messages[-1]}")

            nonnull_content = False
            if response_message.content:
                # The content if then internal monologue, not chat
                self.interface.internal_monologue(response_message.content, msg_obj=messages[-1])
                # Flag to avoid printing a duplicate if inner thoughts get popped from the function call
                nonnull_content = True

            # Step 3: call the function
            # Note: the JSON response may not always be valid; be sure to handle errors
            function_call = (
                response_message.function_call if response_message.function_call is not None else response_message.tool_calls[0].function
            )
            function_name = function_call.name
            self.logger.info(f"Request to call function {function_name} with tool_call_id: {tool_call_id}")

            # Failure case 1: function name is wrong (not in agent_state.tools)
            target_letta_tool = None
            for t in self.agent_state.tools:
                if t.name == function_name:
                    # This force refreshes the target_letta_tool from the database
                    # We only do this on name match to confirm that the agent state contains a specific tool with the right name
                    target_letta_tool = ToolManager().get_tool_by_name(tool_name=function_name, actor=self.user)
                    break

            if not target_letta_tool:
                error_msg = f"No function named {function_name}"
                function_response = "None"  # more like "never ran?"
                messages = self._handle_function_error_response(
                    error_msg, tool_call_id, function_name, function_args, function_response, messages
                )
                return messages, False, True  # force a heartbeat to allow agent to handle error

            # Failure case 2: function name is OK, but function args are bad JSON
            try:
                raw_function_args = function_call.arguments
                function_args = parse_json(raw_function_args)
                if not isinstance(function_args, dict):
                    raise ValueError(f"Function arguments are not a dictionary: {function_args} (raw={raw_function_args})")
            except Exception as e:
                print(e)
                error_msg = f"Error parsing JSON for function '{function_name}' arguments: {function_call.arguments}"
                function_response = "None"  # more like "never ran?"
                messages = self._handle_function_error_response(
                    error_msg, tool_call_id, function_name, function_args, function_response, messages
                )
                return messages, False, True  # force a heartbeat to allow agent to handle error

            # Check if inner thoughts is in the function call arguments (possible apparently if you are using Azure)
            if "inner_thoughts" in function_args:
                response_message.content = function_args.pop("inner_thoughts")
            # The content if then internal monologue, not chat
            if response_message.content and not nonnull_content:
                self.interface.internal_monologue(response_message.content, msg_obj=messages[-1])

            # (Still parsing function args)
            # Handle requests for immediate heartbeat
            heartbeat_request = function_args.pop("request_heartbeat", None)

            # Edge case: heartbeat_request is returned as a stringified boolean, we will attempt to parse:
            if isinstance(heartbeat_request, str) and heartbeat_request.lower().strip() == "true":
                heartbeat_request = True

            if heartbeat_request is None:
                heartbeat_request = False

            if not isinstance(heartbeat_request, bool):
                self.logger.warning(
                    f"{CLI_WARNING_PREFIX}'request_heartbeat' arg parsed was not a bool or None, type={type(heartbeat_request)}, value={heartbeat_request}"
                )
                heartbeat_request = False

            # Failure case 3: function failed during execution
            # NOTE: the msg_obj associated with the "Running " message is the prior assistant message, not the function/tool role message
            #       this is because the function/tool role message is only created once the function/tool has executed/returned
            self.interface.function_message(f"Running {function_name}({function_args})", msg_obj=messages[-1])
            try:
                # handle tool execution (sandbox) and state updates
                log_telemetry(
                    self.logger, "_handle_ai_response execute tool start", function_name=function_name, function_args=function_args
                )
                log_event(
                    "tool_call_initiated",
                    attributes={
                        "function_name": function_name,
                        "target_letta_tool": target_letta_tool.model_dump(),
                        **{f"function_args.{k}": v for k, v in function_args.items()},
                    },
                )

                function_response, sandbox_run_result = self.execute_tool_and_persist_state(function_name, function_args, target_letta_tool)

                log_event(
                    "tool_call_ended",
                    attributes={
                        "function_response": function_response,
                        "sandbox_run_result": sandbox_run_result.model_dump() if sandbox_run_result else None,
                    },
                )
                log_telemetry(
                    self.logger, "_handle_ai_response execute tool finish", function_name=function_name, function_args=function_args
                )

                if sandbox_run_result and sandbox_run_result.status == "error":
                    tool_return = ToolReturn(
                        status=sandbox_run_result.status, stdout=sandbox_run_result.stdout, stderr=sandbox_run_result.stderr
                    )
                    messages = self._handle_function_error_response(
                        function_response,
                        tool_call_id,
                        function_name,
                        function_args,
                        function_response,
                        messages,
                        [tool_return],
                    )
                    return messages, False, True  # force a heartbeat to allow agent to handle error

                # handle trunction
                if function_name in ["conversation_search", "conversation_search_date", "archival_memory_search"]:
                    # with certain functions we rely on the paging mechanism to handle overflow
                    truncate = False
                else:
                    # but by default, we add a truncation safeguard to prevent bad functions from
                    # overflow the agent context window
                    truncate = True

                # get the function response limit
                return_char_limit = target_letta_tool.return_char_limit
                function_response_string = validate_function_response(
                    function_response, return_char_limit=return_char_limit, truncate=truncate
                )
                function_args.pop("self", None)
                function_response = package_function_response(True, function_response_string)
                function_failed = False
            except Exception as e:
                function_args.pop("self", None)
                # error_msg = f"Error calling function {function_name} with args {function_args}: {str(e)}"
                # Less detailed - don't provide full args, idea is that it should be in recent context so no need (just adds noise)
                error_msg = get_friendly_error_msg(function_name=function_name, exception_name=type(e).__name__, exception_message=str(e))
                error_msg_user = f"{error_msg}\n{traceback.format_exc()}"
                self.logger.error(error_msg_user)
                messages = self._handle_function_error_response(
                    error_msg,
                    tool_call_id,
                    function_name,
                    function_args,
                    function_response,
                    messages,
                    [ToolReturn(status="error", stderr=[error_msg_user])],
                    include_function_failed_message=True,
                )
                return messages, False, True  # force a heartbeat to allow agent to handle error

            # Step 4: check if function response is an error
            if function_response_string.startswith(ERROR_MESSAGE_PREFIX):
                error_msg = function_response_string
                tool_return = (
                    ToolReturn(
                        status=sandbox_run_result.status,
                        stdout=sandbox_run_result.stdout,
                        stderr=sandbox_run_result.stderr,
                    )
                    if sandbox_run_result
                    else None
                )
                messages = self._handle_function_error_response(
                    error_msg,
                    tool_call_id,
                    function_name,
                    function_args,
                    function_response,
                    messages,
                    [tool_return],
                    include_function_failed_message=True,
                )
                return messages, False, True  # force a heartbeat to allow agent to handle error

            # If no failures happened along the way: ...
            # Step 5: send the info on the function call and function response to GPT
            tool_return = (
                ToolReturn(
                    status=sandbox_run_result.status,
                    stdout=sandbox_run_result.stdout,
                    stderr=sandbox_run_result.stderr,
                )
                if sandbox_run_result
                else None
            )
            messages.append(
                Message.dict_to_message(
                    agent_id=self.agent_state.id,
                    user_id=self.agent_state.created_by_id,
                    model=self.model,
                    openai_message_dict={
                        "role": "tool",
                        "name": function_name,
                        "content": function_response,
                        "tool_call_id": tool_call_id,
                    },
                    tool_returns=[tool_return] if sandbox_run_result else None,
                )
            )  # extend conversation with function response
            self.interface.function_message(f"Ran {function_name}({function_args})", msg_obj=messages[-1])
            self.interface.function_message(f"Success: {function_response_string}", msg_obj=messages[-1])
            self.last_function_response = function_response

        else:
            # Standard non-function reply
            messages.append(
                Message.dict_to_message(
                    id=response_message_id,
                    agent_id=self.agent_state.id,
                    user_id=self.agent_state.created_by_id,
                    model=self.model,
                    openai_message_dict=response_message.model_dump(),
                )
            )  # extend conversation with assistant's reply
            self.interface.internal_monologue(response_message.content, msg_obj=messages[-1])
            heartbeat_request = False
            function_failed = False

        # rebuild memory
        # TODO: @charles please check this
        self.agent_state = self.agent_manager.rebuild_system_prompt(agent_id=self.agent_state.id, actor=self.user)

        # Update ToolRulesSolver state with last called function
        self.tool_rules_solver.update_tool_usage(function_name)
        # Update heartbeat request according to provided tool rules
        if self.tool_rules_solver.has_children_tools(function_name):
            heartbeat_request = True
        elif self.tool_rules_solver.is_terminal_tool(function_name):
            heartbeat_request = False

        # if continue tool rule, then  must request a heartbeat
        # TODO: dont even include heartbeats in the args
        if self.tool_rules_solver.is_continue_tool(function_name):
            heartbeat_request = True

        log_telemetry(self.logger, "_handle_ai_response finish")
        return messages, heartbeat_request, function_failed

    @trace_method
    def step(
        self,
        messages: Union[Message, List[Message]],
        # additional args
        chaining: bool = True,
        max_chaining_steps: Optional[int] = None,
        put_inner_thoughts_first: bool = True,
        **kwargs,
    ) -> LettaUsageStatistics:
        """Run Agent.step in a loop, handling chaining via heartbeat requests and function failures"""
        # Defensively clear the tool rules solver history
        # Usually this would be extraneous as Agent loop is re-loaded on every message send
        # But just to be safe
        self.tool_rules_solver.clear_tool_history()

        next_input_message = messages if isinstance(messages, list) else [messages]
        counter = 0
        total_usage = UsageStatistics()
        step_count = 0
        function_failed = False
        while True:
            kwargs["first_message"] = False
            kwargs["step_count"] = step_count
            kwargs["last_function_failed"] = function_failed
            step_response = self.inner_step(
                messages=next_input_message,
                put_inner_thoughts_first=put_inner_thoughts_first,
                **kwargs,
            )

            heartbeat_request = step_response.heartbeat_request
            function_failed = step_response.function_failed
            token_warning = step_response.in_context_memory_warning
            usage = step_response.usage

            step_count += 1
            total_usage += usage
            counter += 1
            self.interface.step_complete()

            # logger.debug("Saving agent state")
            # save updated state
            save_agent(self)

            # Chain stops
            if not chaining:
                self.logger.info("No chaining, stopping after one step")
                break
            elif max_chaining_steps is not None and counter > max_chaining_steps:
                self.logger.info(f"Hit max chaining steps, stopping after {counter} steps")
                break
            # Chain handlers
            elif token_warning and summarizer_settings.send_memory_warning_message:
                assert self.agent_state.created_by_id is not None
                next_input_message = Message.dict_to_message(
                    agent_id=self.agent_state.id,
                    user_id=self.agent_state.created_by_id,
                    model=self.model,
                    openai_message_dict={
                        "role": "user",  # TODO: change to system?
                        "content": get_token_limit_warning(),
                    },
                )
                continue  # always chain
            elif function_failed:
                assert self.agent_state.created_by_id is not None
                next_input_message = Message.dict_to_message(
                    agent_id=self.agent_state.id,
                    user_id=self.agent_state.created_by_id,
                    model=self.model,
                    openai_message_dict={
                        "role": "user",  # TODO: change to system?
                        "content": get_heartbeat(FUNC_FAILED_HEARTBEAT_MESSAGE),
                    },
                )
                continue  # always chain
            elif heartbeat_request:
                assert self.agent_state.created_by_id is not None
                next_input_message = Message.dict_to_message(
                    agent_id=self.agent_state.id,
                    user_id=self.agent_state.created_by_id,
                    model=self.model,
                    openai_message_dict={
                        "role": "user",  # TODO: change to system?
                        "content": get_heartbeat(REQ_HEARTBEAT_MESSAGE),
                    },
                )
                continue  # always chain
            # Letta no-op / yield
            else:
                break

        if self.agent_state.message_buffer_autoclear:
            self.agent_manager.trim_all_in_context_messages_except_system(self.agent_state.id, actor=self.user)

        return LettaUsageStatistics(**total_usage.model_dump(), step_count=step_count)

    def inner_step(
        self,
        messages: Union[Message, List[Message]],
        first_message: bool = False,
        first_message_retry_limit: int = FIRST_MESSAGE_ATTEMPTS,
        skip_verify: bool = False,
        stream: bool = False,  # TODO move to config?
        step_count: Optional[int] = None,
        metadata: Optional[dict] = None,
        summarize_attempt_count: int = 0,
        last_function_failed: bool = False,
        put_inner_thoughts_first: bool = True,
    ) -> AgentStepResponse:
        """Runs a single step in the agent loop (generates at most one LLM call)"""
        try:

            # Extract job_id from metadata if present
            job_id = metadata.get("job_id") if metadata else None

            # Step 0: update core memory
            # only pulling latest block data if shared memory is being used
            current_persisted_memory = Memory(
                blocks=[self.block_manager.get_block_by_id(block.id, actor=self.user) for block in self.agent_state.memory.get_blocks()]
            )  # read blocks from DB
            self.update_memory_if_changed(current_persisted_memory)

            # Step 1: add user message
            if isinstance(messages, Message):
                messages = [messages]

            if not all(isinstance(m, Message) for m in messages):
                raise ValueError(f"messages should be a Message or a list of Message, got {type(messages)}")

            in_context_messages = self.agent_manager.get_in_context_messages(agent_id=self.agent_state.id, actor=self.user)
            input_message_sequence = in_context_messages + messages

            if len(input_message_sequence) > 1 and input_message_sequence[-1].role != "user":
                self.logger.warning(f"{CLI_WARNING_PREFIX}Attempting to run ChatCompletion without user as the last message in the queue")

            # Step 2: send the conversation and available functions to the LLM
            response = self._get_ai_reply(
                message_sequence=input_message_sequence,
                first_message=first_message,
                stream=stream,
                step_count=step_count,
                last_function_failed=last_function_failed,
                put_inner_thoughts_first=put_inner_thoughts_first,
            )
            if not response:
                # EDGE CASE: Function call failed AND there's no tools left for agent to call -> return early
                return AgentStepResponse(
                    messages=input_message_sequence,
                    heartbeat_request=False,
                    function_failed=False,  # NOTE: this is different from other function fails. We force to return early
                    in_context_memory_warning=False,
                    usage=UsageStatistics(),
                )

            # Step 3: check if LLM wanted to call a function
            # (if yes) Step 4: call the function
            # (if yes) Step 5: send the info on the function call and function response to LLM
            response_message = response.choices[0].message

            response_message.model_copy()  # TODO why are we copying here?
            all_response_messages, heartbeat_request, function_failed = self._handle_ai_response(
                response_message,
                # TODO this is kind of hacky, find a better way to handle this
                # the only time we set up message creation ahead of time is when streaming is on
                response_message_id=response.id if stream else None,
            )

            # Step 6: extend the message history
            if len(messages) > 0:
                all_new_messages = messages + all_response_messages
            else:
                all_new_messages = all_response_messages

            if self.save_last_response:
                self.last_response_messages = all_response_messages

            # Check the memory pressure and potentially issue a memory pressure warning
            current_total_tokens = response.usage.total_tokens
            active_memory_warning = False

            # We can't do summarize logic properly if context_window is undefined
            if self.agent_state.llm_config.context_window is None:
                # Fallback if for some reason context_window is missing, just set to the default
                print(f"{CLI_WARNING_PREFIX}could not find context_window in config, setting to default {LLM_MAX_TOKENS['DEFAULT']}")
                print(f"{self.agent_state}")
                self.agent_state.llm_config.context_window = (
                    LLM_MAX_TOKENS[self.model] if (self.model is not None and self.model in LLM_MAX_TOKENS) else LLM_MAX_TOKENS["DEFAULT"]
                )

            if current_total_tokens > summarizer_settings.memory_warning_threshold * int(self.agent_state.llm_config.context_window):
                logger.warning(
                    f"{CLI_WARNING_PREFIX}last response total_tokens ({current_total_tokens}) > {summarizer_settings.memory_warning_threshold * int(self.agent_state.llm_config.context_window)}"
                )

                log_event(
                    name="memory_pressure_warning",
                    attributes={
                        "current_total_tokens": current_total_tokens,
                        "context_window_limit": self.agent_state.llm_config.context_window,
                    },
                )
                # Only deliver the alert if we haven't already (this period)
                if not self.agent_alerted_about_memory_pressure:
                    active_memory_warning = True
                    self.agent_alerted_about_memory_pressure = True  # it's up to the outer loop to handle this

            else:
                logger.info(
                    f"last response total_tokens ({current_total_tokens}) < {summarizer_settings.memory_warning_threshold * int(self.agent_state.llm_config.context_window)}"
                )

            # Log step - this must happen before messages are persisted
            step = self.step_manager.log_step(
                actor=self.user,
                agent_id=self.agent_state.id,
                provider_name=self.agent_state.llm_config.model_endpoint_type,
                model=self.agent_state.llm_config.model,
                model_endpoint=self.agent_state.llm_config.model_endpoint,
                context_window_limit=self.agent_state.llm_config.context_window,
                usage=response.usage,
                # TODO(@caren): Add full provider support - this line is a workaround for v0 BYOK feature
                provider_id=(
                    self.provider_manager.get_anthropic_override_provider_id()
                    if self.agent_state.llm_config.model_endpoint_type == "anthropic"
                    else None
                ),
                job_id=job_id,
            )
            for message in all_new_messages:
                message.step_id = step.id

            # Persisting into Messages
            self.agent_state = self.agent_manager.append_to_in_context_messages(
                all_new_messages, agent_id=self.agent_state.id, actor=self.user
            )
            if job_id:
                for message in all_new_messages:
                    self.job_manager.add_message_to_job(
                        job_id=job_id,
                        message_id=message.id,
                        actor=self.user,
                    )

            return AgentStepResponse(
                messages=all_new_messages,
                heartbeat_request=heartbeat_request,
                function_failed=function_failed,
                in_context_memory_warning=active_memory_warning,
                usage=response.usage,
            )

        except Exception as e:
            logger.error(f"step() failed\nmessages = {messages}\nerror = {e}")

            # If we got a context alert, try trimming the messages length, then try again
            if is_context_overflow_error(e):
                in_context_messages = self.agent_manager.get_in_context_messages(agent_id=self.agent_state.id, actor=self.user)

                # TODO: this is a patch to resolve immediate issues, should be removed once the summarizer is fixes
                if self.agent_state.message_buffer_autoclear:
                    # no calling the summarizer in this case
                    logger.error(
                        f"step() failed with an exception that looks like a context window overflow, but message buffer is set to autoclear, so skipping: '{str(e)}'"
                    )
                    raise e

                summarize_attempt_count += 1

                if summarize_attempt_count <= summarizer_settings.max_summarizer_retries:
                    logger.warning(
                        f"context window exceeded with limit {self.agent_state.llm_config.context_window}, attempting to summarize ({summarize_attempt_count}/{summarizer_settings.max_summarizer_retries}"
                    )
                    # A separate API call to run a summarizer
                    self.summarize_messages_inplace()

                    # Try step again
                    return self.inner_step(
                        messages=messages,
                        first_message=first_message,
                        first_message_retry_limit=first_message_retry_limit,
                        skip_verify=skip_verify,
                        stream=stream,
                        metadata=metadata,
                        summarize_attempt_count=summarize_attempt_count + 1,
                    )
                else:
                    err_msg = f"Ran summarizer {summarize_attempt_count - 1} times for agent id={self.agent_state.id}, but messages are still overflowing the context window."
                    token_counts = (get_token_counts_for_messages(in_context_messages),)
                    logger.error(err_msg)
                    logger.error(f"num_in_context_messages: {len(self.agent_state.message_ids)}")
                    logger.error(f"token_counts: {token_counts}")
                    raise ContextWindowExceededError(
                        err_msg,
                        details={
                            "num_in_context_messages": len(self.agent_state.message_ids),
                            "in_context_messages_text": [m.content for m in in_context_messages],
                            "token_counts": token_counts,
                        },
                    )

            else:
                logger.error(f"step() failed with an unrecognized exception: '{str(e)}'")
                traceback.print_exc()
                raise e

    def step_user_message(self, user_message_str: str, **kwargs) -> AgentStepResponse:
        """Takes a basic user message string, turns it into a stringified JSON with extra metadata, then sends it to the agent

        Example:
        -> user_message_str = 'hi'
        -> {'message': 'hi', 'type': 'user_message', ...}
        -> json.dumps(...)
        -> agent.step(messages=[Message(role='user', text=...)])
        """
        # Wrap with metadata, dumps to JSON
        assert user_message_str and isinstance(
            user_message_str, str
        ), f"user_message_str should be a non-empty string, got {type(user_message_str)}"
        user_message_json_str = package_user_message(user_message_str)

        # Validate JSON via save/load
        user_message = validate_json(user_message_json_str)
        cleaned_user_message_text, name = strip_name_field_from_user_message(user_message)

        # Turn into a dict
        openai_message_dict = {"role": "user", "content": cleaned_user_message_text, "name": name}

        # Create the associated Message object (in the database)
        assert self.agent_state.created_by_id is not None, "User ID is not set"
        user_message = Message.dict_to_message(
            agent_id=self.agent_state.id,
            user_id=self.agent_state.created_by_id,
            model=self.model,
            openai_message_dict=openai_message_dict,
            # created_at=timestamp,
        )

        return self.inner_step(messages=[user_message], **kwargs)

    def summarize_messages_inplace(self):
        in_context_messages = self.agent_manager.get_in_context_messages(agent_id=self.agent_state.id, actor=self.user)
        in_context_messages_openai = [m.to_openai_dict() for m in in_context_messages]
        in_context_messages_openai_no_system = in_context_messages_openai[1:]
        token_counts = get_token_counts_for_messages(in_context_messages)
        logger.info(f"System message token count={token_counts[0]}")
        logger.info(f"token_counts_no_system={token_counts[1:]}")

        if in_context_messages_openai[0]["role"] != "system":
            raise RuntimeError(f"in_context_messages_openai[0] should be system (instead got {in_context_messages_openai[0]})")

        # If at this point there's nothing to summarize, throw an error
        if len(in_context_messages_openai_no_system) == 0:
            raise ContextWindowExceededError(
                "Not enough messages to compress for summarization",
                details={
                    "num_candidate_messages": len(in_context_messages_openai_no_system),
                    "num_total_messages": len(in_context_messages_openai),
                },
            )

        cutoff = calculate_summarizer_cutoff(in_context_messages=in_context_messages, token_counts=token_counts, logger=logger)
        message_sequence_to_summarize = in_context_messages[1:cutoff]  # do NOT get rid of the system message
        logger.info(f"Attempting to summarize {len(message_sequence_to_summarize)} messages of {len(in_context_messages)}")

        # We can't do summarize logic properly if context_window is undefined
        if self.agent_state.llm_config.context_window is None:
            # Fallback if for some reason context_window is missing, just set to the default
            logger.warning(f"{CLI_WARNING_PREFIX}could not find context_window in config, setting to default {LLM_MAX_TOKENS['DEFAULT']}")
            self.agent_state.llm_config.context_window = (
                LLM_MAX_TOKENS[self.model] if (self.model is not None and self.model in LLM_MAX_TOKENS) else LLM_MAX_TOKENS["DEFAULT"]
            )

        summary = summarize_messages(agent_state=self.agent_state, message_sequence_to_summarize=message_sequence_to_summarize)
        logger.info(f"Got summary: {summary}")

        # Metadata that's useful for the agent to see
        all_time_message_count = self.message_manager.size(agent_id=self.agent_state.id, actor=self.user)
        remaining_message_count = 1 + len(in_context_messages) - cutoff  # System + remaining
        hidden_message_count = all_time_message_count - remaining_message_count
        summary_message_count = len(message_sequence_to_summarize)
        summary_message = package_summarize_message(summary, summary_message_count, hidden_message_count, all_time_message_count)
        logger.info(f"Packaged into message: {summary_message}")

        prior_len = len(in_context_messages_openai)
        self.agent_state = self.agent_manager.trim_all_in_context_messages_except_system(agent_id=self.agent_state.id, actor=self.user)
        packed_summary_message = {"role": "user", "content": summary_message}
        # Prepend the summary
        self.agent_state = self.agent_manager.prepend_to_in_context_messages(
            messages=[
                Message.dict_to_message(
                    agent_id=self.agent_state.id,
                    user_id=self.agent_state.created_by_id,
                    model=self.model,
                    openai_message_dict=packed_summary_message,
                )
            ],
            agent_id=self.agent_state.id,
            actor=self.user,
        )

        # reset alert
        self.agent_alerted_about_memory_pressure = False
        curr_in_context_messages = self.agent_manager.get_in_context_messages(agent_id=self.agent_state.id, actor=self.user)

        current_token_count = sum(get_token_counts_for_messages(curr_in_context_messages))
        logger.info(f"Ran summarizer, messages length {prior_len} -> {len(curr_in_context_messages)}")
        logger.info(f"Summarizer brought down total token count from {sum(token_counts)} -> {current_token_count}")
        log_event(
            name="summarization",
            attributes={
                "prior_length": prior_len,
                "current_length": len(curr_in_context_messages),
                "prior_token_count": sum(token_counts),
                "current_token_count": current_token_count,
                "context_window_limit": self.agent_state.llm_config.context_window,
            },
        )

    def add_function(self, function_name: str) -> str:
        # TODO: refactor
        raise NotImplementedError

    def remove_function(self, function_name: str) -> str:
        # TODO: refactor
        raise NotImplementedError

    def migrate_embedding(self, embedding_config: EmbeddingConfig):
        """Migrate the agent to a new embedding"""
        # TODO: archival memory

        # TODO: recall memory
        raise NotImplementedError()

    def get_context_window(self) -> ContextWindowOverview:
        """Get the context window of the agent"""

        system_prompt = self.agent_state.system  # TODO is this the current system or the initial system?
        num_tokens_system = count_tokens(system_prompt)
        core_memory = self.agent_state.memory.compile()
        num_tokens_core_memory = count_tokens(core_memory)

        # Grab the in-context messages
        # conversion of messages to OpenAI dict format, which is passed to the token counter
        in_context_messages = self.agent_manager.get_in_context_messages(agent_id=self.agent_state.id, actor=self.user)
        in_context_messages_openai = [m.to_openai_dict() for m in in_context_messages]

        # Check if there's a summary message in the message queue
        if (
            len(in_context_messages) > 1
            and in_context_messages[1].role == MessageRole.user
            and in_context_messages[1].content
            and len(in_context_messages[1].content) == 1
            and isinstance(in_context_messages[1].content[0], TextContent)
            # TODO remove hardcoding
            and "The following is a summary of the previous " in in_context_messages[1].content[0].text
        ):
            # Summary message exists
            text_content = in_context_messages[1].content[0].text
            assert text_content is not None
            summary_memory = text_content
            num_tokens_summary_memory = count_tokens(text_content)
            # with a summary message, the real messages start at index 2
            num_tokens_messages = (
                num_tokens_from_messages(messages=in_context_messages_openai[2:], model=self.model)
                if len(in_context_messages_openai) > 2
                else 0
            )

        else:
            summary_memory = None
            num_tokens_summary_memory = 0
            # with no summary message, the real messages start at index 1
            num_tokens_messages = (
                num_tokens_from_messages(messages=in_context_messages_openai[1:], model=self.model)
                if len(in_context_messages_openai) > 1
                else 0
            )

        agent_manager_passage_size = self.agent_manager.passage_size(actor=self.user, agent_id=self.agent_state.id)
        message_manager_size = self.message_manager.size(actor=self.user, agent_id=self.agent_state.id)
        external_memory_summary = compile_memory_metadata_block(
            memory_edit_timestamp=get_utc_time(),
            previous_message_count=self.message_manager.size(actor=self.user, agent_id=self.agent_state.id),
            archival_memory_size=self.agent_manager.passage_size(actor=self.user, agent_id=self.agent_state.id),
            recent_passages=self.agent_manager.list_passages(actor=self.user, agent_id=self.agent_state.id, ascending=False, limit=10),
        )
        num_tokens_external_memory_summary = count_tokens(external_memory_summary)

        # tokens taken up by function definitions
        agent_state_tool_jsons = [t.json_schema for t in self.agent_state.tools]
        if agent_state_tool_jsons:
            available_functions_definitions = [OpenAITool(type="function", function=f) for f in agent_state_tool_jsons]
            num_tokens_available_functions_definitions = num_tokens_from_functions(functions=agent_state_tool_jsons, model=self.model)
        else:
            available_functions_definitions = []
            num_tokens_available_functions_definitions = 0

        num_tokens_used_total = (
            num_tokens_system  # system prompt
            + num_tokens_available_functions_definitions  # function definitions
            + num_tokens_core_memory  # core memory
            + num_tokens_external_memory_summary  # metadata (statistics) about recall/archival
            + num_tokens_summary_memory  # summary of ongoing conversation
            + num_tokens_messages  # tokens taken by messages
        )
        assert isinstance(num_tokens_used_total, int)

        return ContextWindowOverview(
            # context window breakdown (in messages)
            num_messages=len(in_context_messages),
            num_archival_memory=agent_manager_passage_size,
            num_recall_memory=message_manager_size,
            num_tokens_external_memory_summary=num_tokens_external_memory_summary,
            external_memory_summary=external_memory_summary,
            # top-level information
            context_window_size_max=self.agent_state.llm_config.context_window,
            context_window_size_current=num_tokens_used_total,
            # context window breakdown (in tokens)
            num_tokens_system=num_tokens_system,
            system_prompt=system_prompt,
            num_tokens_core_memory=num_tokens_core_memory,
            core_memory=core_memory,
            num_tokens_summary_memory=num_tokens_summary_memory,
            summary_memory=summary_memory,
            num_tokens_messages=num_tokens_messages,
            messages=in_context_messages,
            # related to functions
            num_tokens_functions_definitions=num_tokens_available_functions_definitions,
            functions_definitions=available_functions_definitions,
        )

    def count_tokens(self) -> int:
        """Count the tokens in the current context window"""
        context_window_breakdown = self.get_context_window()
        return context_window_breakdown.context_window_size_current


def save_agent(agent: Agent):
    """Save agent to metadata store"""
    agent_state = agent.agent_state
    assert isinstance(agent_state.memory, Memory), f"Memory is not a Memory object: {type(agent_state.memory)}"

    # TODO: move this to agent manager
    # TODO: Completely strip out metadata
    # convert to persisted model
    agent_manager = AgentManager()
    update_agent = UpdateAgent(
        name=agent_state.name,
        tool_ids=[t.id for t in agent_state.tools],
        source_ids=[s.id for s in agent_state.sources],
        block_ids=[b.id for b in agent_state.memory.blocks],
        tags=agent_state.tags,
        system=agent_state.system,
        tool_rules=agent_state.tool_rules,
        llm_config=agent_state.llm_config,
        embedding_config=agent_state.embedding_config,
        message_ids=agent_state.message_ids,
        description=agent_state.description,
        metadata=agent_state.metadata,
        # TODO: Add this back in later
        # tool_exec_environment_variables=agent_state.get_agent_env_vars_as_dict(),
    )
    agent_manager.update_agent(agent_id=agent_state.id, agent_update=update_agent, actor=agent.user)


def strip_name_field_from_user_message(user_message_text: str) -> Tuple[str, Optional[str]]:
    """If 'name' exists in the JSON string, remove it and return the cleaned text + name value"""
    try:
        user_message_json = dict(json_loads(user_message_text))
        # Special handling for AutoGen messages with 'name' field
        # Treat 'name' as a special field
        # If it exists in the input message, elevate it to the 'message' level
        name = user_message_json.pop("name", None)
        clean_message = json_dumps(user_message_json)
        return clean_message, name

    except Exception as e:
        print(f"{CLI_WARNING_PREFIX}handling of 'name' field failed with: {e}")
        raise e


def validate_json(user_message_text: str) -> str:
    """Make sure that the user input message is valid JSON"""
    try:
        user_message_json = dict(json_loads(user_message_text))
        user_message_json_val = json_dumps(user_message_json)
        return user_message_json_val
    except Exception as e:
        print(f"{CLI_WARNING_PREFIX}couldn't parse user input message as JSON: {e}")
        raise e
