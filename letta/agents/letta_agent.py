import asyncio
import json
import uuid
from typing import AsyncGenerator, Dict, List, Optional, Tuple, Union

from openai import AsyncStream
from openai.types.chat import ChatCompletionChunk

from letta.agents.base_agent import BaseAgent
from letta.agents.ephemeral_summary_agent import EphemeralSummaryAgent
from letta.agents.helpers import (
    _create_letta_response,
    _prepare_in_context_messages_async,
    _prepare_in_context_messages_no_persist_async,
    generate_step_id,
)
from letta.errors import ContextWindowExceededError
from letta.helpers import ToolRulesSolver
from letta.helpers.datetime_helpers import AsyncTimer, get_utc_timestamp_ns, ns_to_ms
from letta.helpers.tool_execution_helper import enable_strict_mode
from letta.interfaces.anthropic_streaming_interface import AnthropicStreamingInterface
from letta.interfaces.openai_streaming_interface import OpenAIStreamingInterface
from letta.llm_api.llm_client import LLMClient
from letta.llm_api.llm_client_base import LLMClientBase
from letta.local_llm.constants import INNER_THOUGHTS_KWARG
from letta.log import get_logger
from letta.orm.enums import ToolType
from letta.otel.context import get_ctx_attributes
from letta.otel.metric_registry import MetricRegistry
from letta.otel.tracing import log_event, trace_method, tracer
from letta.schemas.agent import AgentState
from letta.schemas.enums import MessageRole, MessageStreamStatus
from letta.schemas.letta_message import MessageType
from letta.schemas.letta_message_content import OmittedReasoningContent, ReasoningContent, RedactedReasoningContent, TextContent
from letta.schemas.letta_response import LettaResponse
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message, MessageCreate
from letta.schemas.openai.chat_completion_response import ToolCall, UsageStatistics
from letta.schemas.provider_trace import ProviderTraceCreate
from letta.schemas.usage import LettaUsageStatistics
from letta.schemas.user import User
from letta.server.rest_api.utils import create_letta_messages_from_llm_response
from letta.services.agent_manager import AgentManager
from letta.services.block_manager import BlockManager
from letta.services.helpers.tool_parser_helper import runtime_override_tool_json_schema
from letta.services.message_manager import MessageManager
from letta.services.passage_manager import PassageManager
from letta.services.step_manager import NoopStepManager, StepManager
from letta.services.summarizer.enums import SummarizationMode
from letta.services.summarizer.summarizer import Summarizer
from letta.services.telemetry_manager import NoopTelemetryManager, TelemetryManager
from letta.services.tool_executor.tool_execution_manager import ToolExecutionManager
from letta.settings import model_settings
from letta.system import package_function_response
from letta.types import JsonDict
from letta.utils import log_telemetry, validate_function_response

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
        summary_block_label: str = "conversation_summary",
        message_buffer_limit: int = 60,  # TODO: Make this configurable
        message_buffer_min: int = 15,  # TODO: Make this configurable
        enable_summarization: bool = True,  # TODO: Make this configurable
        max_summarization_retries: int = 3,  # TODO: Make this configurable
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
        self.num_messages = None
        self.num_archival_memories = None

        self.summarization_agent = None
        self.summary_block_label = summary_block_label
        self.max_summarization_retries = max_summarization_retries

        # TODO: Expand to more
        if enable_summarization and model_settings.openai_api_key:
            self.summarization_agent = EphemeralSummaryAgent(
                target_block_label=self.summary_block_label,
                agent_id=agent_id,
                block_manager=self.block_manager,
                message_manager=self.message_manager,
                agent_manager=self.agent_manager,
                actor=self.actor,
            )

        self.summarizer = Summarizer(
            mode=SummarizationMode.STATIC_MESSAGE_BUFFER,
            summarizer_agent=self.summarization_agent,
            # TODO: Make this configurable
            message_buffer_limit=message_buffer_limit,
            message_buffer_min=message_buffer_min,
        )

    @trace_method
    async def step(
        self,
        input_messages: List[MessageCreate],
        max_steps: int = 10,
        use_assistant_message: bool = True,
        request_start_timestamp_ns: Optional[int] = None,
        include_return_message_types: Optional[List[MessageType]] = None,
    ) -> LettaResponse:
        agent_state = await self.agent_manager.get_agent_by_id_async(
            agent_id=self.agent_id, include_relationships=["tools", "memory", "tool_exec_environment_variables"], actor=self.actor
        )
        _, new_in_context_messages, usage = await self._step(
            agent_state=agent_state,
            input_messages=input_messages,
            max_steps=max_steps,
            request_start_timestamp_ns=request_start_timestamp_ns,
        )
        return _create_letta_response(
            new_in_context_messages=new_in_context_messages,
            use_assistant_message=use_assistant_message,
            usage=usage,
            include_return_message_types=include_return_message_types,
        )

    @trace_method
    async def step_stream_no_tokens(
        self,
        input_messages: List[MessageCreate],
        max_steps: int = 10,
        use_assistant_message: bool = True,
        request_start_timestamp_ns: Optional[int] = None,
        include_return_message_types: Optional[List[MessageType]] = None,
    ):
        agent_state = await self.agent_manager.get_agent_by_id_async(
            agent_id=self.agent_id, include_relationships=["tools", "memory", "tool_exec_environment_variables"], actor=self.actor
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

        # span for request
        request_span = tracer.start_span("time_to_first_token", start_time=request_start_timestamp_ns)
        request_span.set_attributes({f"llm_config.{k}": v for k, v in agent_state.llm_config.model_dump().items() if v is not None})

        for _ in range(max_steps):
            step_id = generate_step_id()
            step_start = get_utc_timestamp_ns()
            agent_step_span = tracer.start_span("agent_step", start_time=step_start)
            agent_step_span.set_attributes({"step_id": step_id})

            request_data, response_data, current_in_context_messages, new_in_context_messages = await self._build_and_request_from_llm(
                current_in_context_messages,
                new_in_context_messages,
                agent_state,
                llm_client,
                tool_rules_solver,
            )
            in_context_messages = current_in_context_messages + new_in_context_messages

            log_event("agent.stream_no_tokens.llm_response.received")  # [3^]

            # log llm request time
            now = get_utc_timestamp_ns()
            llm_request_ns = now - step_start
            agent_step_span.add_event(name="llm_request_ms", attributes={"duration_ms": ns_to_ms(llm_request_ns)})

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
            elif response.choices[0].message.content:
                reasoning = [TextContent(text=response.choices[0].message.content)]  # reasoning placed into content for legacy reasons
            else:
                logger.info("No reasoning content found.")
                reasoning = None

            # log LLM request time
            now = get_utc_timestamp_ns()
            llm_request_ns = now - step_start
            agent_step_span.add_event(name="llm_request_ms", attributes={"duration_ms": ns_to_ms(llm_request_ns)})

            persisted_messages, should_continue = await self._handle_ai_response(
                tool_call,
                agent_state,
                tool_rules_solver,
                response.usage,
                reasoning_content=reasoning,
                agent_step_span=agent_step_span,
            )
            self.response_messages.extend(persisted_messages)
            new_in_context_messages.extend(persisted_messages)
            log_event("agent.stream_no_tokens.llm_response.processed")  # [4^]

            # log step time
            now = get_utc_timestamp_ns()
            step_ns = now - step_start
            agent_step_span.add_event(name="step_ms", attributes={"duration_ms": ns_to_ms(step_ns)})
            agent_step_span.end()

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
                if not include_return_message_types:
                    yield f"data: {message.model_dump_json()}\n\n"
                elif include_return_message_types and message.message_type in include_return_message_types:
                    yield f"data: {message.model_dump_json()}\n\n"

            if not should_continue:
                break

        # Extend the in context message ids
        if not agent_state.message_buffer_autoclear:
            await self._rebuild_context_window(
                in_context_messages=current_in_context_messages,
                new_letta_messages=new_in_context_messages,
                llm_config=agent_state.llm_config,
                total_tokens=usage.total_tokens,
                force=False,
            )

        # log request time
        if request_start_timestamp_ns:
            now = get_utc_timestamp_ns()
            request_ns = now - request_start_timestamp_ns
            request_span.add_event(name="letta_request_ms", attributes={"duration_ms": ns_to_ms(request_ns)})
        request_span.end()

        # Return back usage
        yield f"data: {usage.model_dump_json()}\n\n"
        yield f"data: {MessageStreamStatus.done.model_dump_json()}\n\n"

    async def _step(
        self,
        agent_state: AgentState,
        input_messages: List[MessageCreate],
        max_steps: int = 10,
        request_start_timestamp_ns: Optional[int] = None,
    ) -> Tuple[List[Message], List[Message], LettaUsageStatistics]:
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

        # span for request
        request_span = tracer.start_span("time_to_first_token")
        request_span.set_attributes({f"llm_config.{k}": v for k, v in agent_state.llm_config.model_dump().items() if v is not None})

        usage = LettaUsageStatistics()
        for _ in range(max_steps):
            step_id = generate_step_id()
            step_start = get_utc_timestamp_ns()
            agent_step_span = tracer.start_span("agent_step", start_time=step_start)
            agent_step_span.set_attributes({"step_id": step_id})

            request_data, response_data, current_in_context_messages, new_in_context_messages = await self._build_and_request_from_llm(
                current_in_context_messages, new_in_context_messages, agent_state, llm_client, tool_rules_solver
            )
            in_context_messages = current_in_context_messages + new_in_context_messages

            log_event("agent.step.llm_response.received")  # [3^]

            response = llm_client.convert_response_to_chat_completion(response_data, in_context_messages, agent_state.llm_config)

            # log LLM request time
            now = get_utc_timestamp_ns()
            llm_request_ns = now - step_start
            agent_step_span.add_event(name="llm_request_ms", attributes={"duration_ms": ns_to_ms(llm_request_ns)})

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
            elif response.choices[0].message.content:
                reasoning = [TextContent(text=response.choices[0].message.content)]  # reasoning placed into content for legacy reasons
            else:
                logger.info("No reasoning content found.")
                reasoning = None

            persisted_messages, should_continue = await self._handle_ai_response(
                tool_call,
                agent_state,
                tool_rules_solver,
                response.usage,
                reasoning_content=reasoning,
                step_id=step_id,
                agent_step_span=agent_step_span,
            )
            self.response_messages.extend(persisted_messages)
            new_in_context_messages.extend(persisted_messages)
            log_event("agent.step.llm_response.processed")  # [4^]

            # log step time
            now = get_utc_timestamp_ns()
            step_ns = now - step_start
            agent_step_span.add_event(name="step_ms", attributes={"duration_ms": ns_to_ms(step_ns)})
            agent_step_span.end()

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

        # log request time
        if request_start_timestamp_ns:
            now = get_utc_timestamp_ns()
            request_ns = now - request_start_timestamp_ns
            request_span.add_event(name="request_ms", attributes={"duration_ms": ns_to_ms(request_ns)})
        request_span.end()

        # Extend the in context message ids
        if not agent_state.message_buffer_autoclear:
            await self._rebuild_context_window(
                in_context_messages=current_in_context_messages,
                new_letta_messages=new_in_context_messages,
                llm_config=agent_state.llm_config,
                total_tokens=usage.total_tokens,
                force=False,
            )

        return current_in_context_messages, new_in_context_messages, usage

    @trace_method
    async def step_stream(
        self,
        input_messages: List[MessageCreate],
        max_steps: int = 10,
        use_assistant_message: bool = True,
        request_start_timestamp_ns: Optional[int] = None,
        include_return_message_types: Optional[List[MessageType]] = None,
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
            agent_id=self.agent_id, include_relationships=["tools", "memory", "tool_exec_environment_variables"], actor=self.actor
        )
        current_in_context_messages, new_in_context_messages = await _prepare_in_context_messages_no_persist_async(
            input_messages, agent_state, self.message_manager, self.actor
        )

        # Special strategy to lower TTFT
        # Delay persistence of the initial input message as much as possible
        persisted_input_messages = False
        initial_messages = new_in_context_messages

        tool_rules_solver = ToolRulesSolver(agent_state.tool_rules)
        llm_client = LLMClient.create(
            provider_type=agent_state.llm_config.model_endpoint_type,
            put_inner_thoughts_first=True,
            actor=self.actor,
        )
        usage = LettaUsageStatistics()
        first_chunk, request_span = True, None
        if request_start_timestamp_ns:
            request_span = tracer.start_span("time_to_first_token", start_time=request_start_timestamp_ns)
            request_span.set_attributes({f"llm_config.{k}": v for k, v in agent_state.llm_config.model_dump().items() if v is not None})

        provider_request_start_timestamp_ns = None
        for _ in range(max_steps):
            step_id = generate_step_id()
            step_start = get_utc_timestamp_ns()
            agent_step_span = tracer.start_span("agent_step", start_time=step_start)
            agent_step_span.set_attributes({"step_id": step_id})

            request_data, stream, current_in_context_messages, new_in_context_messages = await self._build_and_request_from_llm_streaming(
                first_chunk,
                agent_step_span,
                request_start_timestamp_ns,
                current_in_context_messages,
                new_in_context_messages,
                agent_state,
                llm_client,
                tool_rules_solver,
            )
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

            async for chunk in interface.process(
                stream, ttft_span=request_span, provider_request_start_timestamp_ns=provider_request_start_timestamp_ns
            ):
                # Measure time to first token
                if first_chunk and request_span is not None:
                    now = get_utc_timestamp_ns()
                    ttft_ns = now - request_start_timestamp_ns
                    request_span.add_event(name="time_to_first_token_ms", attributes={"ttft_ms": ns_to_ms(ttft_ns)})
                    first_chunk = False

                if include_return_message_types is None:
                    # return all data
                    yield f"data: {chunk.model_dump_json()}\n\n"
                elif include_return_message_types and chunk.message_type in include_return_message_types:
                    # filter down returned data
                    yield f"data: {chunk.model_dump_json()}\n\n"

            # update usage
            usage.step_count += 1
            usage.completion_tokens += interface.output_tokens
            usage.prompt_tokens += interface.input_tokens
            usage.total_tokens += interface.input_tokens + interface.output_tokens
            MetricRegistry().message_output_tokens.record(
                interface.output_tokens, dict(get_ctx_attributes(), **{"model.name": agent_state.llm_config.model})
            )

            # Persist input messages if not already
            # Special strategy to lower TTFT
            if not persisted_input_messages:
                await self.message_manager.create_many_messages_async(initial_messages, actor=self.actor)
                persisted_input_messages = True

            # log LLM request time
            now = get_utc_timestamp_ns()
            llm_request_ns = now - step_start
            agent_step_span.add_event(name="llm_request_ms", attributes={"duration_ms": ns_to_ms(llm_request_ns)})

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
                pre_computed_assistant_message_id=interface.letta_message_id,
                step_id=step_id,
                agent_step_span=agent_step_span,
            )
            self.response_messages.extend(persisted_messages)
            new_in_context_messages.extend(persisted_messages)

            # log total step time
            now = get_utc_timestamp_ns()
            step_ns = now - step_start
            agent_step_span.add_event(name="step_ms", attributes={"duration_ms": ns_to_ms(step_ns)})
            agent_step_span.end()

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

            tool_return = [msg for msg in persisted_messages if msg.role == "tool"][-1].to_letta_messages()[0]
            if not (use_assistant_message and tool_return.name == "send_message"):
                # Apply message type filtering if specified
                if include_return_message_types is None or tool_return.message_type in include_return_message_types:
                    yield f"data: {tool_return.model_dump_json()}\n\n"

            if not should_continue:
                break

        # Extend the in context message ids
        if not agent_state.message_buffer_autoclear:
            await self._rebuild_context_window(
                in_context_messages=current_in_context_messages,
                new_letta_messages=new_in_context_messages,
                llm_config=agent_state.llm_config,
                total_tokens=usage.total_tokens,
                force=False,
            )

        # log time of entire request
        if request_start_timestamp_ns:
            now = get_utc_timestamp_ns()
            request_ns = now - request_start_timestamp_ns
            request_span.add_event(name="letta_request_ms", attributes={"duration_ms": ns_to_ms(request_ns)})
        request_span.end()

        # TODO: Also yield out a letta usage stats SSE
        yield f"data: {usage.model_dump_json()}\n\n"
        yield f"data: {MessageStreamStatus.done.model_dump_json()}\n\n"

    async def _build_and_request_from_llm(
        self,
        current_in_context_messages: List[Message],
        new_in_context_messages: List[Message],
        agent_state: AgentState,
        llm_client: LLMClientBase,
        tool_rules_solver: ToolRulesSolver,
    ) -> Tuple[Dict, Dict, List[Message], List[Message]]:
        for attempt in range(self.max_summarization_retries + 1):
            try:
                log_event("agent.stream_no_tokens.messages.refreshed")
                # Create LLM request data
                request_data = await self._create_llm_request_data_async(
                    llm_client=llm_client,
                    in_context_messages=current_in_context_messages + new_in_context_messages,
                    agent_state=agent_state,
                    tool_rules_solver=tool_rules_solver,
                )
                log_event("agent.stream_no_tokens.llm_request.created")

                async with AsyncTimer() as timer:
                    response = await llm_client.request_async(request_data, agent_state.llm_config)
                MetricRegistry().llm_execution_time_ms_histogram.record(
                    timer.elapsed_ms,
                    dict(get_ctx_attributes(), **{"model.name": agent_state.llm_config.model}),
                )
                # Attempt LLM request
                return (
                    request_data,
                    response,
                    current_in_context_messages,
                    new_in_context_messages,
                )

            except Exception as e:
                if attempt == self.max_summarization_retries:
                    raise e

                # Handle the error and prepare for retry
                current_in_context_messages = await self._handle_llm_error(
                    e,
                    llm_client=llm_client,
                    in_context_messages=current_in_context_messages,
                    new_letta_messages=new_in_context_messages,
                    llm_config=agent_state.llm_config,
                    force=True,
                )
                new_in_context_messages = []
                log_event(f"agent.stream_no_tokens.retry_attempt.{attempt + 1}")

    async def _build_and_request_from_llm_streaming(
        self,
        first_chunk: bool,
        ttft_span: "Span",
        request_start_timestamp_ns: int,
        current_in_context_messages: List[Message],
        new_in_context_messages: List[Message],
        agent_state: AgentState,
        llm_client: LLMClientBase,
        tool_rules_solver: ToolRulesSolver,
    ) -> Tuple[Dict, AsyncStream[ChatCompletionChunk], List[Message], List[Message]]:
        for attempt in range(self.max_summarization_retries + 1):
            try:
                log_event("agent.stream_no_tokens.messages.refreshed")
                # Create LLM request data
                request_data = await self._create_llm_request_data_async(
                    llm_client=llm_client,
                    in_context_messages=current_in_context_messages + new_in_context_messages,
                    agent_state=agent_state,
                    tool_rules_solver=tool_rules_solver,
                )
                log_event("agent.stream.llm_request.created")  # [2^]

                if first_chunk and ttft_span is not None:
                    provider_request_start_timestamp_ns = get_utc_timestamp_ns()
                    provider_req_start_ns = provider_request_start_timestamp_ns - request_start_timestamp_ns
                    ttft_span.add_event(name="provider_req_start_ns", attributes={"provider_req_start_ms": ns_to_ms(provider_req_start_ns)})

                # Attempt LLM request
                return (
                    request_data,
                    await llm_client.stream_async(request_data, agent_state.llm_config),
                    current_in_context_messages,
                    new_in_context_messages,
                )

            except Exception as e:
                if attempt == self.max_summarization_retries:
                    raise e

                # Handle the error and prepare for retry
                current_in_context_messages = await self._handle_llm_error(
                    e,
                    llm_client=llm_client,
                    in_context_messages=current_in_context_messages,
                    new_letta_messages=new_in_context_messages,
                    llm_config=agent_state.llm_config,
                    force=True,
                )
                new_in_context_messages = []
                log_event(f"agent.stream_no_tokens.retry_attempt.{attempt + 1}")

    @trace_method
    async def _handle_llm_error(
        self,
        e: Exception,
        llm_client: LLMClientBase,
        in_context_messages: List[Message],
        new_letta_messages: List[Message],
        llm_config: LLMConfig,
        force: bool,
    ) -> List[Message]:
        if isinstance(e, ContextWindowExceededError):
            return await self._rebuild_context_window(
                in_context_messages=in_context_messages, new_letta_messages=new_letta_messages, llm_config=llm_config, force=force
            )
        else:
            raise llm_client.handle_llm_error(e)

    @trace_method
    async def _rebuild_context_window(
        self,
        in_context_messages: List[Message],
        new_letta_messages: List[Message],
        llm_config: LLMConfig,
        total_tokens: Optional[int] = None,
        force: bool = False,
    ) -> List[Message]:
        # If total tokens is reached, we truncate down
        # TODO: This can be broken by bad configs, e.g. lower bound too high, initial messages too fat, etc.
        if force or (total_tokens and total_tokens > llm_config.context_window):
            self.logger.warning(
                f"Total tokens {total_tokens} exceeds configured max tokens {llm_config.context_window}, forcefully clearing message history."
            )
            new_in_context_messages, updated = self.summarizer.summarize(
                in_context_messages=in_context_messages, new_letta_messages=new_letta_messages, force=True, clear=True
            )
        else:
            new_in_context_messages, updated = self.summarizer.summarize(
                in_context_messages=in_context_messages, new_letta_messages=new_letta_messages
            )
        await self.agent_manager.set_in_context_messages_async(
            agent_id=self.agent_id, message_ids=[m.id for m in new_in_context_messages], actor=self.actor
        )

        return new_in_context_messages

    @trace_method
    async def summarize_conversation_history(self) -> AgentState:
        agent_state = await self.agent_manager.get_agent_by_id_async(agent_id=self.agent_id, actor=self.actor)
        message_ids = agent_state.message_ids
        in_context_messages = await self.message_manager.get_messages_by_ids_async(message_ids=message_ids, actor=self.actor)
        new_in_context_messages, updated = self.summarizer.summarize(
            in_context_messages=in_context_messages, new_letta_messages=[], force=True
        )
        return await self.agent_manager.set_in_context_messages_async(
            agent_id=self.agent_id, message_ids=[m.id for m in new_in_context_messages], actor=self.actor
        )

    @trace_method
    async def _create_llm_request_data_async(
        self,
        llm_client: LLMClientBase,
        in_context_messages: List[Message],
        agent_state: AgentState,
        tool_rules_solver: ToolRulesSolver,
    ) -> dict:
        self.num_messages, self.num_archival_memories = await asyncio.gather(
            (
                self.message_manager.size_async(actor=self.actor, agent_id=agent_state.id)
                if self.num_messages is None
                else asyncio.sleep(0, result=self.num_messages)
            ),
            (
                self.passage_manager.agent_passage_size_async(actor=self.actor, agent_id=agent_state.id)
                if self.num_archival_memories is None
                else asyncio.sleep(0, result=self.num_archival_memories)
            ),
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
                ToolType.LETTA_FILES_CORE,
                ToolType.EXTERNAL_COMPOSIO,
                ToolType.EXTERNAL_MCP,
            }
        ]

        # Mirror the sync agent loop: get allowed tools or allow all if none are allowed
        if self.last_function_response is None:
            self.last_function_response = self._load_last_function_response(in_context_messages)
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
        allowed_tools = runtime_override_tool_json_schema(
            tool_list=allowed_tools, response_format=agent_state.response_format, request_heartbeat=True
        )

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
        step_id: str | None = None,
        new_in_context_messages: Optional[List[Message]] = None,
        agent_step_span: Optional["Span"] = None,
    ) -> Tuple[List[Message], bool]:
        """
        Now that streaming is done, handle the final AI response.
        This might yield additional SSE tokens if we do stalling.
        At the end, set self._continue_execution accordingly.
        """
        tool_call_name = tool_call.function.name
        tool_call_args_str = tool_call.function.arguments
        # Temp hack to gracefully handle parallel tool calling attempt, only take first one
        if "}{" in tool_call_args_str:
            tool_call_args_str = tool_call_args_str.split("}{", 1)[0] + "}"

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

        log_telemetry(
            self.logger,
            "_handle_ai_response execute tool start",
            tool_name=tool_call_name,
            tool_args=tool_args,
            tool_call_id=tool_call_id,
            request_heartbeat=request_heartbeat,
        )

        tool_execution_result = await self._execute_tool(
            tool_name=tool_call_name,
            tool_args=tool_args,
            agent_state=agent_state,
            agent_step_span=agent_step_span,
            step_id=step_id,
        )
        log_telemetry(
            self.logger, "_handle_ai_response execute tool finish", tool_execution_result=tool_execution_result, tool_call_id=tool_call_id
        )

        if tool_call_name in ["conversation_search", "conversation_search_date", "archival_memory_search"]:
            # with certain functions we rely on the paging mechanism to handle overflow
            truncate = False
        else:
            # but by default, we add a truncation safeguard to prevent bad functions from
            # overflow the agent context window
            truncate = True

        # get the function response limit
        target_tool = next((x for x in agent_state.tools if x.name == tool_call_name), None)
        return_char_limit = target_tool.return_char_limit
        function_response_string = validate_function_response(
            tool_execution_result.func_return, return_char_limit=return_char_limit, truncate=truncate
        )
        function_response = package_function_response(
            was_success=tool_execution_result.success_flag,
            response_string=function_response_string,
        )

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
            tool_execution_result=tool_execution_result,
            tool_call_id=tool_call_id,
            function_call_success=tool_execution_result.success_flag,
            function_response=function_response_string,
            actor=self.actor,
            add_heartbeat_request_system_message=continue_stepping,
            reasoning_content=reasoning_content,
            pre_computed_assistant_message_id=pre_computed_assistant_message_id,
            step_id=logged_step.id if logged_step else None,  # TODO (cliandy): eventually move over other agent loops
        )

        persisted_messages = await self.message_manager.create_many_messages_async(tool_call_messages, actor=self.actor)
        self.last_function_response = function_response

        return persisted_messages, continue_stepping

    @trace_method
    async def _execute_tool(
        self,
        tool_name: str,
        tool_args: JsonDict,
        agent_state: AgentState,
        agent_step_span: Optional["Span"] = None,
        step_id: str | None = None,
    ) -> "ToolExecutionResult":
        """
        Executes a tool and returns the ToolExecutionResult.
        """
        from letta.schemas.tool_execution_result import ToolExecutionResult

        # Special memory case
        target_tool = next((x for x in agent_state.tools if x.name == tool_name), None)
        if not target_tool:
            # TODO: fix this error message
            return ToolExecutionResult(
                func_return=f"Tool {tool_name} not found",
                status="error",
            )

        # TODO: This temp. Move this logic and code to executors

        if agent_step_span:
            start_time = get_utc_timestamp_ns()
            agent_step_span.add_event(name="tool_execution_started")

        sandbox_env_vars = {var.key: var.value for var in agent_state.tool_exec_environment_variables}
        tool_execution_manager = ToolExecutionManager(
            agent_state=agent_state,
            message_manager=self.message_manager,
            agent_manager=self.agent_manager,
            block_manager=self.block_manager,
            passage_manager=self.passage_manager,
            sandbox_env_vars=sandbox_env_vars,
            actor=self.actor,
        )
        # TODO: Integrate sandbox result
        log_event(name=f"start_{tool_name}_execution", attributes=tool_args)
        tool_execution_result = await tool_execution_manager.execute_tool_async(
            function_name=tool_name,
            function_args=tool_args,
            tool=target_tool,
            step_id=step_id,
        )
        if agent_step_span:
            end_time = get_utc_timestamp_ns()
            agent_step_span.add_event(
                name="tool_execution_completed",
                attributes={
                    "tool_name": target_tool.name,
                    "duration_ms": ns_to_ms((end_time - start_time)),
                    "success": tool_execution_result.success_flag,
                    "tool_type": target_tool.tool_type,
                    "tool_id": target_tool.id,
                },
            )
        log_event(name=f"finish_{tool_name}_execution", attributes=tool_execution_result.model_dump())
        return tool_execution_result

    @trace_method
    def _load_last_function_response(self, in_context_messages: List[Message]):
        """Load the last function response from message history"""
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
