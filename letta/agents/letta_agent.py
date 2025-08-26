import json
import uuid
from collections.abc import AsyncGenerator
from datetime import datetime
from typing import Optional, Union

from openai import AsyncStream
from openai.types.chat import ChatCompletionChunk
from opentelemetry.trace import Span

from letta.agents.base_agent import BaseAgent
from letta.agents.ephemeral_summary_agent import EphemeralSummaryAgent
from letta.agents.helpers import (
    _build_rule_violation_result,
    _create_letta_response,
    _pop_heartbeat,
    _prepare_in_context_messages_no_persist_async,
    _safe_load_tool_call_str,
    generate_step_id,
)
from letta.constants import DEFAULT_MAX_STEPS, NON_USER_MSG_PREFIX
from letta.errors import ContextWindowExceededError
from letta.helpers import ToolRulesSolver
from letta.helpers.datetime_helpers import AsyncTimer, get_utc_time, get_utc_timestamp_ns, ns_to_ms
from letta.helpers.reasoning_helper import scrub_inner_thoughts_from_messages
from letta.helpers.tool_execution_helper import enable_strict_mode
from letta.interfaces.anthropic_streaming_interface import AnthropicStreamingInterface
from letta.interfaces.openai_streaming_interface import OpenAIStreamingInterface
from letta.llm_api.llm_client import LLMClient
from letta.llm_api.llm_client_base import LLMClientBase
from letta.local_llm.constants import INNER_THOUGHTS_KWARG
from letta.log import get_logger
from letta.otel.context import get_ctx_attributes
from letta.otel.metric_registry import MetricRegistry
from letta.otel.tracing import log_event, trace_method, tracer
from letta.schemas.agent import AgentState, UpdateAgent
from letta.schemas.enums import JobStatus, MessageRole, ProviderType, StepStatus, ToolType
from letta.schemas.letta_message import MessageType
from letta.schemas.letta_message_content import OmittedReasoningContent, ReasoningContent, RedactedReasoningContent, TextContent
from letta.schemas.letta_response import LettaResponse
from letta.schemas.letta_stop_reason import LettaStopReason, StopReasonType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message, MessageCreate
from letta.schemas.openai.chat_completion_response import ToolCall, UsageStatistics
from letta.schemas.provider_trace import ProviderTraceCreate
from letta.schemas.step import StepProgression
from letta.schemas.step_metrics import StepMetrics
from letta.schemas.tool_execution_result import ToolExecutionResult
from letta.schemas.usage import LettaUsageStatistics
from letta.schemas.user import User
from letta.server.rest_api.utils import create_letta_messages_from_llm_response
from letta.services.agent_manager import AgentManager
from letta.services.block_manager import BlockManager
from letta.services.helpers.tool_parser_helper import runtime_override_tool_json_schema
from letta.services.job_manager import JobManager
from letta.services.message_manager import MessageManager
from letta.services.passage_manager import PassageManager
from letta.services.step_manager import NoopStepManager, StepManager
from letta.services.summarizer.enums import SummarizationMode
from letta.services.summarizer.summarizer import Summarizer
from letta.services.telemetry_manager import NoopTelemetryManager, TelemetryManager
from letta.services.tool_executor.tool_execution_manager import ToolExecutionManager
from letta.settings import model_settings, settings, summarizer_settings
from letta.system import package_function_response
from letta.types import JsonDict
from letta.utils import log_telemetry, validate_function_response

logger = get_logger(__name__)

DEFAULT_SUMMARY_BLOCK_LABEL = "conversation_summary"


class LettaAgent(BaseAgent):
    def __init__(
        self,
        agent_id: str,
        message_manager: MessageManager,
        agent_manager: AgentManager,
        block_manager: BlockManager,
        job_manager: JobManager,
        passage_manager: PassageManager,
        actor: User,
        step_manager: StepManager = NoopStepManager(),
        telemetry_manager: TelemetryManager = NoopTelemetryManager(),
        current_run_id: str | None = None,
        ## summarizer settings
        summarizer_mode: SummarizationMode = summarizer_settings.mode,
        # for static_buffer mode
        summary_block_label: str = DEFAULT_SUMMARY_BLOCK_LABEL,
        message_buffer_limit: int = summarizer_settings.message_buffer_limit,
        message_buffer_min: int = summarizer_settings.message_buffer_min,
        enable_summarization: bool = summarizer_settings.enable_summarization,
        max_summarization_retries: int = summarizer_settings.max_summarization_retries,
        # for partial_evict mode
        partial_evict_summarizer_percentage: float = summarizer_settings.partial_evict_summarizer_percentage,
    ):
        super().__init__(agent_id=agent_id, openai_client=None, message_manager=message_manager, agent_manager=agent_manager, actor=actor)

        # TODO: Make this more general, factorable
        # Summarizer settings
        self.block_manager = block_manager
        self.job_manager = job_manager
        self.passage_manager = passage_manager
        self.step_manager = step_manager
        self.telemetry_manager = telemetry_manager
        self.job_manager = job_manager
        self.current_run_id = current_run_id
        self.response_messages: list[Message] = []

        self.last_function_response = None

        # Cached archival memory/message size
        self.num_messages = None
        self.num_archival_memories = None

        self.summarization_agent = None
        self.summary_block_label = summary_block_label
        self.max_summarization_retries = max_summarization_retries
        self.logger = get_logger(agent_id)

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
            mode=summarizer_mode,
            # TODO consolidate to not use this, or push it into the Summarizer() class
            summarizer_agent=self.summarization_agent,
            # TODO: Make this configurable
            message_buffer_limit=message_buffer_limit,
            message_buffer_min=message_buffer_min,
            partial_evict_summarizer_percentage=partial_evict_summarizer_percentage,
            agent_manager=self.agent_manager,
            message_manager=self.message_manager,
            actor=self.actor,
            agent_id=self.agent_id,
        )

    async def _check_run_cancellation(self) -> bool:
        """
        Check if the current run associated with this agent execution has been cancelled.

        Returns:
            True if the run is cancelled, False otherwise (or if no run is associated)
        """
        if not self.job_manager or not self.current_run_id:
            return False

        try:
            job = await self.job_manager.get_job_by_id_async(job_id=self.current_run_id, actor=self.actor)
            return job.status == JobStatus.cancelled
        except Exception as e:
            # Log the error but don't fail the execution
            logger.warning(f"Failed to check job cancellation status for job {self.current_run_id}: {e}")
            return False

    @trace_method
    async def step(
        self,
        input_messages: list[MessageCreate],
        max_steps: int = DEFAULT_MAX_STEPS,
        run_id: str | None = None,
        use_assistant_message: bool = True,
        request_start_timestamp_ns: int | None = None,
        include_return_message_types: list[MessageType] | None = None,
        dry_run: bool = False,
    ) -> Union[LettaResponse, dict]:
        # TODO (cliandy): pass in run_id and use at send_message endpoints for all step functions
        agent_state = await self.agent_manager.get_agent_by_id_async(
            agent_id=self.agent_id,
            include_relationships=["tools", "memory", "tool_exec_environment_variables", "sources"],
            actor=self.actor,
        )
        result = await self._step(
            agent_state=agent_state,
            input_messages=input_messages,
            max_steps=max_steps,
            run_id=run_id,
            request_start_timestamp_ns=request_start_timestamp_ns,
            dry_run=dry_run,
        )

        # If dry run, return the request payload directly
        if dry_run:
            return result

        _, new_in_context_messages, stop_reason, usage = result
        return _create_letta_response(
            new_in_context_messages=new_in_context_messages,
            use_assistant_message=use_assistant_message,
            stop_reason=stop_reason,
            usage=usage,
            include_return_message_types=include_return_message_types,
        )

    @trace_method
    async def step_stream_no_tokens(
        self,
        input_messages: list[MessageCreate],
        max_steps: int = DEFAULT_MAX_STEPS,
        use_assistant_message: bool = True,
        request_start_timestamp_ns: int | None = None,
        include_return_message_types: list[MessageType] | None = None,
    ):
        agent_state = await self.agent_manager.get_agent_by_id_async(
            agent_id=self.agent_id,
            include_relationships=["tools", "memory", "tool_exec_environment_variables", "sources"],
            actor=self.actor,
        )
        current_in_context_messages, new_in_context_messages = await _prepare_in_context_messages_no_persist_async(
            input_messages, agent_state, self.message_manager, self.actor
        )
        initial_messages = new_in_context_messages
        tool_rules_solver = ToolRulesSolver(agent_state.tool_rules)
        llm_client = LLMClient.create(
            provider_type=agent_state.llm_config.model_endpoint_type,
            put_inner_thoughts_first=True,
            actor=self.actor,
        )
        stop_reason = None
        job_update_metadata = None
        usage = LettaUsageStatistics()

        # span for request
        request_span = tracer.start_span("time_to_first_token", start_time=request_start_timestamp_ns)
        request_span.set_attributes({f"llm_config.{k}": v for k, v in agent_state.llm_config.model_dump().items() if v is not None})

        for i in range(max_steps):
            # Check for job cancellation at the start of each step
            if await self._check_run_cancellation():
                stop_reason = LettaStopReason(stop_reason=StopReasonType.cancelled.value)
                logger.info(f"Agent execution cancelled for run {self.current_run_id}")
                yield f"data: {stop_reason.model_dump_json()}\n\n"
                break

            step_id = generate_step_id()
            step_start = get_utc_timestamp_ns()
            agent_step_span = tracer.start_span("agent_step", start_time=step_start)
            agent_step_span.set_attributes({"step_id": step_id})

            step_progression = StepProgression.START
            should_continue = False
            step_metrics = StepMetrics(id=step_id)  # Initialize metrics tracking

            # Create step early with PENDING status
            logged_step = await self.step_manager.log_step_async(
                actor=self.actor,
                agent_id=agent_state.id,
                provider_name=agent_state.llm_config.model_endpoint_type,
                provider_category=agent_state.llm_config.provider_category or "base",
                model=agent_state.llm_config.model,
                model_endpoint=agent_state.llm_config.model_endpoint,
                context_window_limit=agent_state.llm_config.context_window,
                usage=UsageStatistics(completion_tokens=0, prompt_tokens=0, total_tokens=0),
                provider_id=None,
                job_id=self.current_run_id if self.current_run_id else None,
                step_id=step_id,
                project_id=agent_state.project_id,
                status=StepStatus.PENDING,
            )
            # Only use step_id in messages if step was actually created
            effective_step_id = step_id if logged_step else None

            try:
                request_data, response_data, current_in_context_messages, new_in_context_messages, valid_tool_names = (
                    await self._build_and_request_from_llm(
                        current_in_context_messages,
                        new_in_context_messages,
                        agent_state,
                        llm_client,
                        tool_rules_solver,
                        agent_step_span,
                        step_metrics,
                    )
                )
                in_context_messages = current_in_context_messages + new_in_context_messages

                step_progression = StepProgression.RESPONSE_RECEIVED
                log_event("agent.stream_no_tokens.llm_response.received")  # [3^]

                response = llm_client.convert_response_to_chat_completion(response_data, in_context_messages, agent_state.llm_config)

                # update usage
                usage.step_count += 1
                usage.completion_tokens += response.usage.completion_tokens
                usage.prompt_tokens += response.usage.prompt_tokens
                usage.total_tokens += response.usage.total_tokens
                MetricRegistry().message_output_tokens.record(
                    response.usage.completion_tokens, dict(get_ctx_attributes(), **{"model.name": agent_state.llm_config.model})
                )

                if not response.choices[0].message.tool_calls:
                    stop_reason = LettaStopReason(stop_reason=StopReasonType.no_tool_call.value)
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
                elif response.choices[0].message.omitted_reasoning_content:
                    reasoning = [OmittedReasoningContent()]
                elif response.choices[0].message.content:
                    reasoning = [TextContent(text=response.choices[0].message.content)]  # reasoning placed into content for legacy reasons
                else:
                    self.logger.info("No reasoning content found.")
                    reasoning = None

                persisted_messages, should_continue, stop_reason = await self._handle_ai_response(
                    tool_call,
                    valid_tool_names,
                    agent_state,
                    tool_rules_solver,
                    response.usage,
                    reasoning_content=reasoning,
                    step_id=effective_step_id,
                    initial_messages=initial_messages,
                    agent_step_span=agent_step_span,
                    is_final_step=(i == max_steps - 1),
                    step_metrics=step_metrics,
                )
                step_progression = StepProgression.STEP_LOGGED

                # Update step with actual usage now that we have it (if step was created)
                if logged_step:
                    await self.step_manager.update_step_success_async(self.actor, step_id, response.usage, stop_reason)

                # TODO (cliandy): handle message contexts with larger refactor and dedupe logic
                new_message_idx = len(initial_messages) if initial_messages else 0
                self.response_messages.extend(persisted_messages[new_message_idx:])
                new_in_context_messages.extend(persisted_messages[new_message_idx:])
                initial_messages = None
                log_event("agent.stream_no_tokens.llm_response.processed")  # [4^]

                # log step time
                now = get_utc_timestamp_ns()
                step_ns = now - step_start
                agent_step_span.add_event(name="step_ms", attributes={"duration_ms": ns_to_ms(step_ns)})
                agent_step_span.end()

                # Log LLM Trace
                if settings.track_provider_trace:
                    await self.telemetry_manager.create_provider_trace_async(
                        actor=self.actor,
                        provider_trace_create=ProviderTraceCreate(
                            request_json=request_data,
                            response_json=response_data,
                            step_id=step_id,  # Use original step_id for telemetry
                            organization_id=self.actor.organization_id,
                        ),
                    )
                    step_progression = StepProgression.LOGGED_TRACE

                # stream step
                # TODO: improve TTFT
                filter_user_messages = [m for m in persisted_messages if m.role != "user"]
                letta_messages = Message.to_letta_messages_from_list(
                    filter_user_messages, use_assistant_message=use_assistant_message, reverse=False
                )

                for message in letta_messages:
                    if include_return_message_types is None or message.message_type in include_return_message_types:
                        yield f"data: {message.model_dump_json()}\n\n"

                MetricRegistry().step_execution_time_ms_histogram.record(get_utc_timestamp_ns() - step_start, get_ctx_attributes())
                step_progression = StepProgression.FINISHED

                # Record step metrics for successful completion
                if logged_step and step_metrics:
                    # Set the step_ns that was already calculated
                    step_metrics.step_ns = step_ns
                    await self._record_step_metrics(
                        step_id=step_id,
                        agent_state=agent_state,
                        step_metrics=step_metrics,
                    )

            except Exception as e:
                # Handle any unexpected errors during step processing
                self.logger.error(f"Error during step processing: {e}")
                job_update_metadata = {"error": str(e)}

                # This indicates we failed after we decided to stop stepping, which indicates a bug with our flow.
                if not stop_reason:
                    stop_reason = LettaStopReason(stop_reason=StopReasonType.error.value)
                elif stop_reason.stop_reason in (StopReasonType.end_turn, StopReasonType.max_steps, StopReasonType.tool_rule):
                    self.logger.error("Error occurred during step processing, with valid stop reason: %s", stop_reason.stop_reason)
                elif stop_reason.stop_reason not in (StopReasonType.no_tool_call, StopReasonType.invalid_tool_call):
                    raise ValueError(f"Invalid Stop Reason: {stop_reason}")

                # Send error stop reason to client and re-raise
                yield f"data: {stop_reason.model_dump_json()}\n\n", 500
                raise

            # Update step if it needs to be updated
            finally:
                if step_progression == StepProgression.FINISHED and should_continue:
                    continue

                self.logger.debug("Running cleanup for agent loop run: %s", self.current_run_id)
                self.logger.info("Running final update. Step Progression: %s", step_progression)
                try:
                    if step_progression == StepProgression.FINISHED and not should_continue:
                        # Successfully completed - update with final usage and stop reason
                        if stop_reason is None:
                            stop_reason = LettaStopReason(stop_reason=StopReasonType.end_turn.value)
                        # Note: step already updated with success status after _handle_ai_response
                        if logged_step:
                            await self.step_manager.update_step_stop_reason(self.actor, step_id, stop_reason.stop_reason)
                        break

                    # Handle error cases
                    if step_progression < StepProgression.STEP_LOGGED:
                        # Error occurred before step was fully logged
                        import traceback

                        if logged_step:
                            await self.step_manager.update_step_error_async(
                                actor=self.actor,
                                step_id=step_id,  # Use original step_id for telemetry
                                error_type=type(e).__name__ if "e" in locals() else "Unknown",
                                error_message=str(e) if "e" in locals() else "Unknown error",
                                error_traceback=traceback.format_exc(),
                                stop_reason=stop_reason,
                            )

                    if step_progression <= StepProgression.RESPONSE_RECEIVED:
                        # TODO (cliandy): persist response if we get it back
                        if settings.track_errored_messages and initial_messages:
                            for message in initial_messages:
                                message.is_err = True
                                message.step_id = effective_step_id
                            await self.message_manager.create_many_messages_async(initial_messages, actor=self.actor)
                    elif step_progression <= StepProgression.LOGGED_TRACE:
                        if stop_reason is None:
                            self.logger.error("Error in step after logging step")
                            stop_reason = LettaStopReason(stop_reason=StopReasonType.error.value)
                        if logged_step:
                            await self.step_manager.update_step_stop_reason(self.actor, step_id, stop_reason.stop_reason)
                    else:
                        self.logger.error("Invalid StepProgression value")

                    if settings.track_stop_reason:
                        await self._log_request(request_start_timestamp_ns, request_span, job_update_metadata, is_error=True)

                    # Record partial step metrics on failure (capture whatever timing data we have)
                    if logged_step and step_metrics and step_progression < StepProgression.FINISHED:
                        # Calculate total step time up to the failure point
                        step_metrics.step_ns = get_utc_timestamp_ns() - step_start
                        await self._record_step_metrics(
                            step_id=step_id,
                            agent_state=agent_state,
                            step_metrics=step_metrics,
                            job_id=locals().get("run_id", self.current_run_id),
                        )

                except Exception as e:
                    self.logger.error("Failed to update step: %s", e)

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

        await self._log_request(request_start_timestamp_ns, request_span, job_update_metadata, is_error=False)

        # Return back usage
        for finish_chunk in self.get_finish_chunks_for_stream(usage, stop_reason):
            yield f"data: {finish_chunk}\n\n"

    async def _step(
        self,
        agent_state: AgentState,
        input_messages: list[MessageCreate],
        max_steps: int = DEFAULT_MAX_STEPS,
        run_id: str | None = None,
        request_start_timestamp_ns: int | None = None,
        dry_run: bool = False,
    ) -> Union[tuple[list[Message], list[Message], LettaStopReason | None, LettaUsageStatistics], dict]:
        """
        Carries out an invocation of the agent loop. In each step, the agent
            1. Rebuilds its memory
            2. Generates a request for the LLM
            3. Fetches a response from the LLM
            4. Processes the response
        """
        current_in_context_messages, new_in_context_messages = await _prepare_in_context_messages_no_persist_async(
            input_messages, agent_state, self.message_manager, self.actor
        )
        initial_messages = new_in_context_messages
        tool_rules_solver = ToolRulesSolver(agent_state.tool_rules)
        llm_client = LLMClient.create(
            provider_type=agent_state.llm_config.model_endpoint_type,
            put_inner_thoughts_first=True,
            actor=self.actor,
        )

        # span for request
        request_span = tracer.start_span("time_to_first_token")
        request_span.set_attributes({f"llm_config.{k}": v for k, v in agent_state.llm_config.model_dump().items() if v is not None})

        stop_reason = None
        job_update_metadata = None
        usage = LettaUsageStatistics()
        for i in range(max_steps):
            # If dry run, build request data and return it without making LLM call
            if dry_run:
                request_data, valid_tool_names = await self._create_llm_request_data_async(
                    llm_client=llm_client,
                    in_context_messages=current_in_context_messages + new_in_context_messages,
                    agent_state=agent_state,
                    tool_rules_solver=tool_rules_solver,
                )
                return request_data

            # Check for job cancellation at the start of each step
            if await self._check_run_cancellation():
                stop_reason = LettaStopReason(stop_reason=StopReasonType.cancelled.value)
                logger.info(f"Agent execution cancelled for run {self.current_run_id}")
                break

            step_id = generate_step_id()
            step_start = get_utc_timestamp_ns()
            agent_step_span = tracer.start_span("agent_step", start_time=step_start)
            agent_step_span.set_attributes({"step_id": step_id})

            step_progression = StepProgression.START
            should_continue = False
            step_metrics = StepMetrics(id=step_id)  # Initialize metrics tracking

            # Create step early with PENDING status
            logged_step = await self.step_manager.log_step_async(
                actor=self.actor,
                agent_id=agent_state.id,
                provider_name=agent_state.llm_config.model_endpoint_type,
                provider_category=agent_state.llm_config.provider_category or "base",
                model=agent_state.llm_config.model,
                model_endpoint=agent_state.llm_config.model_endpoint,
                context_window_limit=agent_state.llm_config.context_window,
                usage=UsageStatistics(completion_tokens=0, prompt_tokens=0, total_tokens=0),
                provider_id=None,
                job_id=run_id if run_id else self.current_run_id,
                step_id=step_id,
                project_id=agent_state.project_id,
                status=StepStatus.PENDING,
            )
            # Only use step_id in messages if step was actually created
            effective_step_id = step_id if logged_step else None

            try:
                request_data, response_data, current_in_context_messages, new_in_context_messages, valid_tool_names = (
                    await self._build_and_request_from_llm(
                        current_in_context_messages,
                        new_in_context_messages,
                        agent_state,
                        llm_client,
                        tool_rules_solver,
                        agent_step_span,
                        step_metrics,
                    )
                )
                in_context_messages = current_in_context_messages + new_in_context_messages

                step_progression = StepProgression.RESPONSE_RECEIVED
                log_event("agent.step.llm_response.received")  # [3^]

                response = llm_client.convert_response_to_chat_completion(response_data, in_context_messages, agent_state.llm_config)

                usage.step_count += 1
                usage.completion_tokens += response.usage.completion_tokens
                usage.prompt_tokens += response.usage.prompt_tokens
                usage.total_tokens += response.usage.total_tokens
                usage.run_ids = [run_id] if run_id else None
                MetricRegistry().message_output_tokens.record(
                    response.usage.completion_tokens, dict(get_ctx_attributes(), **{"model.name": agent_state.llm_config.model})
                )

                if not response.choices[0].message.tool_calls:
                    stop_reason = LettaStopReason(stop_reason=StopReasonType.no_tool_call.value)
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
                elif response.choices[0].message.omitted_reasoning_content:
                    reasoning = [OmittedReasoningContent()]
                else:
                    self.logger.info("No reasoning content found.")
                    reasoning = None

                persisted_messages, should_continue, stop_reason = await self._handle_ai_response(
                    tool_call,
                    valid_tool_names,
                    agent_state,
                    tool_rules_solver,
                    response.usage,
                    reasoning_content=reasoning,
                    step_id=effective_step_id,
                    initial_messages=initial_messages,
                    agent_step_span=agent_step_span,
                    is_final_step=(i == max_steps - 1),
                    run_id=run_id,
                    step_metrics=step_metrics,
                )
                step_progression = StepProgression.STEP_LOGGED

                # Update step with actual usage now that we have it (if step was created)
                if logged_step:
                    await self.step_manager.update_step_success_async(self.actor, step_id, response.usage, stop_reason)

                new_message_idx = len(initial_messages) if initial_messages else 0
                self.response_messages.extend(persisted_messages[new_message_idx:])
                new_in_context_messages.extend(persisted_messages[new_message_idx:])

                initial_messages = None
                log_event("agent.step.llm_response.processed")  # [4^]

                # log step time
                now = get_utc_timestamp_ns()
                step_ns = now - step_start
                agent_step_span.add_event(name="step_ms", attributes={"duration_ms": ns_to_ms(step_ns)})
                agent_step_span.end()

                # Log LLM Trace
                if settings.track_provider_trace:
                    await self.telemetry_manager.create_provider_trace_async(
                        actor=self.actor,
                        provider_trace_create=ProviderTraceCreate(
                            request_json=request_data,
                            response_json=response_data,
                            step_id=step_id,  # Use original step_id for telemetry
                            organization_id=self.actor.organization_id,
                        ),
                    )
                    step_progression = StepProgression.LOGGED_TRACE

                MetricRegistry().step_execution_time_ms_histogram.record(get_utc_timestamp_ns() - step_start, get_ctx_attributes())
                step_progression = StepProgression.FINISHED

                # Record step metrics for successful completion
                if logged_step and step_metrics:
                    # Set the step_ns that was already calculated
                    step_metrics.step_ns = step_ns
                    await self._record_step_metrics(
                        step_id=step_id,
                        agent_state=agent_state,
                        step_metrics=step_metrics,
                        job_id=run_id if run_id else self.current_run_id,
                    )

            except Exception as e:
                # Handle any unexpected errors during step processing
                self.logger.error(f"Error during step processing: {e}")
                job_update_metadata = {"error": str(e)}

                # This indicates we failed after we decided to stop stepping, which indicates a bug with our flow.
                if not stop_reason:
                    stop_reason = LettaStopReason(stop_reason=StopReasonType.error.value)
                elif stop_reason.stop_reason in (StopReasonType.end_turn, StopReasonType.max_steps, StopReasonType.tool_rule):
                    self.logger.error("Error occurred during step processing, with valid stop reason: %s", stop_reason.stop_reason)
                elif stop_reason.stop_reason not in (StopReasonType.no_tool_call, StopReasonType.invalid_tool_call):
                    raise ValueError(f"Invalid Stop Reason: {stop_reason}")
                raise

                # Update step if it needs to be updated
            finally:
                if step_progression == StepProgression.FINISHED and should_continue:
                    continue

                self.logger.debug("Running cleanup for agent loop run: %s", self.current_run_id)
                self.logger.info("Running final update. Step Progression: %s", step_progression)
                try:
                    if step_progression == StepProgression.FINISHED and not should_continue:
                        # Successfully completed - update with final usage and stop reason
                        if stop_reason is None:
                            stop_reason = LettaStopReason(stop_reason=StopReasonType.end_turn.value)
                        if logged_step:
                            await self.step_manager.update_step_success_async(self.actor, step_id, usage, stop_reason)
                        break

                    # Handle error cases
                    if step_progression < StepProgression.STEP_LOGGED:
                        # Error occurred before step was fully logged
                        import traceback

                        if logged_step:
                            await self.step_manager.update_step_error_async(
                                actor=self.actor,
                                step_id=step_id,  # Use original step_id for telemetry
                                error_type=type(e).__name__ if "e" in locals() else "Unknown",
                                error_message=str(e) if "e" in locals() else "Unknown error",
                                error_traceback=traceback.format_exc(),
                                stop_reason=stop_reason,
                            )

                    if step_progression <= StepProgression.RESPONSE_RECEIVED:
                        # TODO (cliandy): persist response if we get it back
                        if settings.track_errored_messages and initial_messages:
                            for message in initial_messages:
                                message.is_err = True
                                message.step_id = effective_step_id
                            await self.message_manager.create_many_messages_async(initial_messages, actor=self.actor)
                    elif step_progression <= StepProgression.LOGGED_TRACE:
                        if stop_reason is None:
                            self.logger.error("Error in step after logging step")
                            stop_reason = LettaStopReason(stop_reason=StopReasonType.error.value)
                        if logged_step:
                            await self.step_manager.update_step_stop_reason(self.actor, step_id, stop_reason.stop_reason)
                    else:
                        self.logger.error("Invalid StepProgression value")

                    if settings.track_stop_reason:
                        await self._log_request(request_start_timestamp_ns, request_span, job_update_metadata, is_error=True)

                    # Record partial step metrics on failure (capture whatever timing data we have)
                    if logged_step and step_metrics and step_progression < StepProgression.FINISHED:
                        # Calculate total step time up to the failure point
                        step_metrics.step_ns = get_utc_timestamp_ns() - step_start
                        await self._record_step_metrics(
                            step_id=step_id,
                            agent_state=agent_state,
                            step_metrics=step_metrics,
                            job_id=locals().get("run_id", self.current_run_id),
                        )

                except Exception as e:
                    self.logger.error("Failed to update step: %s", e)

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

        await self._log_request(request_start_timestamp_ns, request_span, job_update_metadata, is_error=False)

        return current_in_context_messages, new_in_context_messages, stop_reason, usage

    async def _update_agent_last_run_metrics(self, completion_time: datetime, duration_ms: float) -> None:
        if not settings.track_last_agent_run:
            return
        try:
            await self.agent_manager.update_agent_async(
                agent_id=self.agent_id,
                agent_update=UpdateAgent(last_run_completion=completion_time, last_run_duration_ms=duration_ms),
                actor=self.actor,
            )
        except Exception as e:
            self.logger.error(f"Failed to update agent's last run metrics: {e}")

    @trace_method
    async def step_stream(
        self,
        input_messages: list[MessageCreate],
        max_steps: int = DEFAULT_MAX_STEPS,
        use_assistant_message: bool = True,
        request_start_timestamp_ns: int | None = None,
        include_return_message_types: list[MessageType] | None = None,
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
            agent_id=self.agent_id,
            include_relationships=["tools", "memory", "tool_exec_environment_variables", "sources"],
            actor=self.actor,
        )
        current_in_context_messages, new_in_context_messages = await _prepare_in_context_messages_no_persist_async(
            input_messages, agent_state, self.message_manager, self.actor
        )
        initial_messages = new_in_context_messages

        tool_rules_solver = ToolRulesSolver(agent_state.tool_rules)
        llm_client = LLMClient.create(
            provider_type=agent_state.llm_config.model_endpoint_type,
            put_inner_thoughts_first=True,
            actor=self.actor,
        )
        stop_reason = None
        job_update_metadata = None
        usage = LettaUsageStatistics()
        first_chunk, request_span = True, None
        if request_start_timestamp_ns:
            request_span = tracer.start_span("time_to_first_token", start_time=request_start_timestamp_ns)
            request_span.set_attributes({f"llm_config.{k}": v for k, v in agent_state.llm_config.model_dump().items() if v is not None})

        for i in range(max_steps):
            step_id = generate_step_id()
            # Check for job cancellation at the start of each step
            if await self._check_run_cancellation():
                stop_reason = LettaStopReason(stop_reason=StopReasonType.cancelled.value)
                logger.info(f"Agent execution cancelled for run {self.current_run_id}")
                yield f"data: {stop_reason.model_dump_json()}\n\n"
                break

            step_start = get_utc_timestamp_ns()
            agent_step_span = tracer.start_span("agent_step", start_time=step_start)
            agent_step_span.set_attributes({"step_id": step_id})

            step_progression = StepProgression.START
            should_continue = False
            step_metrics = StepMetrics(id=step_id)  # Initialize metrics tracking

            # Create step early with PENDING status
            logged_step = await self.step_manager.log_step_async(
                actor=self.actor,
                agent_id=agent_state.id,
                provider_name=agent_state.llm_config.model_endpoint_type,
                provider_category=agent_state.llm_config.provider_category or "base",
                model=agent_state.llm_config.model,
                model_endpoint=agent_state.llm_config.model_endpoint,
                context_window_limit=agent_state.llm_config.context_window,
                usage=UsageStatistics(completion_tokens=0, prompt_tokens=0, total_tokens=0),
                provider_id=None,
                job_id=self.current_run_id if self.current_run_id else None,
                step_id=step_id,
                project_id=agent_state.project_id,
                status=StepStatus.PENDING,
            )
            # Only use step_id in messages if step was actually created
            effective_step_id = step_id if logged_step else None

            try:
                (
                    request_data,
                    stream,
                    current_in_context_messages,
                    new_in_context_messages,
                    valid_tool_names,
                    provider_request_start_timestamp_ns,
                ) = await self._build_and_request_from_llm_streaming(
                    first_chunk,
                    agent_step_span,
                    request_start_timestamp_ns,
                    current_in_context_messages,
                    new_in_context_messages,
                    agent_state,
                    llm_client,
                    tool_rules_solver,
                )

                step_progression = StepProgression.STREAM_RECEIVED
                log_event("agent.stream.llm_response.received")  # [3^]

                # TODO: THIS IS INCREDIBLY UGLY
                # TODO: THERE ARE MULTIPLE COPIES OF THE LLM_CONFIG EVERYWHERE THAT ARE GETTING MANIPULATED
                if agent_state.llm_config.model_endpoint_type in [ProviderType.anthropic, ProviderType.bedrock]:
                    interface = AnthropicStreamingInterface(
                        use_assistant_message=use_assistant_message,
                        put_inner_thoughts_in_kwarg=agent_state.llm_config.put_inner_thoughts_in_kwargs,
                    )
                elif agent_state.llm_config.model_endpoint_type == ProviderType.openai:
                    interface = OpenAIStreamingInterface(
                        use_assistant_message=use_assistant_message,
                        is_openai_proxy=agent_state.llm_config.provider_name == "lmstudio_openai",
                        messages=current_in_context_messages + new_in_context_messages,
                        tools=request_data.get("tools", []),
                    )
                else:
                    raise ValueError(f"Streaming not supported for {agent_state.llm_config}")

                async for chunk in interface.process(
                    stream,
                    ttft_span=request_span,
                ):
                    # Measure TTFT (trace, metric, and db). This should be consolidated.
                    if first_chunk and request_span is not None:
                        now = get_utc_timestamp_ns()
                        ttft_ns = now - request_start_timestamp_ns

                        request_span.add_event(name="time_to_first_token_ms", attributes={"ttft_ms": ns_to_ms(ttft_ns)})
                        metric_attributes = get_ctx_attributes()
                        metric_attributes["model.name"] = agent_state.llm_config.model
                        MetricRegistry().ttft_ms_histogram.record(ns_to_ms(ttft_ns), metric_attributes)

                        if self.current_run_id and self.job_manager:
                            await self.job_manager.record_ttft(self.current_run_id, ttft_ns, self.actor)

                        first_chunk = False

                    if include_return_message_types is None or chunk.message_type in include_return_message_types:
                        # filter down returned data
                        yield f"data: {chunk.model_dump_json()}\n\n"

                stream_end_time_ns = get_utc_timestamp_ns()

                # Some providers that rely on the OpenAI client currently e.g. LMStudio don't get usage metrics back on the last streaming chunk, fall back to manual values
                if isinstance(interface, OpenAIStreamingInterface) and not interface.input_tokens and not interface.output_tokens:
                    logger.warning(
                        f"No token usage metrics received from OpenAI streaming interface for {agent_state.llm_config.model}, falling back to estimated values. Input tokens: {interface.fallback_input_tokens}, Output tokens: {interface.fallback_output_tokens}"
                    )
                    interface.input_tokens = interface.fallback_input_tokens
                    interface.output_tokens = interface.fallback_output_tokens

                usage.step_count += 1
                usage.completion_tokens += interface.output_tokens
                usage.prompt_tokens += interface.input_tokens
                usage.total_tokens += interface.input_tokens + interface.output_tokens
                MetricRegistry().message_output_tokens.record(
                    usage.completion_tokens, dict(get_ctx_attributes(), **{"model.name": agent_state.llm_config.model})
                )

                # log LLM request time
                llm_request_ns = stream_end_time_ns - provider_request_start_timestamp_ns
                step_metrics.llm_request_ns = llm_request_ns

                llm_request_ms = ns_to_ms(llm_request_ns)
                agent_step_span.add_event(name="llm_request_ms", attributes={"duration_ms": llm_request_ms})
                MetricRegistry().llm_execution_time_ms_histogram.record(
                    llm_request_ms,
                    dict(get_ctx_attributes(), **{"model.name": agent_state.llm_config.model}),
                )

                # Process resulting stream content
                try:
                    tool_call = interface.get_tool_call_object()
                except ValueError as e:
                    stop_reason = LettaStopReason(stop_reason=StopReasonType.no_tool_call.value)
                    raise e
                except Exception as e:
                    stop_reason = LettaStopReason(stop_reason=StopReasonType.invalid_tool_call.value)
                    raise e
                reasoning_content = interface.get_reasoning_content()
                persisted_messages, should_continue, stop_reason = await self._handle_ai_response(
                    tool_call,
                    valid_tool_names,
                    agent_state,
                    tool_rules_solver,
                    UsageStatistics(
                        completion_tokens=usage.completion_tokens,
                        prompt_tokens=usage.prompt_tokens,
                        total_tokens=usage.total_tokens,
                    ),
                    reasoning_content=reasoning_content,
                    pre_computed_assistant_message_id=interface.letta_message_id,
                    step_id=effective_step_id,
                    initial_messages=initial_messages,
                    agent_step_span=agent_step_span,
                    is_final_step=(i == max_steps - 1),
                    step_metrics=step_metrics,
                )
                step_progression = StepProgression.STEP_LOGGED

                # Update step with actual usage now that we have it (if step was created)
                if logged_step:
                    await self.step_manager.update_step_success_async(
                        self.actor,
                        step_id,
                        UsageStatistics(
                            completion_tokens=usage.completion_tokens,
                            prompt_tokens=usage.prompt_tokens,
                            total_tokens=usage.total_tokens,
                        ),
                        stop_reason,
                    )

                new_message_idx = len(initial_messages) if initial_messages else 0
                self.response_messages.extend(persisted_messages[new_message_idx:])
                new_in_context_messages.extend(persisted_messages[new_message_idx:])

                initial_messages = None

                # log total step time
                now = get_utc_timestamp_ns()
                step_ns = now - step_start
                agent_step_span.add_event(name="step_ms", attributes={"duration_ms": ns_to_ms(step_ns)})
                agent_step_span.end()

                # TODO (cliandy): the stream POST request span has ended at this point, we should tie this to the stream
                # log_event("agent.stream.llm_response.processed") # [4^]

                # Log LLM Trace
                # We are piecing together the streamed response here.
                # Content here does not match the actual response schema as streams come in chunks.
                if settings.track_provider_trace:
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
                                "usage": {
                                    "input_tokens": usage.prompt_tokens,
                                    "output_tokens": usage.completion_tokens,
                                },
                            },
                            step_id=step_id,  # Use original step_id for telemetry
                            organization_id=self.actor.organization_id,
                        ),
                    )
                    step_progression = StepProgression.LOGGED_TRACE

                # yields tool response as this is handled from Letta and not the response from the LLM provider
                tool_return = [msg for msg in persisted_messages if msg.role == "tool"][-1].to_letta_messages()[0]
                if not (use_assistant_message and tool_return.name == "send_message"):
                    # Apply message type filtering if specified
                    if include_return_message_types is None or tool_return.message_type in include_return_message_types:
                        yield f"data: {tool_return.model_dump_json()}\n\n"

                # TODO (cliandy): consolidate and expand with trace
                MetricRegistry().step_execution_time_ms_histogram.record(get_utc_timestamp_ns() - step_start, get_ctx_attributes())
                step_progression = StepProgression.FINISHED

                # Record step metrics for successful completion
                if logged_step and step_metrics:
                    try:
                        # Set the step_ns that was already calculated
                        step_metrics.step_ns = step_ns

                        # Get context attributes for project and template IDs
                        ctx_attrs = get_ctx_attributes()

                        await self._record_step_metrics(
                            step_id=step_id,
                            agent_state=agent_state,
                            step_metrics=step_metrics,
                            ctx_attrs=ctx_attrs,
                            job_id=self.current_run_id,
                        )
                    except Exception as metrics_error:
                        self.logger.warning(f"Failed to record step metrics: {metrics_error}")

            except Exception as e:
                # Handle any unexpected errors during step processing
                self.logger.error(f"Error during step processing: {e}")
                job_update_metadata = {"error": str(e)}

                # This indicates we failed after we decided to stop stepping, which indicates a bug with our flow.
                if not stop_reason:
                    stop_reason = LettaStopReason(stop_reason=StopReasonType.error.value)
                elif stop_reason.stop_reason in (StopReasonType.end_turn, StopReasonType.max_steps, StopReasonType.tool_rule):
                    self.logger.error("Error occurred during step processing, with valid stop reason: %s", stop_reason.stop_reason)
                elif stop_reason.stop_reason not in (StopReasonType.no_tool_call, StopReasonType.invalid_tool_call):
                    raise ValueError(f"Invalid Stop Reason: {stop_reason}")

                # Send error stop reason to client and re-raise with expected response code
                yield f"data: {stop_reason.model_dump_json()}\n\n", 500
                raise

            # Update step if it needs to be updated
            finally:
                if step_progression == StepProgression.FINISHED and should_continue:
                    continue

                self.logger.debug("Running cleanup for agent loop run: %s", self.current_run_id)
                self.logger.info("Running final update. Step Progression: %s", step_progression)
                try:
                    if step_progression == StepProgression.FINISHED and not should_continue:
                        # Successfully completed - update with final usage and stop reason
                        if stop_reason is None:
                            stop_reason = LettaStopReason(stop_reason=StopReasonType.end_turn.value)
                        # Note: step already updated with success status after _handle_ai_response
                        if logged_step:
                            await self.step_manager.update_step_stop_reason(self.actor, step_id, stop_reason.stop_reason)
                        break

                    # Handle error cases
                    if step_progression < StepProgression.STEP_LOGGED:
                        # Error occurred before step was fully logged
                        import traceback

                        if logged_step:
                            await self.step_manager.update_step_error_async(
                                actor=self.actor,
                                step_id=step_id,  # Use original step_id for telemetry
                                error_type=type(e).__name__ if "e" in locals() else "Unknown",
                                error_message=str(e) if "e" in locals() else "Unknown error",
                                error_traceback=traceback.format_exc(),
                                stop_reason=stop_reason,
                            )

                    if step_progression <= StepProgression.STREAM_RECEIVED:
                        if first_chunk and settings.track_errored_messages and initial_messages:
                            for message in initial_messages:
                                message.is_err = True
                                message.step_id = effective_step_id
                            await self.message_manager.create_many_messages_async(initial_messages, actor=self.actor)
                    elif step_progression <= StepProgression.LOGGED_TRACE:
                        if stop_reason is None:
                            self.logger.error("Error in step after logging step")
                            stop_reason = LettaStopReason(stop_reason=StopReasonType.error.value)
                        if logged_step:
                            await self.step_manager.update_step_stop_reason(self.actor, step_id, stop_reason.stop_reason)
                    else:
                        self.logger.error("Invalid StepProgression value")

                    # Do tracking for failure cases. Can consolidate with success conditions later.
                    if settings.track_stop_reason:
                        await self._log_request(request_start_timestamp_ns, request_span, job_update_metadata, is_error=True)

                    # Record partial step metrics on failure (capture whatever timing data we have)
                    if logged_step and step_metrics and step_progression < StepProgression.FINISHED:
                        try:
                            # Calculate total step time up to the failure point
                            step_metrics.step_ns = get_utc_timestamp_ns() - step_start

                            # Get context attributes for project and template IDs
                            ctx_attrs = get_ctx_attributes()

                            await self._record_step_metrics(
                                step_id=step_id,
                                agent_state=agent_state,
                                step_metrics=step_metrics,
                                ctx_attrs=ctx_attrs,
                                job_id=locals().get("run_id", self.current_run_id),
                            )
                        except Exception as metrics_error:
                            self.logger.warning(f"Failed to record step metrics: {metrics_error}")

                except Exception as e:
                    self.logger.error("Failed to update step: %s", e)

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

        await self._log_request(request_start_timestamp_ns, request_span, job_update_metadata, is_error=False)

        for finish_chunk in self.get_finish_chunks_for_stream(usage, stop_reason):
            yield f"data: {finish_chunk}\n\n"

    async def _log_request(
        self, request_start_timestamp_ns: int, request_span: "Span | None", job_update_metadata: dict | None, is_error: bool
    ):
        if request_start_timestamp_ns:
            now_ns, now = get_utc_timestamp_ns(), get_utc_time()
            duration_ns = now_ns - request_start_timestamp_ns
            if request_span:
                request_span.add_event(name="letta_request_ms", attributes={"duration_ms": ns_to_ms(duration_ns)})
            await self._update_agent_last_run_metrics(now, ns_to_ms(duration_ns))
            if settings.track_agent_run and self.current_run_id:
                await self.job_manager.record_response_duration(self.current_run_id, duration_ns, self.actor)
                await self.job_manager.safe_update_job_status_async(
                    job_id=self.current_run_id,
                    new_status=JobStatus.failed if is_error else JobStatus.completed,
                    actor=self.actor,
                    metadata=job_update_metadata,
                )
        if request_span:
            request_span.end()

    async def _record_step_metrics(
        self,
        *,
        step_id: str,
        agent_state: AgentState,
        step_metrics: StepMetrics,
        ctx_attrs: dict | None = None,
        job_id: str | None = None,
    ) -> None:
        try:
            attrs = ctx_attrs or get_ctx_attributes()
            await self.step_manager.record_step_metrics_async(
                actor=self.actor,
                step_id=step_id,
                llm_request_ns=step_metrics.llm_request_ns,
                tool_execution_ns=step_metrics.tool_execution_ns,
                step_ns=step_metrics.step_ns,
                agent_id=agent_state.id,
                job_id=job_id or self.current_run_id,
                project_id=attrs.get("project.id") or agent_state.project_id,
                template_id=attrs.get("template.id"),
                base_template_id=attrs.get("base_template.id"),
            )
        except Exception as metrics_error:
            self.logger.warning(f"Failed to record step metrics: {metrics_error}")

    # noinspection PyInconsistentReturns
    async def _build_and_request_from_llm(
        self,
        current_in_context_messages: list[Message],
        new_in_context_messages: list[Message],
        agent_state: AgentState,
        llm_client: LLMClientBase,
        tool_rules_solver: ToolRulesSolver,
        agent_step_span: "Span",
        step_metrics: StepMetrics,
    ) -> tuple[dict, dict, list[Message], list[Message], list[str]] | None:
        for attempt in range(self.max_summarization_retries + 1):
            try:
                log_event("agent.stream_no_tokens.messages.refreshed")
                # Create LLM request data
                request_data, valid_tool_names = await self._create_llm_request_data_async(
                    llm_client=llm_client,
                    in_context_messages=current_in_context_messages + new_in_context_messages,
                    agent_state=agent_state,
                    tool_rules_solver=tool_rules_solver,
                )
                log_event("agent.stream_no_tokens.llm_request.created")

                async with AsyncTimer() as timer:
                    # Attempt LLM request
                    response = await llm_client.request_async(request_data, agent_state.llm_config)

                # Track LLM request time
                step_metrics.llm_request_ns = int(timer.elapsed_ns)

                MetricRegistry().llm_execution_time_ms_histogram.record(
                    timer.elapsed_ms,
                    dict(get_ctx_attributes(), **{"model.name": agent_state.llm_config.model}),
                )
                agent_step_span.add_event(name="llm_request_ms", attributes={"duration_ms": timer.elapsed_ms})

                return request_data, response, current_in_context_messages, new_in_context_messages, valid_tool_names

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

    # noinspection PyInconsistentReturns
    async def _build_and_request_from_llm_streaming(
        self,
        first_chunk: bool,
        ttft_span: "Span",
        request_start_timestamp_ns: int,
        current_in_context_messages: list[Message],
        new_in_context_messages: list[Message],
        agent_state: AgentState,
        llm_client: LLMClientBase,
        tool_rules_solver: ToolRulesSolver,
    ) -> tuple[dict, AsyncStream[ChatCompletionChunk], list[Message], list[Message], list[str], int] | None:
        for attempt in range(self.max_summarization_retries + 1):
            try:
                log_event("agent.stream_no_tokens.messages.refreshed")
                # Create LLM request data
                request_data, valid_tool_names = await self._create_llm_request_data_async(
                    llm_client=llm_client,
                    in_context_messages=current_in_context_messages + new_in_context_messages,
                    agent_state=agent_state,
                    tool_rules_solver=tool_rules_solver,
                )
                log_event("agent.stream.llm_request.created")  # [2^]

                provider_request_start_timestamp_ns = get_utc_timestamp_ns()
                if first_chunk and ttft_span is not None:
                    request_start_to_provider_request_start_ns = provider_request_start_timestamp_ns - request_start_timestamp_ns
                    ttft_span.add_event(
                        name="request_start_to_provider_request_start_ns",
                        attributes={"request_start_to_provider_request_start_ns": ns_to_ms(request_start_to_provider_request_start_ns)},
                    )

                # Attempt LLM request
                return (
                    request_data,
                    await llm_client.stream_async(request_data, agent_state.llm_config),
                    current_in_context_messages,
                    new_in_context_messages,
                    valid_tool_names,
                    provider_request_start_timestamp_ns,
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
                new_in_context_messages: list[Message] = []
                log_event(f"agent.stream_no_tokens.retry_attempt.{attempt + 1}")

    @trace_method
    async def _handle_llm_error(
        self,
        e: Exception,
        llm_client: LLMClientBase,
        in_context_messages: list[Message],
        new_letta_messages: list[Message],
        llm_config: LLMConfig,
        force: bool,
    ) -> list[Message]:
        if isinstance(e, ContextWindowExceededError):
            return await self._rebuild_context_window(
                in_context_messages=in_context_messages, new_letta_messages=new_letta_messages, llm_config=llm_config, force=force
            )
        else:
            raise llm_client.handle_llm_error(e)

    @trace_method
    async def _rebuild_context_window(
        self,
        in_context_messages: list[Message],
        new_letta_messages: list[Message],
        llm_config: LLMConfig,
        total_tokens: int | None = None,
        force: bool = False,
    ) -> list[Message]:
        # If total tokens is reached, we truncate down
        # TODO: This can be broken by bad configs, e.g. lower bound too high, initial messages too fat, etc.
        # TODO: `force` and `clear` seem to no longer be used, we should remove
        if force or (total_tokens and total_tokens > llm_config.context_window):
            self.logger.warning(
                f"Total tokens {total_tokens} exceeds configured max tokens {llm_config.context_window}, forcefully clearing message history."
            )
            new_in_context_messages, updated = await self.summarizer.summarize(
                in_context_messages=in_context_messages,
                new_letta_messages=new_letta_messages,
                force=True,
                clear=True,
            )
        else:
            # NOTE (Sarah): Seems like this is doing nothing?
            self.logger.info(
                f"Total tokens {total_tokens} does not exceed configured max tokens {llm_config.context_window}, passing summarizing w/o force."
            )
            new_in_context_messages, updated = await self.summarizer.summarize(
                in_context_messages=in_context_messages,
                new_letta_messages=new_letta_messages,
            )
        await self.agent_manager.update_message_ids_async(
            agent_id=self.agent_id,
            message_ids=[m.id for m in new_in_context_messages],
            actor=self.actor,
        )

        return new_in_context_messages

    @trace_method
    async def summarize_conversation_history(self) -> None:
        """Called when the developer explicitly triggers compaction via the API"""
        agent_state = await self.agent_manager.get_agent_by_id_async(agent_id=self.agent_id, actor=self.actor)
        message_ids = agent_state.message_ids
        in_context_messages = await self.message_manager.get_messages_by_ids_async(message_ids=message_ids, actor=self.actor)
        new_in_context_messages, updated = await self.summarizer.summarize(
            in_context_messages=in_context_messages, new_letta_messages=[], force=True
        )
        return await self.agent_manager.update_message_ids_async(
            agent_id=self.agent_id, message_ids=[m.id for m in new_in_context_messages], actor=self.actor
        )

    @trace_method
    async def _create_llm_request_data_async(
        self,
        llm_client: LLMClientBase,
        in_context_messages: list[Message],
        agent_state: AgentState,
        tool_rules_solver: ToolRulesSolver,
    ) -> tuple[dict, list[str]]:
        if not self.num_messages:
            self.num_messages = await self.message_manager.size_async(
                agent_id=agent_state.id,
                actor=self.actor,
            )
        if not self.num_archival_memories:
            self.num_archival_memories = await self.passage_manager.agent_passage_size_async(
                agent_id=agent_state.id,
                actor=self.actor,
            )

        in_context_messages = await self._rebuild_memory_async(
            in_context_messages,
            agent_state,
            num_messages=self.num_messages,
            num_archival_memories=self.num_archival_memories,
            tool_rules_solver=tool_rules_solver,
        )

        # scrub inner thoughts from messages if reasoning is completely disabled
        in_context_messages = scrub_inner_thoughts_from_messages(in_context_messages, agent_state.llm_config)

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
        # Extract terminal tool names from tool rules
        terminal_tool_names = {rule.tool_name for rule in tool_rules_solver.terminal_tool_rules}
        allowed_tools = runtime_override_tool_json_schema(
            tool_list=allowed_tools, response_format=agent_state.response_format, request_heartbeat=True, terminal_tools=terminal_tool_names
        )

        return (
            llm_client.build_request_data(
                in_context_messages,
                agent_state.llm_config,
                allowed_tools,
                force_tool_call,
            ),
            valid_tool_names,
        )

    @trace_method
    async def _handle_ai_response(
        self,
        tool_call: ToolCall,
        valid_tool_names: list[str],
        agent_state: AgentState,
        tool_rules_solver: ToolRulesSolver,
        usage: UsageStatistics,
        reasoning_content: list[TextContent | ReasoningContent | RedactedReasoningContent | OmittedReasoningContent] | None = None,
        pre_computed_assistant_message_id: str | None = None,
        step_id: str | None = None,
        initial_messages: list[Message] | None = None,
        agent_step_span: Optional["Span"] = None,
        is_final_step: bool | None = None,
        run_id: str | None = None,
        step_metrics: StepMetrics = None,
    ) -> tuple[list[Message], bool, LettaStopReason | None]:
        """
        Handle the final AI response once streaming completes, execute / validate the
        tool call, decide whether we should keep stepping, and persist state.
        """
        # 1.  Parse and validate the tool-call envelope
        tool_call_name: str = tool_call.function.name
        tool_call_id: str = tool_call.id or f"call_{uuid.uuid4().hex[:8]}"
        tool_args = _safe_load_tool_call_str(tool_call.function.arguments)
        request_heartbeat: bool = _pop_heartbeat(tool_args)
        tool_args.pop(INNER_THOUGHTS_KWARG, None)

        log_telemetry(
            self.logger,
            "_handle_ai_response execute tool start",
            tool_name=tool_call_name,
            tool_args=tool_args,
            tool_call_id=tool_call_id,
            request_heartbeat=request_heartbeat,
        )

        # 2.  Execute the tool (or synthesize an error result if disallowed)
        tool_rule_violated = tool_call_name not in valid_tool_names
        if tool_rule_violated:
            tool_execution_result = _build_rule_violation_result(tool_call_name, valid_tool_names, tool_rules_solver)
        else:
            # Track tool execution time
            tool_start_time = get_utc_timestamp_ns()
            tool_execution_result = await self._execute_tool(
                tool_name=tool_call_name,
                tool_args=tool_args,
                agent_state=agent_state,
                agent_step_span=agent_step_span,
                step_id=step_id,
            )
            tool_end_time = get_utc_timestamp_ns()

            # Store tool execution time in metrics
            step_metrics.tool_execution_ns = tool_end_time - tool_start_time

        log_telemetry(
            self.logger, "_handle_ai_response execute tool finish", tool_execution_result=tool_execution_result, tool_call_id=tool_call_id
        )

        # 3.  Prepare the function-response payload
        truncate = tool_call_name not in {"conversation_search", "conversation_search_date", "archival_memory_search"}
        return_char_limit = next(
            (t.return_char_limit for t in agent_state.tools if t.name == tool_call_name),
            None,
        )
        function_response_string = validate_function_response(
            tool_execution_result.func_return,
            return_char_limit=return_char_limit,
            truncate=truncate,
        )
        self.last_function_response = package_function_response(
            was_success=tool_execution_result.success_flag,
            response_string=function_response_string,
            timezone=agent_state.timezone,
        )

        # 4.  Decide whether to keep stepping  (<<< focal section simplified)
        continue_stepping, heartbeat_reason, stop_reason = self._decide_continuation(
            agent_state=agent_state,
            request_heartbeat=request_heartbeat,
            tool_call_name=tool_call_name,
            tool_rule_violated=tool_rule_violated,
            tool_rules_solver=tool_rules_solver,
            is_final_step=is_final_step,
        )

        # 5.  Create messages (step was already created at the beginning)
        tool_call_messages = create_letta_messages_from_llm_response(
            agent_id=agent_state.id,
            model=agent_state.llm_config.model,
            function_name=tool_call_name,
            function_arguments=tool_args,
            tool_execution_result=tool_execution_result,
            tool_call_id=tool_call_id,
            function_call_success=tool_execution_result.success_flag,
            function_response=function_response_string,
            timezone=agent_state.timezone,
            actor=self.actor,
            continue_stepping=continue_stepping,
            heartbeat_reason=heartbeat_reason,
            reasoning_content=reasoning_content,
            pre_computed_assistant_message_id=pre_computed_assistant_message_id,
            step_id=step_id,
        )

        persisted_messages = await self.message_manager.create_many_messages_async(
            (initial_messages or []) + tool_call_messages, actor=self.actor
        )

        if run_id:
            await self.job_manager.add_messages_to_job_async(
                job_id=run_id,
                message_ids=[m.id for m in persisted_messages if m.role != "user"],
                actor=self.actor,
            )

        return persisted_messages, continue_stepping, stop_reason

    def _decide_continuation(
        self,
        agent_state: AgentState,
        request_heartbeat: bool,
        tool_call_name: str,
        tool_rule_violated: bool,
        tool_rules_solver: ToolRulesSolver,
        is_final_step: bool | None,
    ) -> tuple[bool, str | None, LettaStopReason | None]:

        continue_stepping = request_heartbeat
        heartbeat_reason: str | None = None
        stop_reason: LettaStopReason | None = None

        if tool_rule_violated:
            continue_stepping = True
            heartbeat_reason = f"{NON_USER_MSG_PREFIX}Continuing: tool rule violation."
        else:
            tool_rules_solver.register_tool_call(tool_call_name)

            if tool_rules_solver.is_terminal_tool(tool_call_name):
                if continue_stepping:
                    stop_reason = LettaStopReason(stop_reason=StopReasonType.tool_rule.value)
                continue_stepping = False

            elif tool_rules_solver.has_children_tools(tool_call_name):
                continue_stepping = True
                heartbeat_reason = f"{NON_USER_MSG_PREFIX}Continuing: child tool rule."

            elif tool_rules_solver.is_continue_tool(tool_call_name):
                continue_stepping = True
                heartbeat_reason = f"{NON_USER_MSG_PREFIX}Continuing: continue tool rule."

        # – hard stop overrides –
        if is_final_step:
            continue_stepping = False
            stop_reason = LettaStopReason(stop_reason=StopReasonType.max_steps.value)
        else:
            uncalled = tool_rules_solver.get_uncalled_required_tools(available_tools=set([t.name for t in agent_state.tools]))
            if not continue_stepping and uncalled:
                continue_stepping = True
                heartbeat_reason = (
                    f"{NON_USER_MSG_PREFIX}Continuing, user expects these tools: [" f"{', '.join(uncalled)}] to be called still."
                )

                stop_reason = None  # reset – we’re still going

        return continue_stepping, heartbeat_reason, stop_reason

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
            job_manager=self.job_manager,
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
                    "duration_ms": ns_to_ms(end_time - start_time),
                    "success": tool_execution_result.success_flag,
                    "tool_type": target_tool.tool_type,
                    "tool_id": target_tool.id,
                },
            )
        log_event(name=f"finish_{tool_name}_execution", attributes=tool_execution_result.model_dump())
        return tool_execution_result

    @trace_method
    def _load_last_function_response(self, in_context_messages: list[Message]):
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
