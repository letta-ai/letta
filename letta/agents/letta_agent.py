import asyncio
import json
import uuid
from typing import Any, AsyncGenerator, Dict, List, Optional, Tuple, Union

from openai import AsyncStream
from openai.types import CompletionUsage
from openai.types.chat import ChatCompletion, ChatCompletionChunk

from letta.agents.base_agent import BaseAgent
from letta.agents.helpers import _create_letta_response, _prepare_in_context_messages_async, generate_step_id
from letta.helpers import ToolRulesSolver
from letta.helpers.datetime_helpers import get_utc_timestamp_ns
from letta.helpers.tool_execution_helper import enable_strict_mode
from letta.interfaces.anthropic_streaming_interface import AnthropicStreamingInterface
from letta.interfaces.openai_streaming_interface import OpenAIStreamingInterface
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
from letta.schemas.openai.chat_completion_response import ToolCall, UsageStatistics
from letta.schemas.provider_trace import ProviderTraceCreate
from letta.schemas.usage import LettaUsageStatistics
from letta.schemas.user import User
from letta.server.rest_api.utils import create_letta_messages_from_llm_response
from letta.services.agent_manager import AgentManager
from letta.services.block_manager import BlockManager
from letta.services.message_manager import MessageManager
from letta.services.passage_manager import PassageManager
from letta.services.step_manager import NoopStepManager, StepManager
from letta.services.telemetry_manager import NoopTelemetryManager, TelemetryManager
from letta.services.tool_executor.tool_execution_manager import ToolExecutionManager
from letta.system import package_function_response
from letta.tracing import log_event, trace_method, tracer

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
        step_manager: StepManager = NoopStepManager(),
        telemetry_manager: TelemetryManager = NoopTelemetryManager(),
    ):
        super().__init__(agent_id=agent_id, openai_client=None, message_manager=message_manager, agent_manager=agent_manager, actor=actor)

        # TODO: Make this more general, factorable
        # Summarizer settings
        self.block_manager = block_manager
        self.passage_manager = passage_manager
        self.step_manager = step_manager
        self.telemetry_manager = telemetry_manager
        self.response_messages: List[Message] = []

        self.last_function_response = None

        # Cached archival memory/message size
        self.num_messages = 0
        self.num_archival_memories = 0

    @trace_method
    async def step(self, input_messages: List[MessageCreate], max_steps: int = 10, use_assistant_message: bool = True) -> LettaResponse:
        agent_state = await self.agent_manager.get_agent_by_id_async(
            agent_id=self.agent_id, include_relationships=["tools", "memory"], actor=self.actor
        )
        _, new_in_context_messages, usage = await self._step(agent_state=agent_state, input_messages=input_messages, max_steps=max_steps)
        return _create_letta_response(
            new_in_context_messages=new_in_context_messages, use_assistant_message=use_assistant_message, usage=usage
        )

    @trace_method
    async def step_stream_no_tokens(self, input_messages: List[MessageCreate], max_steps: int = 10, use_assistant_message: bool = True):
        agent_state = await self.agent_manager.get_agent_by_id_async(
            agent_id=self.agent_id, include_relationships=["tools", "memory"], actor=self.actor
        )
        current_in_context_messages, new_in_context_messages = await _prepare_in_context_messages_async(
            input_messages, agent_state, self.message_manager, self.actor
        )
        tool_rules_solver = ToolRulesSolver(agent_state.tool_rules)
        llm_client = LLMClient.create(
            provider_type=agent_state.llm_config.model_endpoint_type,
            put_inner_thoughts_first=True,
            actor=self.actor,
        )
        usage = LettaUsageStatistics()
        for _ in range(max_steps):
            step_id = generate_step_id()

            in_context_messages = await self._rebuild_memory_async(
                current_in_context_messages + new_in_context_messages,
                agent_state,
                num_messages=self.num_messages,
                num_archival_memories=self.num_archival_memories,
            )
            log_event("agent.stream_no_tokens.messages.refreshed")  # [1^]

            request_data = await self._create_llm_request_data_async(
                llm_client=llm_client,
                in_context_messages=in_context_messages,
                agent_state=agent_state,
                tool_rules_solver=tool_rules_solver,
                # TODO: pass in reasoning content
            )
            log_event("agent.stream_no_tokens.llm_request.created")  # [2^]

            try:
                response_data = await llm_client.request_async(request_data, agent_state.llm_config)
            except Exception as e:
                raise llm_client.handle_llm_error(e)
            log_event("agent.stream_no_tokens.llm_response.received")  # [3^]

            response = llm_client.convert_response_to_chat_completion(response_data, in_context_messages, agent_state.llm_config)

            # update usage
            # TODO: add run_id
            usage.step_count += 1
            usage.completion_tokens += response.usage.completion_tokens
            usage.prompt_tokens += response.usage.prompt_tokens
            usage.total_tokens += response.usage.total_tokens

            if not response.choices[0].message.tool_calls:
                # TODO: make into a real error
                raise ValueError("No tool calls found in response, model must make a tool call")
            tool_call = response.choices[0].message.tool_calls[0]
            if response.choices[0].message.reasoning_content:
                reasoning = [
                    ReasoningContent(
                        reasoning=response.choices[0].message.reasoning_content,
                        is_native=True,
                        signature=response.choices[0].message.reasoning_content_signature,
                    )
                ]
            else:
                reasoning = [TextContent(text=response.choices[0].message.content)]  # reasoning placed into content for legacy reasons

            persisted_messages, should_continue = await self._handle_ai_response(
                tool_call, agent_state, tool_rules_solver, response.usage, reasoning_content=reasoning
            )
            self.response_messages.extend(persisted_messages)
            new_in_context_messages.extend(persisted_messages)
            log_event("agent.stream_no_tokens.llm_response.processed")  # [4^]

            # Log LLM Trace
            await self.telemetry_manager.create_provider_trace_async(
                actor=self.actor,
                provider_trace_create=ProviderTraceCreate(
                    request_json=request_data,
                    response_json=response_data,
                    step_id=step_id,
                    organization_id=self.actor.organization_id,
                ),
            )

            # stream step
            # TODO: improve TTFT
            filter_user_messages = [m for m in persisted_messages if m.role != "user"]
            letta_messages = Message.to_letta_messages_from_list(
                filter_user_messages, use_assistant_message=use_assistant_message, reverse=False
            )
            for message in letta_messages:
                yield f"data: {message.model_dump_json()}\n\n"

            if not should_continue:
                break

        # Extend the in context message ids
        if not agent_state.message_buffer_autoclear:
            message_ids = [m.id for m in (current_in_context_messages + new_in_context_messages)]
            await self.agent_manager.set_in_context_messages_async(agent_id=self.agent_id, message_ids=message_ids, actor=self.actor)

        # Return back usage
        yield f"data: {usage.model_dump_json()}\n\n"

    async def _step(
        self, agent_state: AgentState, input_messages: List[MessageCreate], max_steps: int = 10
    ) -> Tuple[List[Message], List[Message], CompletionUsage]:
        """
        Carries out an invocation of the agent loop. In each step, the agent
            1. Rebuilds its memory
            2. Generates a request for the LLM
            3. Fetches a response from the LLM
            4. Processes the response
        """
        current_in_context_messages, new_in_context_messages = await _prepare_in_context_messages_async(
            input_messages, agent_state, self.message_manager, self.actor
        )
        tool_rules_solver = ToolRulesSolver(agent_state.tool_rules)
        llm_client = LLMClient.create(
            provider_type=agent_state.llm_config.model_endpoint_type,
            put_inner_thoughts_first=True,
            actor=self.actor,
        )
        usage = LettaUsageStatistics()
        for _ in range(max_steps):
            step_id = generate_step_id()

            in_context_messages = await self._rebuild_memory_async(
                current_in_context_messages + new_in_context_messages,
                agent_state,
                num_messages=self.num_messages,
                num_archival_memories=self.num_archival_memories,
            )
            log_event("agent.step.messages.refreshed")  # [1^]

            request_data = await self._create_llm_request_data_async(
                llm_client=llm_client,
                in_context_messages=in_context_messages,
                agent_state=agent_state,
                tool_rules_solver=tool_rules_solver,
                # TODO: pass in reasoning content
            )
            log_event("agent.step.llm_request.created")  # [2^]

            try:
                response_data = await llm_client.request_async(request_data, agent_state.llm_config)
            except Exception as e:
                raise llm_client.handle_llm_error(e)
            log_event("agent.step.llm_response.received")  # [3^]

            response = llm_client.convert_response_to_chat_completion(response_data, in_context_messages, agent_state.llm_config)

            # TODO: add run_id
            usage.step_count += 1
            usage.completion_tokens += response.usage.completion_tokens
            usage.prompt_tokens += response.usage.prompt_tokens
            usage.total_tokens += response.usage.total_tokens

            if not response.choices[0].message.tool_calls:
                # TODO: make into a real error
                raise ValueError("No tool calls found in response, model must make a tool call")
            tool_call = response.choices[0].message.tool_calls[0]
            if response.choices[0].message.reasoning_content:
                reasoning = [
                    ReasoningContent(
                        reasoning=response.choices[0].message.reasoning_content,
                        is_native=True,
                        signature=response.choices[0].message.reasoning_content_signature,
                    )
                ]
            else:
                reasoning = [TextContent(text=response.choices[0].message.content)]  # reasoning placed into content for legacy reasons

            persisted_messages, should_continue = await self._handle_ai_response(
                tool_call, agent_state, tool_rules_solver, response.usage, reasoning_content=reasoning, step_id=step_id
            )
            self.response_messages.extend(persisted_messages)
            new_in_context_messages.extend(persisted_messages)
            log_event("agent.step.llm_response.processed")  # [4^]

            # Log LLM Trace
            await self.telemetry_manager.create_provider_trace_async(
                actor=self.actor,
                provider_trace_create=ProviderTraceCreate(
                    request_json=request_data,
                    response_json=response_data,
                    step_id=step_id,
                    organization_id=self.actor.organization_id,
                ),
            )

            if not should_continue:
                break

        # Extend the in context message ids
        if not agent_state.message_buffer_autoclear:
            message_ids = [m.id for m in (current_in_context_messages + new_in_context_messages)]
            await self.agent_manager.set_in_context_messages_async(agent_id=self.agent_id, message_ids=message_ids, actor=self.actor)

        return current_in_context_messages, new_in_context_messages, usage

    @trace_method
    async def step_stream(
        self,
        input_messages: List[MessageCreate],
        max_steps: int = 10,
        use_assistant_message: bool = True,
        request_start_timestamp_ns: Optional[int] = None,
    ) -> AsyncGenerator[str, None]:
        """
        Carries out an invocation of the agent loop in a streaming fashion that yields partial tokens.
        Whenever we detect a tool call, we yield from _handle_ai_response as well. At each step, the agent
            1. Rebuilds its memory
            2. Generates a request for the LLM
            3. Fetches a response from the LLM
            4. Processes the response
        """
        agent_state = await self.agent_manager.get_agent_by_id_async(
            agent_id=self.agent_id, include_relationships=["tools", "memory"], actor=self.actor
        )
        current_in_context_messages, new_in_context_messages = await _prepare_in_context_messages_async(
            input_messages, agent_state, self.message_manager, self.actor
        )
        tool_rules_solver = ToolRulesSolver(agent_state.tool_rules)
        llm_client = LLMClient.create(
            provider_type=agent_state.llm_config.model_endpoint_type,
            put_inner_thoughts_first=True,
            actor=self.actor,
        )
        usage = LettaUsageStatistics()

        for _ in range(max_steps):
            step_id = generate_step_id()
            in_context_messages = await self._rebuild_memory_async(
                current_in_context_messages + new_in_context_messages,
                agent_state,
                num_messages=self.num_messages,
                num_archival_memories=self.num_archival_memories,
            )
            log_event("agent.step.messages.refreshed")  # [1^]

            request_data = await self._create_llm_request_data_async(
                llm_client=llm_client,
                in_context_messages=in_context_messages,
                agent_state=agent_state,
                tool_rules_solver=tool_rules_solver,
            )
            log_event("agent.stream.llm_request.created")  # [2^]

            try:
                stream = await llm_client.stream_async(request_data, agent_state.llm_config)
            except Exception as e:
                raise llm_client.handle_llm_error(e)
            log_event("agent.stream.llm_response.received")  # [3^]

            # TODO: THIS IS INCREDIBLY UGLY
            # TODO: THERE ARE MULTIPLE COPIES OF THE LLM_CONFIG EVERYWHERE THAT ARE GETTING MANIPULATED
            if agent_state.llm_config.model_endpoint_type == "anthropic":
                interface = AnthropicStreamingInterface(
                    use_assistant_message=use_assistant_message,
                    put_inner_thoughts_in_kwarg=agent_state.llm_config.put_inner_thoughts_in_kwargs,
                )
            elif agent_state.llm_config.model_endpoint_type == "openai":
                interface = OpenAIStreamingInterface(
                    use_assistant_message=use_assistant_message,
                    put_inner_thoughts_in_kwarg=agent_state.llm_config.put_inner_thoughts_in_kwargs,
                )
            else:
                raise ValueError(f"Streaming not supported for {agent_state.llm_config}")

            first_chunk, ttft_span = True, None
            if request_start_timestamp_ns is not None:
                ttft_span = tracer.start_span("time_to_first_token", start_time=request_start_timestamp_ns)
                ttft_span.set_attributes({f"llm_config.{k}": v for k, v in agent_state.llm_config.model_dump().items() if v is not None})

            async for chunk in interface.process(stream):
                # Measure time to first token
                if first_chunk and ttft_span is not None:
                    now = get_utc_timestamp_ns()
                    ttft_ns = now - request_start_timestamp_ns
                    ttft_span.add_event(name="time_to_first_token_ms", attributes={"ttft_ms": ttft_ns // 1_000_000})
                    ttft_span.end()
                    first_chunk = False

                yield f"data: {chunk.model_dump_json()}\n\n"

            # update usage
            usage.step_count += 1
            usage.completion_tokens += interface.output_tokens
            usage.prompt_tokens += interface.input_tokens
            usage.total_tokens += interface.input_tokens + interface.output_tokens

            # Process resulting stream content
            tool_call = interface.get_tool_call_object()
            reasoning_content = interface.get_reasoning_content()
            persisted_messages, should_continue = await self._handle_ai_response(
                tool_call,
                agent_state,
                tool_rules_solver,
                UsageStatistics(
                    completion_tokens=interface.output_tokens,
                    prompt_tokens=interface.input_tokens,
                    total_tokens=interface.input_tokens + interface.output_tokens,
                ),
                reasoning_content=reasoning_content,
                pre_computed_assistant_message_id=interface.letta_assistant_message_id,
                pre_computed_tool_message_id=interface.letta_tool_message_id,
                step_id=step_id,
            )
            self.response_messages.extend(persisted_messages)
            new_in_context_messages.extend(persisted_messages)

            # TODO (cliandy): the stream POST request span has ended at this point, we should tie this to the stream
            # log_event("agent.stream.llm_response.processed") # [4^]

            # Log LLM Trace
            # TODO (cliandy): we are piecing together the streamed response here. Content here does not match the actual response schema.
            await self.telemetry_manager.create_provider_trace_async(
                actor=self.actor,
                provider_trace_create=ProviderTraceCreate(
                    request_json=request_data,
                    response_json={
                        "content": {
                            "tool_call": tool_call.model_dump_json(),
                            "reasoning": [content.model_dump_json() for content in reasoning_content],
                        },
                        "id": interface.message_id,
                        "model": interface.model,
                        "role": "assistant",
                        # "stop_reason": "",
                        # "stop_sequence": None,
                        "type": "message",
                        "usage": {"input_tokens": interface.input_tokens, "output_tokens": interface.output_tokens},
                    },
                    step_id=step_id,
                    organization_id=self.actor.organization_id,
                ),
            )

            if not use_assistant_message or should_continue:
                tool_return = [msg for msg in persisted_messages if msg.role == "tool"][-1].to_letta_messages()[0]
                yield f"data: {tool_return.model_dump_json()}\n\n"

            if not should_continue:
                break

        # Extend the in context message ids
        if not agent_state.message_buffer_autoclear:
            message_ids = [m.id for m in (current_in_context_messages + new_in_context_messages)]
            await self.agent_manager.set_in_context_messages_async(agent_id=self.agent_id, message_ids=message_ids, actor=self.actor)

        # TODO: This may be out of sync, if in between steps users add files
        # NOTE (cliandy): temporary for now for particlar use cases.
        self.num_messages = await self.message_manager.size_async(actor=self.actor, agent_id=agent_state.id)
        self.num_archival_memories = await self.passage_manager.size_async(actor=self.actor, agent_id=agent_state.id)

        # TODO: Also yield out a letta usage stats SSE
        yield f"data: {usage.model_dump_json()}\n\n"
        yield f"data: {MessageStreamStatus.done.model_dump_json()}\n\n"

    @trace_method
    async def _create_llm_request_data_async(
        self,
        llm_client: LLMClientBase,
        in_context_messages: List[Message],
        agent_state: AgentState,
        tool_rules_solver: ToolRulesSolver,
    ) -> ChatCompletion | AsyncStream[ChatCompletionChunk]:
        self.num_messages = self.num_messages or (await self.message_manager.size_async(actor=self.actor, agent_id=agent_state.id))
        self.num_archival_memories = self.num_archival_memories or (
            await self.passage_manager.size_async(actor=self.actor, agent_id=agent_state.id)
        )
        in_context_messages = await self._rebuild_memory_async(
            in_context_messages, agent_state, num_messages=self.num_messages, num_archival_memories=self.num_archival_memories
        )

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
                ToolType.LETTA_BUILTIN,
            }
            or (t.tool_type == ToolType.EXTERNAL_COMPOSIO)
        ]

        # Mirror the sync agent loop: get allowed tools or allow all if none are allowed
        if self.last_function_response is None:
            self.last_function_response = await self._load_last_function_response_async()
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

        return llm_client.build_request_data(in_context_messages, agent_state.llm_config, allowed_tools, force_tool_call)

    @trace_method
    async def _handle_ai_response(
        self,
        tool_call: ToolCall,
        agent_state: AgentState,
        tool_rules_solver: ToolRulesSolver,
        usage: UsageStatistics,
        reasoning_content: Optional[List[Union[TextContent, ReasoningContent, RedactedReasoningContent, OmittedReasoningContent]]] = None,
        pre_computed_assistant_message_id: Optional[str] = None,
        pre_computed_tool_message_id: Optional[str] = None,
        step_id: str | None = None,
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
            assert isinstance(tool_args, dict), "tool_args must be a dict"
        except json.JSONDecodeError:
            tool_args = {}
        except AssertionError:
            tool_args = json.loads(tool_args)

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

        # 5a. Persist Steps to DB
        # Following agent loop to persist this before messages
        # TODO (cliandy): determine what should match old loop w/provider_id, job_id
        # TODO (cliandy): UsageStatistics and LettaUsageStatistics are used in many places, but are not the same.
        logged_step = await self.step_manager.log_step_async(
            actor=self.actor,
            agent_id=agent_state.id,
            provider_name=agent_state.llm_config.model_endpoint_type,
            provider_category=agent_state.llm_config.provider_category or "base",
            model=agent_state.llm_config.model,
            model_endpoint=agent_state.llm_config.model_endpoint,
            context_window_limit=agent_state.llm_config.context_window,
            usage=usage,
            provider_id=None,
            job_id=None,
            step_id=step_id,
        )

        # 5b. Persist Messages to DB
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
            step_id=logged_step.id if logged_step else None,  # TODO (cliandy): eventually move over other agent loops
        )
        persisted_messages = await self.message_manager.create_many_messages_async(tool_call_messages, actor=self.actor)
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
            tool_execution_manager = ToolExecutionManager(
                agent_state=agent_state,
                message_manager=self.message_manager,
                agent_manager=self.agent_manager,
                block_manager=self.block_manager,
                passage_manager=self.passage_manager,
                actor=self.actor,
            )
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

    @trace_method
    async def _load_last_function_response_async(self):
        """Load the last function response from message history"""
        in_context_messages = await self.agent_manager.get_in_context_messages_async(agent_id=self.agent_id, actor=self.actor)
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
