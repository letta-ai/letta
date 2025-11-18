import json
import uuid
from datetime import datetime
from typing import AsyncGenerator, Optional, Tuple

from opentelemetry.trace import Span

from letta.adapters.letta_llm_adapter import LettaLLMAdapter
from letta.adapters.letta_llm_request_adapter import LettaLLMRequestAdapter
from letta.adapters.letta_llm_stream_adapter import LettaLLMStreamAdapter
from letta.agents.base_agent_v2 import BaseAgentV2
from letta.agents.ephemeral_summary_agent import EphemeralSummaryAgent
from letta.agents.helpers import (
    _build_rule_violation_result,
    _load_last_function_response,
    _maybe_get_approval_messages,
    _pop_heartbeat,
    _prepare_in_context_messages_no_persist_async,
    _safe_load_tool_call_str,
    generate_step_id,
)
from letta.constants import DEFAULT_MAX_STEPS, NON_USER_MSG_PREFIX, REQUEST_HEARTBEAT_PARAM
from letta.errors import ContextWindowExceededError, LLMError
from letta.helpers import ToolRulesSolver
from letta.helpers.datetime_helpers import get_utc_time, get_utc_timestamp_ns, ns_to_ms
from letta.helpers.reasoning_helper import scrub_inner_thoughts_from_messages
from letta.helpers.tool_execution_helper import enable_strict_mode
from letta.llm_api.llm_client import LLMClient
from letta.local_llm.constants import INNER_THOUGHTS_KWARG
from letta.log import get_logger
from letta.otel.tracing import log_event, trace_method, tracer
from letta.prompts.prompt_generator import PromptGenerator
from letta.schemas.agent import AgentState, UpdateAgent
from letta.schemas.enums import AgentType, MessageStreamStatus, RunStatus, StepStatus
from letta.schemas.letta_message import LettaMessage, MessageType
from letta.schemas.letta_message_content import OmittedReasoningContent, ReasoningContent, RedactedReasoningContent, TextContent
from letta.schemas.letta_response import LettaResponse
from letta.schemas.letta_stop_reason import LettaStopReason, StopReasonType
from letta.schemas.message import Message, MessageCreate, MessageUpdate
from letta.schemas.openai.chat_completion_response import FunctionCall, ToolCall, UsageStatistics
from letta.schemas.step import Step, StepProgression
from letta.schemas.step_metrics import StepMetrics
from letta.schemas.tool import Tool
from letta.schemas.tool_execution_result import ToolExecutionResult
from letta.schemas.usage import LettaUsageStatistics
from letta.schemas.user import User
from letta.server.rest_api.utils import (
    create_approval_request_message_from_llm_response,
    create_letta_messages_from_llm_response,
)
from letta.services.agent_manager import AgentManager
from letta.services.archive_manager import ArchiveManager
from letta.services.block_manager import BlockManager
from letta.services.helpers.tool_parser_helper import runtime_override_tool_json_schema
from letta.services.message_manager import MessageManager
from letta.services.passage_manager import PassageManager
from letta.services.run_manager import RunManager
from letta.services.step_manager import StepManager
from letta.services.summarizer.enums import SummarizationMode
from letta.services.summarizer.summarizer import Summarizer
from letta.services.telemetry_manager import TelemetryManager
from letta.services.tool_executor.tool_execution_manager import ToolExecutionManager
from letta.settings import model_settings, settings, summarizer_settings
from letta.system import package_function_response
from letta.types import JsonDict
from letta.utils import log_telemetry, safe_create_task, united_diff, validate_function_response


class LettaAgentV2(BaseAgentV2):
    """
    Abstract base class for the Letta agent loop, handling message management,
    LLM API requests, tool execution, and context tracking.

    This implementation uses a unified execution path through the _step method,
    supporting both blocking and streaming LLM interactions via the adapter pattern.
    """

    def __init__(
        self,
        agent_state: AgentState,
        actor: User,
    ):
        super().__init__(agent_state, actor)
        self.logger = get_logger(agent_state.id)
        self.tool_rules_solver = ToolRulesSolver(tool_rules=agent_state.tool_rules)
        self.llm_client = LLMClient.create(
            provider_type=agent_state.llm_config.model_endpoint_type,
            put_inner_thoughts_first=True,
            actor=actor,
        )
        self._initialize_state()

        # Manager classes
        self.agent_manager = AgentManager()
        self.archive_manager = ArchiveManager()
        self.block_manager = BlockManager()
        self.run_manager = RunManager()
        self.message_manager = MessageManager()
        self.passage_manager = PassageManager()
        self.step_manager = StepManager()
        self.telemetry_manager = TelemetryManager()

        ## TODO: Expand to more
        # if summarizer_settings.enable_summarization and model_settings.openai_api_key:
        #    self.summarization_agent = EphemeralSummaryAgent(
        #        target_block_label="conversation_summary",
        #        agent_id=self.agent_state.id,
        #        block_manager=self.block_manager,
        #        message_manager=self.message_manager,
        #        agent_manager=self.agent_manager,
        #        actor=self.actor,
        #    )

        # Initialize summarizer for context window management
        self.summarizer = Summarizer(
            mode=(
                SummarizationMode.STATIC_MESSAGE_BUFFER
                if self.agent_state.agent_type == AgentType.voice_convo_agent
                else summarizer_settings.mode
            ),
            summarizer_agent=None,  # self.summarization_agent,
            message_buffer_limit=summarizer_settings.message_buffer_limit,
            message_buffer_min=summarizer_settings.message_buffer_min,
            partial_evict_summarizer_percentage=summarizer_settings.partial_evict_summarizer_percentage,
            agent_manager=self.agent_manager,
            message_manager=self.message_manager,
            actor=self.actor,
            agent_id=self.agent_state.id,
        )

    @trace_method
    async def build_request(self, input_messages: list[MessageCreate]) -> dict:
        """
        Build the request data for an LLM call without actually executing it.

        This is useful for debugging and testing to see what would be sent to the LLM.

        Args:
            input_messages: List of new messages to process

        Returns:
            dict: The request data that would be sent to the LLM
        """
        request = {}
        in_context_messages, input_messages_to_persist = await _prepare_in_context_messages_no_persist_async(
            input_messages, self.agent_state, self.message_manager, self.actor, None
        )
        response = self._step(
            run_id=None,
            messages=in_context_messages + input_messages_to_persist,
            llm_adapter=LettaLLMRequestAdapter(llm_client=self.llm_client, llm_config=self.agent_state.llm_config),
            dry_run=True,
            enforce_run_id_set=False,
        )
        async for chunk in response:
            request = chunk  # First chunk contains request data
            break

        return request

    @trace_method
    async def step(
        self,
        input_messages: list[MessageCreate],
        max_steps: int = DEFAULT_MAX_STEPS,
        run_id: str | None = None,
        use_assistant_message: bool = True,
        include_return_message_types: list[MessageType] | None = None,
        request_start_timestamp_ns: int | None = None,
    ) -> LettaResponse:
        """
        Execute the agent loop in blocking mode, returning all messages at once.

        Args:
            input_messages: List of new messages to process
            max_steps: Maximum number of agent steps to execute
            run_id: Optional job/run ID for tracking
            use_assistant_message: Whether to use assistant message format
            include_return_message_types: Filter for which message types to return
            request_start_timestamp_ns: Start time for tracking request duration

        Returns:
            LettaResponse: Complete response with all messages and metadata
        """
        self._initialize_state()
        request_span = self._request_checkpoint_start(request_start_timestamp_ns=request_start_timestamp_ns)

        in_context_messages, input_messages_to_persist = await _prepare_in_context_messages_no_persist_async(
            input_messages, self.agent_state, self.message_manager, self.actor, run_id
        )
        in_context_messages = in_context_messages + input_messages_to_persist
        response_letta_messages = []
        for i in range(max_steps):
            remaining_turns = max_steps - i - 1

            response = self._step(
                messages=in_context_messages + self.response_messages,
                input_messages_to_persist=input_messages_to_persist,
                llm_adapter=LettaLLMRequestAdapter(llm_client=self.llm_client, llm_config=self.agent_state.llm_config),
                run_id=run_id,
                use_assistant_message=use_assistant_message,
                include_return_message_types=include_return_message_types,
                request_start_timestamp_ns=request_start_timestamp_ns,
                remaining_turns=remaining_turns,
            )

            async for chunk in response:
                response_letta_messages.append(chunk)

            if not self.should_continue:
                break

            input_messages_to_persist = []

        # Rebuild context window after stepping
        if not self.agent_state.message_buffer_autoclear:
            await self.summarize_conversation_history(
                in_context_messages=in_context_messages,
                new_letta_messages=self.response_messages,
                total_tokens=self.usage.total_tokens,
                force=False,
            )

        if self.stop_reason is None:
            self.stop_reason = LettaStopReason(stop_reason=StopReasonType.end_turn.value)

        result = LettaResponse(messages=response_letta_messages, stop_reason=self.stop_reason, usage=self.usage)
        if run_id:
            if self.job_update_metadata is None:
                self.job_update_metadata = {}
            self.job_update_metadata["result"] = result.model_dump(mode="json")

        await self._request_checkpoint_finish(
            request_span=request_span, request_start_timestamp_ns=request_start_timestamp_ns, run_id=run_id
        )
        return result

    @trace_method
    async def stream(
        self,
        input_messages: list[MessageCreate],
        max_steps: int = DEFAULT_MAX_STEPS,
        stream_tokens: bool = False,
        run_id: str | None = None,
        use_assistant_message: bool = True,
        include_return_message_types: list[MessageType] | None = None,
        request_start_timestamp_ns: int | None = None,
    ) -> AsyncGenerator[str, None]:
        """
        Execute the agent loop in streaming mode, yielding chunks as they become available.
        If stream_tokens is True, individual tokens are streamed as they arrive from the LLM,
        providing the lowest latency experience, otherwise each complete step (reasoning +
        tool call + tool return) is yielded as it completes.

        Args:
            input_messages: List of new messages to process
            max_steps: Maximum number of agent steps to execute
            stream_tokens: Whether to stream back individual tokens. Not all llm
                providers offer native token streaming functionality; in these cases,
                this api streams back steps rather than individual tokens.
            run_id: Optional job/run ID for tracking
            use_assistant_message: Whether to use assistant message format
            include_return_message_types: Filter for which message types to return
            request_start_timestamp_ns: Start time for tracking request duration

        Yields:
            str: JSON-formatted SSE data chunks for each completed step
        """
        self._initialize_state()
        request_span = self._request_checkpoint_start(request_start_timestamp_ns=request_start_timestamp_ns)
        first_chunk = True

        if stream_tokens:
            llm_adapter = LettaLLMStreamAdapter(
                llm_client=self.llm_client,
                llm_config=self.agent_state.llm_config,
                run_id=run_id,
            )
        else:
            llm_adapter = LettaLLMRequestAdapter(
                llm_client=self.llm_client,
                llm_config=self.agent_state.llm_config,
            )

        try:
            in_context_messages, input_messages_to_persist = await _prepare_in_context_messages_no_persist_async(
                input_messages, self.agent_state, self.message_manager, self.actor, run_id
            )
            in_context_messages = in_context_messages + input_messages_to_persist
            for i in range(max_steps):
                response = self._step(
                    messages=in_context_messages + self.response_messages,
                    input_messages_to_persist=input_messages_to_persist,
                    llm_adapter=llm_adapter,
                    run_id=run_id,
                    use_assistant_message=use_assistant_message,
                    include_return_message_types=include_return_message_types,
                    request_start_timestamp_ns=request_start_timestamp_ns,
                )
                async for chunk in response:
                    if first_chunk:
                        request_span = self._request_checkpoint_ttft(request_span, request_start_timestamp_ns)
                    yield f"data: {chunk.model_dump_json()}\n\n"
                    first_chunk = False

                if not self.should_continue:
                    break

                input_messages_to_persist = []

            if self.stop_reason is None:
                # terminated due to hitting max_steps
                self.stop_reason = LettaStopReason(stop_reason=StopReasonType.max_steps.value)

            if not self.agent_state.message_buffer_autoclear:
                await self.summarize_conversation_history(
                    in_context_messages=in_context_messages,
                    new_letta_messages=self.response_messages,
                    total_tokens=self.usage.total_tokens,
                    force=False,
                )

        except:
            if self.stop_reason and not first_chunk:
                yield f"data: {self.stop_reason.model_dump_json()}\n\n"
            raise

        if run_id:
            letta_messages = Message.to_letta_messages_from_list(
                self.response_messages,
                use_assistant_message=use_assistant_message,
                reverse=False,
            )
            if not self.stop_reason:
                self.stop_reason = LettaStopReason(stop_reason=StopReasonType.end_turn.value)
            result = LettaResponse(messages=letta_messages, stop_reason=self.stop_reason, usage=self.usage)
            if self.job_update_metadata is None:
                self.job_update_metadata = {}
            self.job_update_metadata["result"] = result.model_dump(mode="json")

        await self._request_checkpoint_finish(
            request_span=request_span, request_start_timestamp_ns=request_start_timestamp_ns, run_id=run_id
        )
        for finish_chunk in self.get_finish_chunks_for_stream(self.usage, self.stop_reason):
            yield f"data: {finish_chunk}\n\n"

    @trace_method
    async def _step(
        self,
        messages: list[Message],
        llm_adapter: LettaLLMAdapter,
        run_id: Optional[str],
        input_messages_to_persist: list[Message] | None = None,
        use_assistant_message: bool = True,
        include_return_message_types: list[MessageType] | None = None,
        request_start_timestamp_ns: int | None = None,
        remaining_turns: int = -1,
        dry_run: bool = False,
        enforce_run_id_set: bool = True,
    ) -> AsyncGenerator[LettaMessage | dict, None]:
        """
        Execute a single agent step (one LLM call and tool execution).

        This is the core execution method that all public methods (step, stream_steps,
        stream_tokens) funnel through. It handles the complete flow of making an LLM
        request, processing the response, executing tools, and persisting messages.

        Args:
            messages: Current in-context messages
            llm_adapter: Adapter for LLM interaction (blocking or streaming)
            input_messages_to_persist: New messages to persist after execution
            run_id: Optional job/run ID for tracking
            use_assistant_message: Whether to use assistant message format
            include_return_message_types: Filter for which message types to yield
            request_start_timestamp_ns: Start time for tracking request duration
            remaining_turns: Number of turns remaining (for max_steps enforcement)
            dry_run: If true, only build and return the request without executing

        Yields:
            LettaMessage or dict: Chunks for streaming mode, or request data for dry_run
        """
        if enforce_run_id_set and run_id is None:
            raise AssertionError("run_id is required when enforce_run_id_set is True")

        step_progression = StepProgression.START
        # TODO(@caren): clean this up
        tool_call, reasoning_content, agent_step_span, first_chunk, step_id, logged_step, step_start_ns, step_metrics = (
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
        )
        try:
            self.last_function_response = _load_last_function_response(messages)
            valid_tools = await self._get_valid_tools()
            approval_request, approval_response = _maybe_get_approval_messages(messages)
            if approval_request and approval_response:
                tool_call = approval_request.tool_calls[0]
                reasoning_content = approval_request.content
                step_id = approval_request.step_id
                step_metrics = await self.step_manager.get_step_metrics_async(step_id=step_id, actor=self.actor)
            else:
                # Check for job cancellation at the start of each step
                if run_id and await self._check_run_cancellation(run_id):
                    self.stop_reason = LettaStopReason(stop_reason=StopReasonType.cancelled.value)
                    self.logger.info(f"Agent execution cancelled for run {run_id}")
                    return

                step_id = generate_step_id()
                step_progression, logged_step, step_metrics, agent_step_span = await self._step_checkpoint_start(
                    step_id=step_id, run_id=run_id
                )

                messages = await self._refresh_messages(messages)
                force_tool_call = valid_tools[0]["name"] if len(valid_tools) == 1 else None
                for llm_request_attempt in range(summarizer_settings.max_summarizer_retries + 1):
                    try:
                        request_data = self.llm_client.build_request_data(
                            agent_type=self.agent_state.agent_type,
                            messages=messages,
                            llm_config=self.agent_state.llm_config,
                            tools=valid_tools,
                            force_tool_call=force_tool_call,
                        )
                        if dry_run:
                            yield request_data
                            return

                        step_progression, step_metrics = self._step_checkpoint_llm_request_start(step_metrics, agent_step_span)

                        invocation = llm_adapter.invoke_llm(
                            request_data=request_data,
                            messages=messages,
                            tools=valid_tools,
                            use_assistant_message=use_assistant_message,
                            requires_approval_tools=self.tool_rules_solver.get_requires_approval_tools(
                                set([t["name"] for t in valid_tools])
                            ),
                            step_id=step_id,
                            actor=self.actor,
                        )
                        async for chunk in invocation:
                            if llm_adapter.supports_token_streaming():
                                if include_return_message_types is None or chunk.message_type in include_return_message_types:
                                    first_chunk = True
                                    yield chunk
                        # If you've reached this point without an error, break out of retry loop
                        break
                    except ValueError as e:
                        self.stop_reason = LettaStopReason(stop_reason=StopReasonType.invalid_llm_response.value)
                        raise e
                    except LLMError as e:
                        self.stop_reason = LettaStopReason(stop_reason=StopReasonType.llm_api_error.value)
                        raise e
                    except Exception as e:
                        if isinstance(e, ContextWindowExceededError) and llm_request_attempt < summarizer_settings.max_summarizer_retries:
                            # Retry case
                            messages = await self.summarize_conversation_history(
                                in_context_messages=messages,
                                new_letta_messages=self.response_messages,
                                llm_config=self.agent_state.llm_config,
                                force=True,
                            )
                        else:
                            raise e

                step_progression, step_metrics = self._step_checkpoint_llm_request_finish(
                    step_metrics, agent_step_span, llm_adapter.llm_request_finish_timestamp_ns
                )

                self._update_global_usage_stats(llm_adapter.usage)

            # Handle the AI response with the extracted data
            if tool_call is None and llm_adapter.tool_call is None:
                self.stop_reason = LettaStopReason(stop_reason=StopReasonType.no_tool_call.value)
                raise LLMError("No tool calls found in response, model must make a tool call")

            # TODO: how should be associate input messages with runs?
            ## Set run_id on input messages before persisting
            # if input_messages_to_persist and run_id:
            #    for message in input_messages_to_persist:
            #        if message.run_id is None:
            #            message.run_id = run_id

            persisted_messages, self.should_continue, self.stop_reason = await self._handle_ai_response(
                tool_call or llm_adapter.tool_call,
                [tool["name"] for tool in valid_tools],
                self.agent_state,
                self.tool_rules_solver,
                UsageStatistics(
                    completion_tokens=self.usage.completion_tokens,
                    prompt_tokens=self.usage.prompt_tokens,
                    total_tokens=self.usage.total_tokens,
                ),
                reasoning_content=reasoning_content or llm_adapter.reasoning_content,
                pre_computed_assistant_message_id=llm_adapter.message_id,
                step_id=step_id,
                initial_messages=input_messages_to_persist,
                agent_step_span=agent_step_span,
                is_final_step=(remaining_turns == 0),
                run_id=run_id,
                step_metrics=step_metrics,
                is_approval=approval_response.approve if approval_response is not None else False,
                is_denial=(approval_response.approve == False) if approval_response is not None else False,
                denial_reason=approval_response.denial_reason if approval_response is not None else None,
            )

            new_message_idx = len(input_messages_to_persist) if input_messages_to_persist else 0
            self.response_messages.extend(persisted_messages[new_message_idx:])

            if llm_adapter.supports_token_streaming():
                if persisted_messages[-1].role != "approval":
                    tool_return = [msg for msg in persisted_messages if msg.role == "tool"][-1].to_letta_messages()[0]
                    if not (use_assistant_message and tool_return.name == "send_message"):
                        if include_return_message_types is None or tool_return.message_type in include_return_message_types:
                            yield tool_return
            else:
                filter_user_messages = [m for m in persisted_messages[new_message_idx:] if m.role != "user"]
                letta_messages = Message.to_letta_messages_from_list(
                    filter_user_messages,
                    use_assistant_message=use_assistant_message,
                    reverse=False,
                )
                for message in letta_messages:
                    if include_return_message_types is None or message.message_type in include_return_message_types:
                        yield message

            # Persist approval responses immediately to prevent agent from getting into a bad state
            if (
                len(input_messages_to_persist) == 1
                and input_messages_to_persist[0].role == "approval"
                and persisted_messages[0].role == "approval"
                and persisted_messages[1].role == "tool"
            ):
                self.agent_state.message_ids = self.agent_state.message_ids + [m.id for m in persisted_messages[:2]]
                await self.agent_manager.update_message_ids_async(
                    agent_id=self.agent_state.id, message_ids=self.agent_state.message_ids, actor=self.actor
                )
            step_progression, step_metrics = await self._step_checkpoint_finish(step_metrics, agent_step_span, logged_step)
        except Exception as e:
            self.logger.warning(f"Error during step processing: {e}")
            self.job_update_metadata = {"error": str(e)}

            # This indicates we failed after we decided to stop stepping, which indicates a bug with our flow.
            if not self.stop_reason:
                self.stop_reason = LettaStopReason(stop_reason=StopReasonType.error.value)
            elif self.stop_reason.stop_reason in (StopReasonType.end_turn, StopReasonType.max_steps, StopReasonType.tool_rule):
                self.logger.error("Error occurred during step processing, with valid stop reason: %s", self.stop_reason.stop_reason)
            elif self.stop_reason.stop_reason not in (
                StopReasonType.no_tool_call,
                StopReasonType.invalid_tool_call,
                StopReasonType.invalid_llm_response,
                StopReasonType.llm_api_error,
            ):
                self.logger.error("Error occurred during step processing, with unexpected stop reason: %s", self.stop_reason.stop_reason)
            raise e
        finally:
            self.logger.debug("Running cleanup for agent loop run: %s", run_id)
            self.logger.info("Running final update. Step Progression: %s", step_progression)
            try:
                if step_progression == StepProgression.FINISHED:
                    if not self.should_continue:
                        if self.stop_reason is None:
                            self.stop_reason = LettaStopReason(stop_reason=StopReasonType.end_turn.value)
                        if logged_step and step_id:
                            await self.step_manager.update_step_stop_reason(self.actor, step_id, self.stop_reason.stop_reason)
                    return
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
                            stop_reason=self.stop_reason,
                        )
                if step_progression <= StepProgression.STREAM_RECEIVED:
                    if first_chunk and settings.track_errored_messages and input_messages_to_persist:
                        for message in input_messages_to_persist:
                            message.is_err = True
                            message.step_id = step_id
                            message.run_id = run_id
                        await self.message_manager.create_many_messages_async(
                            input_messages_to_persist,
                            actor=self.actor,
                            project_id=self.agent_state.project_id,
                            template_id=self.agent_state.template_id,
                        )
                elif step_progression <= StepProgression.LOGGED_TRACE:
                    if self.stop_reason is None:
                        self.logger.error("Error in step after logging step")
                        self.stop_reason = LettaStopReason(stop_reason=StopReasonType.error.value)
                    if logged_step:
                        await self.step_manager.update_step_stop_reason(self.actor, step_id, self.stop_reason.stop_reason)
                else:
                    self.logger.error("Invalid StepProgression value")

                # Do tracking for failure cases. Can consolidate with success conditions later.
                if settings.track_stop_reason:
                    await self._log_request(request_start_timestamp_ns, None, self.job_update_metadata, is_error=True, run_id=run_id)

                # Record partial step metrics on failure (capture whatever timing data we have)
                if logged_step and step_metrics and step_progression < StepProgression.FINISHED:
                    # Calculate total step time up to the failure point
                    step_metrics.step_ns = get_utc_timestamp_ns() - step_metrics.step_start_ns

                    await self._record_step_metrics(
                        step_id=step_id,
                        step_metrics=step_metrics,
                        run_id=run_id,
                    )
            except Exception as e:
                self.logger.error(f"Error during post-completion step tracking: {e}")

    def _initialize_state(self):
        self.should_continue = True
        self.stop_reason = None
        self.usage = LettaUsageStatistics()
        self.job_update_metadata = None
        self.last_function_response = None
        self.response_messages = []

    @trace_method
    async def _check_run_cancellation(self, run_id) -> bool:
        try:
            run = await self.run_manager.get_run_by_id(run_id=run_id, actor=self.actor)
            return run.status == RunStatus.cancelled
        except Exception as e:
            # Log the error but don't fail the execution
            self.logger.warning(f"Failed to check job cancellation status for job {run_id}: {e}")
            return False

    @trace_method
    async def _refresh_messages(self, in_context_messages: list[Message]):
        num_messages = await self.message_manager.size_async(
            agent_id=self.agent_state.id,
            actor=self.actor,
        )
        num_archival_memories = await self.passage_manager.agent_passage_size_async(
            agent_id=self.agent_state.id,
            actor=self.actor,
        )
        in_context_messages = await self._rebuild_memory(
            in_context_messages,
            num_messages=num_messages,
            num_archival_memories=num_archival_memories,
        )
        in_context_messages = scrub_inner_thoughts_from_messages(in_context_messages, self.agent_state.llm_config)
        return in_context_messages

    @trace_method
    async def _rebuild_memory(
        self,
        in_context_messages: list[Message],
        num_messages: int,
        num_archival_memories: int,
    ):
        agent_state = await self.agent_manager.refresh_memory_async(agent_state=self.agent_state, actor=self.actor)

        tool_constraint_block = None
        if self.tool_rules_solver is not None:
            tool_constraint_block = self.tool_rules_solver.compile_tool_rule_prompts()

        archive = await self.archive_manager.get_default_archive_for_agent_async(
            agent_id=self.agent_state.id,
            actor=self.actor,
        )

        if archive:
            archive_tags = await self.passage_manager.get_unique_tags_for_archive_async(
                archive_id=archive.id,
                actor=self.actor,
            )
        else:
            archive_tags = None

        # TODO: This is a pretty brittle pattern established all over our code, need to get rid of this
        curr_system_message = in_context_messages[0]
        curr_system_message_text = curr_system_message.content[0].text

        # extract the dynamic section that includes memory blocks, tool rules, and directories
        # this avoids timestamp comparison issues
        def extract_dynamic_section(text):
            start_marker = "</base_instructions>"
            end_marker = "<memory_metadata>"

            start_idx = text.find(start_marker)
            end_idx = text.find(end_marker)

            if start_idx != -1 and end_idx != -1:
                return text[start_idx:end_idx]
            return text  # fallback to full text if markers not found

        curr_dynamic_section = extract_dynamic_section(curr_system_message_text)

        # refresh files
        agent_state = await self.agent_manager.refresh_file_blocks(agent_state=agent_state, actor=self.actor)

        # generate just the memory string with current state for comparison
        curr_memory_str = agent_state.memory.compile(
            tool_usage_rules=tool_constraint_block,
            sources=agent_state.sources,
            max_files_open=agent_state.max_files_open,
            llm_config=agent_state.llm_config,
        )
        new_dynamic_section = extract_dynamic_section(curr_memory_str)

        # compare just the dynamic sections (memory blocks, tool rules, directories)
        if curr_dynamic_section == new_dynamic_section:
            self.logger.debug(
                f"Memory and sources haven't changed for agent id={agent_state.id} and actor=({self.actor.id}, {self.actor.name}), skipping system prompt rebuild"
            )
            return in_context_messages

        memory_edit_timestamp = get_utc_time()

        # size of messages and archival memories
        if num_messages is None:
            num_messages = await self.message_manager.size_async(actor=self.actor, agent_id=agent_state.id)
        if num_archival_memories is None:
            num_archival_memories = await self.passage_manager.agent_passage_size_async(actor=self.actor, agent_id=agent_state.id)

        new_system_message_str = PromptGenerator.get_system_message_from_compiled_memory(
            system_prompt=agent_state.system,
            memory_with_sources=curr_memory_str,
            in_context_memory_last_edit=memory_edit_timestamp,
            timezone=agent_state.timezone,
            previous_message_count=num_messages - len(in_context_messages),
            archival_memory_size=num_archival_memories,
            archive_tags=archive_tags,
        )

        diff = united_diff(curr_system_message_text, new_system_message_str)
        if len(diff) > 0:
            self.logger.debug(f"Rebuilding system with new memory...\nDiff:\n{diff}")

            # [DB Call] Update Messages
            new_system_message = await self.message_manager.update_message_by_id_async(
                curr_system_message.id, message_update=MessageUpdate(content=new_system_message_str), actor=self.actor
            )
            return [new_system_message] + in_context_messages[1:]

        else:
            return in_context_messages

    @trace_method
    async def _get_valid_tools(self):
        tools = self.agent_state.tools
        valid_tool_names = self.tool_rules_solver.get_allowed_tool_names(
            available_tools=set([t.name for t in tools]),
            last_function_response=self.last_function_response,
            error_on_empty=False,  # Return empty list instead of raising error
        ) or list(set(t.name for t in tools))
        allowed_tools = [enable_strict_mode(t.json_schema) for t in tools if t.name in set(valid_tool_names)]
        terminal_tool_names = {rule.tool_name for rule in self.tool_rules_solver.terminal_tool_rules}
        allowed_tools = runtime_override_tool_json_schema(
            tool_list=allowed_tools,
            response_format=self.agent_state.response_format,
            request_heartbeat=True,
            terminal_tools=terminal_tool_names,
        )
        return allowed_tools

    @trace_method
    def _request_checkpoint_start(self, request_start_timestamp_ns: int | None) -> Span | None:
        if request_start_timestamp_ns is not None:
            request_span = tracer.start_span("time_to_first_token", start_time=request_start_timestamp_ns)
            request_span.set_attributes(
                {f"llm_config.{k}": v for k, v in self.agent_state.llm_config.model_dump().items() if v is not None}
            )
            return request_span
        return None

    @trace_method
    def _request_checkpoint_ttft(self, request_span: Span | None, request_start_timestamp_ns: int | None) -> Span | None:
        if request_span:
            ttft_ns = get_utc_timestamp_ns() - request_start_timestamp_ns
            request_span.add_event(name="time_to_first_token_ms", attributes={"ttft_ms": ns_to_ms(ttft_ns)})
            return request_span
        return None

    @trace_method
    async def _request_checkpoint_finish(
        self, request_span: Span | None, request_start_timestamp_ns: int | None, run_id: str | None
    ) -> None:
        await self._log_request(request_start_timestamp_ns, request_span, self.job_update_metadata, is_error=False, run_id=run_id)
        return None

    @trace_method
    async def _step_checkpoint_start(self, step_id: str, run_id: str | None) -> Tuple[StepProgression, Step, StepMetrics, Span]:
        step_start_ns = get_utc_timestamp_ns()
        step_metrics = StepMetrics(id=step_id, step_start_ns=step_start_ns)
        agent_step_span = tracer.start_span("agent_step", start_time=step_start_ns)
        agent_step_span.set_attributes({"step_id": step_id})
        # Create step early with PENDING status
        logged_step = await self.step_manager.log_step_async(
            actor=self.actor,
            agent_id=self.agent_state.id,
            provider_name=self.agent_state.llm_config.model_endpoint_type,
            provider_category=self.agent_state.llm_config.provider_category or "base",
            model=self.agent_state.llm_config.model,
            model_endpoint=self.agent_state.llm_config.model_endpoint,
            context_window_limit=self.agent_state.llm_config.context_window,
            usage=UsageStatistics(completion_tokens=0, prompt_tokens=0, total_tokens=0),
            provider_id=None,
            run_id=run_id,
            step_id=step_id,
            project_id=self.agent_state.project_id,
            status=StepStatus.PENDING,
        )
        return StepProgression.START, logged_step, step_metrics, agent_step_span

    @trace_method
    def _step_checkpoint_llm_request_start(self, step_metrics: StepMetrics, agent_step_span: Span) -> Tuple[StepProgression, StepMetrics]:
        llm_request_start_ns = get_utc_timestamp_ns()
        step_metrics.llm_request_start_ns = llm_request_start_ns
        agent_step_span.add_event(
            name="request_start_to_provider_request_start_ns",
            attributes={"request_start_to_provider_request_start_ns": ns_to_ms(llm_request_start_ns)},
        )
        return StepProgression.START, step_metrics

    @trace_method
    def _step_checkpoint_llm_request_finish(
        self, step_metrics: StepMetrics, agent_step_span: Span, llm_request_finish_timestamp_ns: int
    ) -> Tuple[StepProgression, StepMetrics]:
        llm_request_ns = llm_request_finish_timestamp_ns - step_metrics.llm_request_start_ns
        step_metrics.llm_request_ns = llm_request_ns
        agent_step_span.add_event(name="llm_request_ms", attributes={"duration_ms": ns_to_ms(llm_request_ns)})
        return StepProgression.RESPONSE_RECEIVED, step_metrics

    @trace_method
    async def _step_checkpoint_finish(
        self, step_metrics: StepMetrics, agent_step_span: Span | None, logged_step: Step | None
    ) -> Tuple[StepProgression, StepMetrics]:
        if step_metrics.step_start_ns:
            step_ns = get_utc_timestamp_ns() - step_metrics.step_start_ns
            step_metrics.step_ns = step_ns
            if agent_step_span is not None:
                agent_step_span.add_event(name="step_ms", attributes={"duration_ms": ns_to_ms(step_ns)})
                agent_step_span.end()
            self._record_step_metrics(step_id=step_metrics.id, step_metrics=step_metrics)

        # Update step with actual usage now that we have it (if step was created)
        if logged_step:
            await self.step_manager.update_step_success_async(
                self.actor,
                step_metrics.id,
                UsageStatistics(
                    completion_tokens=self.usage.completion_tokens,
                    prompt_tokens=self.usage.prompt_tokens,
                    total_tokens=self.usage.total_tokens,
                ),
                self.stop_reason,
            )
        return StepProgression.FINISHED, step_metrics

    def _update_global_usage_stats(self, step_usage_stats: LettaUsageStatistics):
        self.usage.step_count += step_usage_stats.step_count
        self.usage.completion_tokens += step_usage_stats.completion_tokens
        self.usage.prompt_tokens += step_usage_stats.prompt_tokens
        self.usage.total_tokens += step_usage_stats.total_tokens

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
        agent_step_span: Span | None = None,
        is_final_step: bool | None = None,
        run_id: str | None = None,
        step_metrics: StepMetrics = None,
        is_approval: bool | None = None,
        is_denial: bool | None = None,
        denial_reason: str | None = None,
    ) -> tuple[list[Message], bool, LettaStopReason | None]:
        """
        Handle the final AI response once streaming completes, execute / validate the
        tool call, decide whether we should keep stepping, and persist state.
        """
        tool_call_id: str = tool_call.id or f"call_{uuid.uuid4().hex[:8]}"

        if is_denial:
            continue_stepping = True
            stop_reason = None
            tool_call_messages = create_letta_messages_from_llm_response(
                agent_id=agent_state.id,
                model=agent_state.llm_config.model,
                function_name=tool_call.function.name,
                function_arguments={},
                tool_execution_result=ToolExecutionResult(status="error"),
                tool_call_id=tool_call_id,
                function_response=f"Error: request to call tool denied. User reason: {denial_reason}",
                timezone=agent_state.timezone,
                continue_stepping=continue_stepping,
                heartbeat_reason=f"{NON_USER_MSG_PREFIX}Continuing: user denied request to call tool.",
                reasoning_content=None,
                pre_computed_assistant_message_id=None,
                step_id=step_id,
                is_approval_response=True,
                run_id=run_id,
            )
            messages_to_persist = (initial_messages or []) + tool_call_messages

            for message in messages_to_persist:
                message.step_id = step_id
                message.run_id = run_id

            persisted_messages = await self.message_manager.create_many_messages_async(
                messages_to_persist,
                actor=self.actor,
                run_id=run_id,
                project_id=agent_state.project_id,
                template_id=agent_state.template_id,
            )
            return persisted_messages, continue_stepping, stop_reason

        # 1.  Parse and validate the tool-call envelope
        tool_call_name: str = tool_call.function.name

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

        if not is_approval and tool_rules_solver.is_requires_approval_tool(tool_call_name):
            tool_args[REQUEST_HEARTBEAT_PARAM] = request_heartbeat
            approval_messages = create_approval_request_message_from_llm_response(
                agent_id=agent_state.id,
                model=agent_state.llm_config.model,
                requested_tool_calls=[
                    ToolCall(id=tool_call_id, function=FunctionCall(name=tool_call_name, arguments=json.dumps(tool_args)))
                ],
                reasoning_content=reasoning_content,
                pre_computed_assistant_message_id=pre_computed_assistant_message_id,
                step_id=step_id,
                run_id=run_id,
            )
            messages_to_persist = (initial_messages or []) + approval_messages
            continue_stepping = False
            stop_reason = LettaStopReason(stop_reason=StopReasonType.requires_approval.value)
        else:
            # 2.  Execute the tool (or synthesize an error result if disallowed)
            tool_rule_violated = tool_call_name not in valid_tool_names and not is_approval
            if tool_rule_violated:
                tool_execution_result = _build_rule_violation_result(tool_call_name, valid_tool_names, tool_rules_solver)
            else:
                # Track tool execution time
                tool_start_time = get_utc_timestamp_ns()
                target_tool = next((x for x in agent_state.tools if x.name == tool_call_name), None)

                tool_execution_result = await self._execute_tool(
                    target_tool=target_tool,
                    tool_args=tool_args,
                    agent_state=agent_state,
                    agent_step_span=agent_step_span,
                    step_id=step_id,
                )
                tool_end_time = get_utc_timestamp_ns()

                # Store tool execution time in metrics
                step_metrics.tool_execution_ns = tool_end_time - tool_start_time

            log_telemetry(
                self.logger,
                "_handle_ai_response execute tool finish",
                tool_execution_result=tool_execution_result,
                tool_call_id=tool_call_id,
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

            # 4.  Decide whether to keep stepping  (focal section simplified)
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
                function_response=function_response_string,
                timezone=agent_state.timezone,
                continue_stepping=continue_stepping,
                heartbeat_reason=heartbeat_reason,
                reasoning_content=reasoning_content,
                pre_computed_assistant_message_id=pre_computed_assistant_message_id,
                step_id=step_id,
                run_id=run_id,
                is_approval_response=is_approval or is_denial,
            )
            messages_to_persist = (initial_messages or []) + tool_call_messages

        for message in messages_to_persist:
            message.step_id = step_id
            message.run_id = run_id

        persisted_messages = await self.message_manager.create_many_messages_async(
            messages_to_persist, actor=self.actor, run_id=run_id, project_id=agent_state.project_id, template_id=agent_state.template_id
        )

        return persisted_messages, continue_stepping, stop_reason

    @trace_method
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
                heartbeat_reason = f"{NON_USER_MSG_PREFIX}Continuing, user expects these tools: [{', '.join(uncalled)}] to be called still."

                stop_reason = None  # reset – we’re still going

        return continue_stepping, heartbeat_reason, stop_reason

    @trace_method
    async def _execute_tool(
        self,
        target_tool: Tool,
        tool_args: JsonDict,
        agent_state: AgentState,
        agent_step_span: Span | None = None,
        step_id: str | None = None,
    ) -> "ToolExecutionResult":
        """
        Executes a tool and returns the ToolExecutionResult.
        """
        from letta.schemas.tool_execution_result import ToolExecutionResult

        tool_name = target_tool.name

        # Special memory case
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

        # Decrypt environment variable values
        sandbox_env_vars = {var.key: var.get_value_secret().get_plaintext() for var in agent_state.secrets}
        tool_execution_manager = ToolExecutionManager(
            agent_state=agent_state,
            message_manager=self.message_manager,
            run_manager=self.run_manager,
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
                    "duration_ms": ns_to_ms(end_time - start_time),
                    "success": tool_execution_result.success_flag,
                    "tool_type": target_tool.tool_type,
                    "tool_id": target_tool.id,
                },
            )
        log_event(name=f"finish_{tool_name}_execution", attributes=tool_execution_result.model_dump())
        return tool_execution_result

    @trace_method
    async def summarize_conversation_history(
        self,
        in_context_messages: list[Message],
        new_letta_messages: list[Message],
        total_tokens: int | None = None,
        force: bool = False,
    ) -> list[Message]:
        # always skip summarization if last message is an approval request message
        skip_summarization = False
        latest_messages = in_context_messages + new_letta_messages
        if latest_messages[-1].role == "approval" and len(latest_messages[-1].tool_calls) > 0:
            skip_summarization = True

        # If total tokens is reached, we truncate down
        # TODO: This can be broken by bad configs, e.g. lower bound too high, initial messages too fat, etc.
        # TODO: `force` and `clear` seem to no longer be used, we should remove
        if not skip_summarization:
            try:
                if force or (total_tokens and total_tokens > self.agent_state.llm_config.context_window):
                    self.logger.warning(
                        f"Total tokens {total_tokens} exceeds configured max tokens {self.agent_state.llm_config.context_window}, forcefully clearing message history."
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
                        f"Total tokens {total_tokens} does not exceed configured max tokens {self.agent_state.llm_config.context_window}, passing summarizing w/o force."
                    )
                    new_in_context_messages, updated = await self.summarizer.summarize(
                        in_context_messages=in_context_messages,
                        new_letta_messages=new_letta_messages,
                    )
            except Exception as e:
                self.logger.error(f"Failed to summarize conversation history: {e}")
                new_in_context_messages = in_context_messages + new_letta_messages
        else:
            new_in_context_messages = in_context_messages + new_letta_messages

        message_ids = [m.id for m in new_in_context_messages]
        await self.agent_manager.update_message_ids_async(
            agent_id=self.agent_state.id,
            message_ids=message_ids,
            actor=self.actor,
        )
        self.agent_state.message_ids = message_ids

        return new_in_context_messages

    def _record_step_metrics(
        self,
        *,
        step_id: str,
        step_metrics: StepMetrics,
        run_id: str | None = None,
    ):
        task = safe_create_task(
            self.step_manager.record_step_metrics_async(
                actor=self.actor,
                step_id=step_id,
                llm_request_ns=step_metrics.llm_request_ns,
                tool_execution_ns=step_metrics.tool_execution_ns,
                step_ns=step_metrics.step_ns,
                agent_id=self.agent_state.id,
                run_id=run_id,
                project_id=self.agent_state.project_id,
                template_id=self.agent_state.template_id,
                base_template_id=self.agent_state.base_template_id,
            ),
            label="record_step_metrics",
        )
        return task

    @trace_method
    async def _log_request(
        self,
        request_start_timestamp_ns: int,
        request_span: "Span | None",
        job_update_metadata: dict | None,
        is_error: bool,
        run_id: str | None = None,
    ):
        if request_start_timestamp_ns:
            now_ns, now = get_utc_timestamp_ns(), get_utc_time()
            duration_ns = now_ns - request_start_timestamp_ns
            if request_span:
                request_span.add_event(name="letta_request_ms", attributes={"duration_ms": ns_to_ms(duration_ns)})
            await self._update_agent_last_run_metrics(now, ns_to_ms(duration_ns))
            # if settings.track_agent_run and run_id:
            #    await self.job_manager.record_response_duration(run_id, duration_ns, self.actor)
            #    await self.job_manager.safe_update_job_status_async(
            #        job_id=run_id,
            #        new_status=JobStatus.failed if is_error else JobStatus.completed,
            #        actor=self.actor,
            #        stop_reason=self.stop_reason.stop_reason if self.stop_reason else StopReasonType.error,
            #        metadata=job_update_metadata,
            #    )
        if request_span:
            request_span.end()

    @trace_method
    async def _update_agent_last_run_metrics(self, completion_time: datetime, duration_ms: float) -> None:
        if not settings.track_last_agent_run:
            return
        try:
            await self.agent_manager.update_agent_async(
                agent_id=self.agent_state.id,
                agent_update=UpdateAgent(last_run_completion=completion_time, last_run_duration_ms=duration_ms),
                actor=self.actor,
            )
        except Exception as e:
            self.logger.error(f"Failed to update agent's last run metrics: {e}")

    def get_finish_chunks_for_stream(
        self,
        usage: LettaUsageStatistics,
        stop_reason: LettaStopReason | None = None,
    ):
        if stop_reason is None:
            stop_reason = LettaStopReason(stop_reason=StopReasonType.end_turn.value)
        return [
            stop_reason.model_dump_json(),
            usage.model_dump_json(),
            MessageStreamStatus.done.value,
        ]
