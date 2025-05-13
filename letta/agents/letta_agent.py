import asyncio
import json
import uuid
from typing import Any, AsyncGenerator, Dict, List, Optional, Tuple, Union

from openai import AsyncStream
from openai.types.chat import ChatCompletion, ChatCompletionChunk

from letta.agents.base_agent import BaseAgent
from letta.agents.helpers import _create_letta_response, _prepare_in_context_messages
from letta.helpers import ToolRulesSolver
from letta.helpers.tool_execution_helper import enable_strict_mode
from letta.interfaces.anthropic_streaming_interface import AnthropicStreamingInterface
from letta.llm_api.llm_client import LLMClient
from letta.llm_api.llm_client_base import LLMClientBase
from letta.local_llm.constants import INNER_THOUGHTS_KWARG
from letta.log import get_logger
from letta.orm.enums import ToolType
from letta.schemas.agent import AgentState
from letta.schemas.enums import MessageRole, MessageStreamStatus
from letta.schemas.letta_message import AssistantMessage
from letta.schemas.letta_message_content import OmittedReasoningContent, ReasoningContent, RedactedReasoningContent, TextContent
from letta.schemas.letta_response import LettaResponse
from letta.schemas.message import Message, MessageCreate
from letta.schemas.openai.chat_completion_response import ToolCall
from letta.schemas.user import User
from letta.server.rest_api.utils import create_letta_messages_from_llm_response
from letta.services.agent_manager import AgentManager
from letta.services.block_manager import BlockManager
from letta.services.message_manager import MessageManager
from letta.services.passage_manager import PassageManager
from letta.services.tool_executor.tool_execution_manager import ToolExecutionManager
from letta.settings import settings
from letta.system import package_function_response
from letta.tracing import log_event, trace_method

logger = get_logger(__name__)


class LettaAgent(BaseAgent):

    def __init__(
        self,
        agent_id: str,
        message_manager: MessageManager,
        agent_manager: AgentManager,
        block_manager: BlockManager,
        passage_manager: PassageManager,
        actor: User,
        use_assistant_message: bool = True,
    ):
        super().__init__(agent_id=agent_id, openai_client=None, message_manager=message_manager, agent_manager=agent_manager, actor=actor)

        # TODO: Make this more general, factorable
        # Summarizer settings
        self.block_manager = block_manager
        self.passage_manager = passage_manager
        self.use_assistant_message = use_assistant_message
        self.response_messages: List[Message] = []

        self.last_function_response = self._load_last_function_response()

        # Cached archival memory/message size
        self.num_messages = self.message_manager.size(actor=self.actor, agent_id=agent_id)
        self.num_archival_memories = self.passage_manager.size(actor=self.actor, agent_id=agent_id)

    @trace_method
    async def step(self, input_messages: List[MessageCreate], max_steps: int = 10) -> LettaResponse:
        agent_state = self.agent_manager.get_agent_by_id(self.agent_id, actor=self.actor)
        current_in_context_messages, new_in_context_messages = await self._step(
            agent_state=agent_state, input_messages=input_messages, max_steps=max_steps
        )
        return _create_letta_response(new_in_context_messages=new_in_context_messages, use_assistant_message=self.use_assistant_message)

    async def _step(
        self, agent_state: AgentState, input_messages: List[MessageCreate], max_steps: int = 10
    ) -> Tuple[List[Message], List[Message]]:
        current_in_context_messages, new_in_context_messages = _prepare_in_context_messages(
            input_messages, agent_state, self.message_manager, self.actor
        )
        tool_rules_solver = ToolRulesSolver(agent_state.tool_rules)
        llm_client = LLMClient.create(
            provider_type=agent_state.llm_config.model_endpoint_type,
            put_inner_thoughts_first=True,
            actor=self.actor,
        )
        for _ in range(max_steps):
            response = await self._get_ai_reply(
                llm_client=llm_client,
                in_context_messages=current_in_context_messages + new_in_context_messages,
                agent_state=agent_state,
                tool_rules_solver=tool_rules_solver,
                stream=False,
                # TODO: also pass in reasoning content
            )

            tool_call = response.choices[0].message.tool_calls[0]

            persisted_messages, should_continue = await self._handle_ai_response(tool_call, agent_state, tool_rules_solver)
            self.response_messages.extend(persisted_messages)
            new_in_context_messages.extend(persisted_messages)

            if not should_continue:
                break

        # Extend the in context message ids
        if not agent_state.message_buffer_autoclear:
            message_ids = [m.id for m in (current_in_context_messages + new_in_context_messages)]
            self.agent_manager.set_in_context_messages(agent_id=self.agent_id, message_ids=message_ids, actor=self.actor)

        return current_in_context_messages, new_in_context_messages

    @trace_method
    async def step_stream(
        self, input_messages: List[MessageCreate], max_steps: int = 10, use_assistant_message: bool = False
    ) -> AsyncGenerator[str, None]:
        """
        Main streaming loop that yields partial tokens.
        Whenever we detect a tool call, we yield from _handle_ai_response as well.
        """
        agent_state = self.agent_manager.get_agent_by_id(self.agent_id, actor=self.actor)
        current_in_context_messages, new_in_context_messages = _prepare_in_context_messages(
            input_messages, agent_state, self.message_manager, self.actor
        )
        tool_rules_solver = ToolRulesSolver(agent_state.tool_rules)
        llm_client = LLMClient.create(
            provider_type=agent_state.llm_config.model_endpoint_type,
            put_inner_thoughts_first=True,
            actor=self.actor,
        )

        for _ in range(max_steps):
            stream = await self._get_ai_reply(
                llm_client=llm_client,
                in_context_messages=current_in_context_messages + new_in_context_messages,
                agent_state=agent_state,
                tool_rules_solver=tool_rules_solver,
                stream=True,
            )

            # TODO: THIS IS INCREDIBLY UGLY
            # TODO: THERE ARE MULTIPLE COPIES OF THE LLM_CONFIG EVERYWHERE THAT ARE GETTING MANIPULATED
            interface = AnthropicStreamingInterface(
                use_assistant_message=use_assistant_message, put_inner_thoughts_in_kwarg=agent_state.llm_config.put_inner_thoughts_in_kwargs
            )
            async for chunk in interface.process(stream):
                yield f"data: {chunk.model_dump_json()}\n\n"

            # Process resulting stream content
            tool_call = interface.get_tool_call_object()
            reasoning_content = interface.get_reasoning_content()
            persisted_messages, should_continue = await self._handle_ai_response(
                tool_call,
                agent_state,
                tool_rules_solver,
                reasoning_content=reasoning_content,
                pre_computed_assistant_message_id=interface.letta_assistant_message_id,
                pre_computed_tool_message_id=interface.letta_tool_message_id,
            )
            self.response_messages.extend(persisted_messages)
            new_in_context_messages.extend(persisted_messages)

            if not should_continue:
                break

        # Extend the in context message ids
        if not agent_state.message_buffer_autoclear:
            message_ids = [m.id for m in (current_in_context_messages + new_in_context_messages)]
            self.agent_manager.set_in_context_messages(agent_id=self.agent_id, message_ids=message_ids, actor=self.actor)

        # TODO: This may be out of sync, if in between steps users add files
        # NOTE (cliandy): temporary for now for particlar use cases.
        self.num_messages = self.message_manager.size(actor=self.actor, agent_id=agent_state.id)
        self.num_archival_memories = self.passage_manager.size(actor=self.actor, agent_id=agent_state.id)

        # TODO: Also yield out a letta usage stats SSE

        yield f"data: {MessageStreamStatus.done.model_dump_json()}\n\n"

    @trace_method
    # When raising an error this doesn't show up
    async def _get_ai_reply(
        self,
        llm_client: LLMClientBase,
        in_context_messages: List[Message],
        agent_state: AgentState,
        tool_rules_solver: ToolRulesSolver,
        stream: bool,
    ) -> ChatCompletion | AsyncStream[ChatCompletionChunk]:
        if settings.experimental_enable_async_db_engine:
            in_context_messages = await self._rebuild_memory_async(
                in_context_messages, agent_state, num_messages=self.num_messages, num_archival_memories=self.num_archival_memories
            )
        else:
            if settings.experimental_skip_rebuild_memory and agent_state.llm_config.model_endpoint_type == "google_vertex":
                logger.info("Skipping memory rebuild")
            else:
                in_context_messages = self._rebuild_memory(in_context_messages, agent_state)

        tools = [
            t
            for t in agent_state.tools
            if t.tool_type
            in {
                ToolType.CUSTOM,
                ToolType.LETTA_CORE,
                ToolType.LETTA_MEMORY_CORE,
                ToolType.LETTA_MULTI_AGENT_CORE,
                ToolType.LETTA_SLEEPTIME_CORE,
                ToolType.LETTA_VOICE_SLEEPTIME_CORE,
            }
            or (t.tool_type == ToolType.LETTA_MULTI_AGENT_CORE and t.name == "send_message_to_agents_matching_tags")
            or (t.tool_type == ToolType.EXTERNAL_COMPOSIO)
        ]

        # Mirror the sync agent loop: get allowed tools or allow all if none are allowed
        valid_tool_names = tool_rules_solver.get_allowed_tool_names(
            available_tools=set([t.name for t in tools]),
            last_function_response=self.last_function_response,
        ) or list(set(t.name for t in tools))

        # TODO: Copied from legacy agent loop, so please be cautious
        # Set force tool
        force_tool_call = None
        if len(valid_tool_names) == 1:
            force_tool_call = valid_tool_names[0]

        allowed_tools = [enable_strict_mode(t.json_schema) for t in tools if t.name in set(valid_tool_names)]

        response = await llm_client.send_llm_request_async(
            messages=in_context_messages,
            llm_config=agent_state.llm_config,
            tools=allowed_tools,
            force_tool_call=force_tool_call,
            stream=stream,
        )

        return response

    @trace_method
    async def _handle_ai_response(
        self,
        tool_call: ToolCall,
        agent_state: AgentState,
        tool_rules_solver: ToolRulesSolver,
        reasoning_content: Optional[List[Union[TextContent, ReasoningContent, RedactedReasoningContent, OmittedReasoningContent]]] = None,
        pre_computed_assistant_message_id: Optional[str] = None,
        pre_computed_tool_message_id: Optional[str] = None,
    ) -> Tuple[List[Message], bool]:
        """
        Now that streaming is done, handle the final AI response.
        This might yield additional SSE tokens if we do stalling.
        At the end, set self._continue_execution accordingly.
        """
        tool_call_name = tool_call.function.name
        tool_call_args_str = tool_call.function.arguments

        try:
            tool_args = json.loads(tool_call_args_str)
        except json.JSONDecodeError:
            tool_args = {}

        # Get request heartbeats and coerce to bool
        request_heartbeat = tool_args.pop("request_heartbeat", False)
        # Pre-emptively pop out inner_thoughts
        tool_args.pop(INNER_THOUGHTS_KWARG, "")

        # So this is necessary, because sometimes non-structured outputs makes mistakes
        if not isinstance(request_heartbeat, bool):
            if isinstance(request_heartbeat, str):
                request_heartbeat = request_heartbeat.lower() == "true"
            else:
                request_heartbeat = bool(request_heartbeat)

        tool_call_id = tool_call.id or f"call_{uuid.uuid4().hex[:8]}"

        tool_result, success_flag = await self._execute_tool(
            tool_name=tool_call_name,
            tool_args=tool_args,
            agent_state=agent_state,
        )
        function_response = package_function_response(tool_result, success_flag)

        # 4. Register tool call with tool rule solver
        # Resolve whether or not to continue stepping
        continue_stepping = request_heartbeat
        tool_rules_solver.register_tool_call(tool_name=tool_call_name)
        if tool_rules_solver.is_terminal_tool(tool_name=tool_call_name):
            continue_stepping = False
        elif tool_rules_solver.has_children_tools(tool_name=tool_call_name):
            continue_stepping = True
        elif tool_rules_solver.is_continue_tool(tool_name=tool_call_name):
            continue_stepping = True

        # 5. Persist to DB
        tool_call_messages = create_letta_messages_from_llm_response(
            agent_id=agent_state.id,
            model=agent_state.llm_config.model,
            function_name=tool_call_name,
            function_arguments=tool_args,
            tool_call_id=tool_call_id,
            function_call_success=success_flag,
            function_response=tool_result,
            actor=self.actor,
            add_heartbeat_request_system_message=continue_stepping,
            reasoning_content=reasoning_content,
            pre_computed_assistant_message_id=pre_computed_assistant_message_id,
            pre_computed_tool_message_id=pre_computed_tool_message_id,
        )
        persisted_messages = self.message_manager.create_many_messages(tool_call_messages, actor=self.actor)
        self.last_function_response = function_response

        return persisted_messages, continue_stepping

    @trace_method
    async def _execute_tool(self, tool_name: str, tool_args: dict, agent_state: AgentState) -> Tuple[str, bool]:
        """
        Executes a tool and returns (result, success_flag).
        """
        # Special memory case
        target_tool = next((x for x in agent_state.tools if x.name == tool_name), None)
        if not target_tool:
            return f"Tool not found: {tool_name}", False

        # TODO: This temp. Move this logic and code to executors
        try:
            if target_tool.name == "send_message_to_agents_matching_tags" and target_tool.tool_type == ToolType.LETTA_MULTI_AGENT_CORE:
                log_event(name="start_send_message_to_agents_matching_tags", attributes=tool_args)
                results = await self._send_message_to_agents_matching_tags(**tool_args)
                log_event(name="finish_send_message_to_agents_matching_tags", attributes=tool_args)
                return json.dumps(results), True
            else:
                tool_execution_manager = ToolExecutionManager(agent_state=agent_state, actor=self.actor)
                # TODO: Integrate sandbox result
                log_event(name=f"start_{tool_name}_execution", attributes=tool_args)
                tool_execution_result = await tool_execution_manager.execute_tool_async(
                    function_name=tool_name, function_args=tool_args, tool=target_tool
                )
                log_event(name=f"finish_{tool_name}_execution", attributes=tool_args)
                return tool_execution_result.func_return, True
        except Exception as e:
            return f"Failed to call tool. Error: {e}", False

    @trace_method
    async def _send_message_to_agents_matching_tags(
        self, message: str, match_all: List[str], match_some: List[str]
    ) -> List[Dict[str, Any]]:
        # Find matching agents
        matching_agents = self.agent_manager.list_agents_matching_tags(actor=self.actor, match_all=match_all, match_some=match_some)
        if not matching_agents:
            return []

        async def process_agent(agent_state: AgentState, message: str) -> Dict[str, Any]:
            try:
                letta_agent = LettaAgent(
                    agent_id=agent_state.id,
                    message_manager=self.message_manager,
                    agent_manager=self.agent_manager,
                    block_manager=self.block_manager,
                    passage_manager=self.passage_manager,
                    actor=self.actor,
                    use_assistant_message=True,
                )

                augmented_message = (
                    "[Incoming message from external Letta agent - to reply to this message, "
                    "make sure to use the 'send_message' at the end, and the system will notify "
                    "the sender of your response] "
                    f"{message}"
                )

                letta_response = await letta_agent.step(
                    [MessageCreate(role=MessageRole.system, content=[TextContent(text=augmented_message)])]
                )
                messages = letta_response.messages

                send_message_content = [message.content for message in messages if isinstance(message, AssistantMessage)]

                return {
                    "agent_id": agent_state.id,
                    "agent_name": agent_state.name,
                    "response": send_message_content if send_message_content else ["<no response>"],
                }

            except Exception as e:
                return {
                    "agent_id": agent_state.id,
                    "agent_name": agent_state.name,
                    "error": str(e),
                    "type": type(e).__name__,
                }

        tasks = [asyncio.create_task(process_agent(agent_state=agent_state, message=message)) for agent_state in matching_agents]
        results = await asyncio.gather(*tasks)
        return results

    def _load_last_function_response(self):
        """Load the last function response from message history"""
        in_context_messages = self.agent_manager.get_in_context_messages(agent_id=self.agent_id, actor=self.actor)
        for msg in reversed(in_context_messages):
            if msg.role == MessageRole.tool and msg.content and len(msg.content) == 1 and isinstance(msg.content[0], TextContent):
                text_content = msg.content[0].text
                try:
                    response_json = json.loads(text_content)
                    if response_json.get("message"):
                        return response_json["message"]
                except (json.JSONDecodeError, KeyError):
                    raise ValueError(f"Invalid JSON format in message: {text_content}")
        return None
