import uuid
from typing import AsyncGenerator, Optional

from opentelemetry.trace import Span

from letta.adapters.letta_llm_adapter import LettaLLMAdapter
from letta.adapters.simple_llm_request_adapter import SimpleLLMRequestAdapter
from letta.adapters.simple_llm_stream_adapter import SimpleLLMStreamAdapter
from letta.agents.helpers import (
    _build_rule_violation_result,
    _load_last_function_response,
    _maybe_get_approval_messages,
    _prepare_in_context_messages_no_persist_async,
    _safe_load_tool_call_str,
    generate_step_id,
    merge_and_validate_prefilled_args,
)
from letta.agents.letta_agent_v2 import LettaAgentV2
from letta.constants import DEFAULT_MAX_STEPS, NON_USER_MSG_PREFIX, REQUEST_HEARTBEAT_PARAM
from letta.errors import ContextWindowExceededError, LLMError
from letta.helpers import ToolRulesSolver
from letta.helpers.datetime_helpers import get_utc_timestamp_ns
from letta.helpers.tool_execution_helper import enable_strict_mode
from letta.local_llm.constants import INNER_THOUGHTS_KWARG
from letta.otel.tracing import trace_method
from letta.schemas.agent import AgentState
from letta.schemas.letta_message import LettaMessage, MessageType
from letta.schemas.letta_message_content import OmittedReasoningContent, ReasoningContent, RedactedReasoningContent, TextContent
from letta.schemas.letta_response import LettaResponse
from letta.schemas.letta_stop_reason import LettaStopReason, StopReasonType
from letta.schemas.message import Message, MessageCreate
from letta.schemas.openai.chat_completion_response import ToolCall, UsageStatistics
from letta.schemas.step import StepProgression
from letta.schemas.step_metrics import StepMetrics
from letta.schemas.tool_execution_result import ToolExecutionResult
from letta.server.rest_api.utils import create_approval_request_message_from_llm_response, create_letta_messages_from_llm_response
from letta.services.helpers.tool_parser_helper import runtime_override_tool_json_schema
from letta.settings import settings, summarizer_settings
from letta.system import package_function_response
from letta.utils import log_telemetry, validate_function_response


class LettaAgentV3(LettaAgentV2):
    """
    Similar to V2, but stripped down / simplified, while also generalized:
    * Supports non-tool returns
    * No inner thoughts in kwargs
    * No heartbeats (loops happen on tool calls)

    TODOs:
    * Support tool rules
    * Support Gemini / OpenAI client
    """

    def _initialize_state(self):
        super()._initialize_state()
        self._require_tool_call = False

    @trace_method
    async def step(
        self,
        input_messages: list[MessageCreate],
        max_steps: int = DEFAULT_MAX_STEPS,
        run_id: str | None = None,
        use_assistant_message: bool = True,  # NOTE: not used
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
            response = self._step(
                messages=in_context_messages + self.response_messages,
                input_messages_to_persist=input_messages_to_persist,
                # TODO need to support non-streaming adapter too
                llm_adapter=SimpleLLMRequestAdapter(llm_client=self.llm_client, llm_config=self.agent_state.llm_config),
                run_id=run_id,
                # use_assistant_message=use_assistant_message,
                include_return_message_types=include_return_message_types,
                request_start_timestamp_ns=request_start_timestamp_ns,
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
        use_assistant_message: bool = True,  # NOTE: not used
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
            llm_adapter = SimpleLLMStreamAdapter(
                llm_client=self.llm_client,
                llm_config=self.agent_state.llm_config,
                run_id=run_id,
            )
        else:
            llm_adapter = SimpleLLMRequestAdapter(
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
                    # use_assistant_message=use_assistant_message,
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
                use_assistant_message=False,  # NOTE: set to false
                reverse=False,
                # text_is_assistant_message=(self.agent_state.agent_type == AgentType.react_agent),
                text_is_assistant_message=True,
            )
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
        input_messages_to_persist: list[Message] | None = None,
        run_id: str | None = None,
        # use_assistant_message: bool = True,
        include_return_message_types: list[MessageType] | None = None,
        request_start_timestamp_ns: int | None = None,
        remaining_turns: int = -1,
        dry_run: bool = False,
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
            include_return_message_types: Filter for which message types to yield
            request_start_timestamp_ns: Start time for tracking request duration
            remaining_turns: Number of turns remaining (for max_steps enforcement)
            dry_run: If true, only build and return the request without executing

        Yields:
            LettaMessage or dict: Chunks for streaming mode, or request data for dry_run
        """
        step_progression = StepProgression.START
        # TODO(@caren): clean this up
        tool_call, content, agent_step_span, first_chunk, step_id, logged_step, step_start_ns, step_metrics = (
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
            require_tool_call = self.tool_rules_solver.should_force_tool_call()

            if self._require_tool_call != require_tool_call:
                if require_tool_call:
                    self.logger.info("switching to constrained mode (forcing tool call)")
                else:
                    self.logger.info("switching to unconstrained mode (allowing non-tool responses)")
            self._require_tool_call = require_tool_call

            approval_request, approval_response = _maybe_get_approval_messages(messages)
            if approval_request and approval_response:
                tool_call = approval_request.tool_calls[0]
                content = approval_request.content
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
                force_tool_call = valid_tools[0]["name"] if len(valid_tools) == 1 and self._require_tool_call else None
                for llm_request_attempt in range(summarizer_settings.max_summarizer_retries + 1):
                    try:
                        request_data = self.llm_client.build_request_data(
                            agent_type=self.agent_state.agent_type,
                            messages=messages,
                            llm_config=self.agent_state.llm_config,
                            tools=valid_tools,
                            force_tool_call=force_tool_call,
                            requires_subsequent_tool_call=self._require_tool_call,
                        )
                        if dry_run:
                            yield request_data
                            return

                        step_progression, step_metrics = self._step_checkpoint_llm_request_start(step_metrics, agent_step_span)

                        invocation = llm_adapter.invoke_llm(
                            request_data=request_data,
                            messages=messages,
                            tools=valid_tools,
                            use_assistant_message=False,  # NOTE: set to false
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
            # NOTE: in v3 loop, no tool call is OK
            # if tool_call is None and llm_adapter.tool_call is None:

            persisted_messages, self.should_continue, self.stop_reason = await self._handle_ai_response(
                tool_call=tool_call or llm_adapter.tool_call,
                valid_tool_names=[tool["name"] for tool in valid_tools],
                agent_state=self.agent_state,
                tool_rules_solver=self.tool_rules_solver,
                usage=UsageStatistics(
                    completion_tokens=self.usage.completion_tokens,
                    prompt_tokens=self.usage.prompt_tokens,
                    total_tokens=self.usage.total_tokens,
                ),
                # reasoning_content=reasoning_content or llm_adapter.reasoning_content,
                content=content or llm_adapter.content,
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
            # NOTE: there is an edge case where persisted_messages is empty (the LLM did a "no-op")

            new_message_idx = len(input_messages_to_persist) if input_messages_to_persist else 0
            self.response_messages.extend(persisted_messages[new_message_idx:])

            if llm_adapter.supports_token_streaming():
                # Stream the tool return if a tool was actually executed.
                # In the normal streaming path, the tool call is surfaced via the streaming interface
                # (llm_adapter.tool_call), so don't rely solely on the local `tool_call` variable.
                has_tool_return = any(m.role == "tool" for m in persisted_messages)
                if len(persisted_messages) > 0 and persisted_messages[-1].role != "approval" and has_tool_return:
                    tool_return = [msg for msg in persisted_messages if msg.role == "tool"][-1].to_letta_messages()[0]
                    if include_return_message_types is None or tool_return.message_type in include_return_message_types:
                        yield tool_return
            else:
                filter_user_messages = [m for m in persisted_messages[new_message_idx:] if m.role != "user"]
                letta_messages = Message.to_letta_messages_from_list(
                    filter_user_messages,
                    use_assistant_message=False,  # NOTE: set to false
                    reverse=False,
                    # text_is_assistant_message=(self.agent_state.agent_type == AgentType.react_agent),
                    text_is_assistant_message=True,
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
            # TODO should we be logging this even if persisted_messages is empty? Technically, there still was an LLM call
            step_progression, step_metrics = await self._step_checkpoint_finish(step_metrics, agent_step_span, logged_step)
        except Exception as e:
            import traceback

            self.logger.error(f"Error during step processing: {e}")
            self.logger.error(f"Error traceback: {traceback.format_exc()}")
            # self.logger.error(f"Error during step processing: {e}")
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
                            run_id=run_id,
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

    @trace_method
    async def _handle_ai_response(
        self,
        tool_call: Optional[ToolCall],  # NOTE: should only be None for react agents
        valid_tool_names: list[str],
        agent_state: AgentState,
        tool_rules_solver: ToolRulesSolver,
        usage: UsageStatistics,
        # reasoning_content: list[TextContent | ReasoningContent | RedactedReasoningContent | OmittedReasoningContent] | None = None,
        content: list[TextContent | ReasoningContent | RedactedReasoningContent | OmittedReasoningContent] | None = None,
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
        if tool_call is None:
            # NOTE: in v3 loop, no tool call is OK
            tool_call_id = None
        else:
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
                # NOTE: we may need to change this to not have a "heartbeat" prefix for v3?
                heartbeat_reason=f"{NON_USER_MSG_PREFIX}Continuing: user denied request to call tool.",
                reasoning_content=None,
                pre_computed_assistant_message_id=None,
                step_id=step_id,
                run_id=run_id,
                is_approval_response=True,
                force_set_request_heartbeat=False,
                add_heartbeat_on_continue=False,
            )
            messages_to_persist = (initial_messages or []) + tool_call_messages

            # Set run_id on all messages before persisting
            for message in messages_to_persist:
                if message.run_id is None:
                    message.run_id = run_id

            persisted_messages = await self.message_manager.create_many_messages_async(
                messages_to_persist,
                actor=self.actor,
                run_id=run_id,
                project_id=agent_state.project_id,
                template_id=agent_state.template_id,
            )
            return persisted_messages, continue_stepping, stop_reason

        # -1. no tool call, no content
        if tool_call is None and (content is None or len(content) == 0):
            # Edge case is when there's also no content - basically, the LLM "no-op'd"
            # In this case, we actually do not want to persist the no-op message
            continue_stepping, heartbeat_reason, stop_reason = False, None, LettaStopReason(stop_reason=StopReasonType.end_turn.value)
            messages_to_persist = initial_messages or []

        # 0. If there's no tool call, we can early exit
        elif tool_call is None:
            # TODO could just hardcode the line here instead of calling the function...
            continue_stepping, heartbeat_reason, stop_reason = self._decide_continuation(
                agent_state=agent_state,
                tool_call_name=None,
                tool_rule_violated=False,
                tool_rules_solver=tool_rules_solver,
                is_final_step=is_final_step,
            )
            assistant_message = create_letta_messages_from_llm_response(
                agent_id=agent_state.id,
                model=agent_state.llm_config.model,
                function_name=None,
                function_arguments=None,
                tool_execution_result=None,
                tool_call_id=None,
                function_response=None,
                timezone=agent_state.timezone,
                continue_stepping=continue_stepping,
                heartbeat_reason=heartbeat_reason,
                # NOTE: should probably rename this to `content`?
                reasoning_content=content,
                pre_computed_assistant_message_id=pre_computed_assistant_message_id,
                step_id=step_id,
                run_id=run_id,
                is_approval_response=is_approval or is_denial,
                force_set_request_heartbeat=False,
                add_heartbeat_on_continue=False,
            )
            messages_to_persist = (initial_messages or []) + assistant_message

        else:
            # 1.  Parse and validate the tool-call envelope
            tool_call_name: str = tool_call.function.name

            tool_args = _safe_load_tool_call_str(tool_call.function.arguments)
            # NOTE: these are failsafes - for v3, we should eventually be able to remove these
            # request_heartbeat: bool = _pop_heartbeat(tool_args)
            tool_args.pop(REQUEST_HEARTBEAT_PARAM, None)
            tool_args.pop(INNER_THOUGHTS_KWARG, None)

            log_telemetry(
                self.logger,
                "_handle_ai_response execute tool start",
                tool_name=tool_call_name,
                tool_args=tool_args,
                tool_call_id=tool_call_id,
                # request_heartbeat=request_heartbeat,
            )

            if not is_approval and tool_rules_solver.is_requires_approval_tool(tool_call_name):
                approval_message = create_approval_request_message_from_llm_response(
                    agent_id=agent_state.id,
                    model=agent_state.llm_config.model,
                    function_name=tool_call_name,
                    function_arguments=tool_args,
                    tool_call_id=tool_call_id,
                    actor=self.actor,
                    # continue_stepping=request_heartbeat,
                    continue_stepping=True,
                    # reasoning_content=reasoning_content,
                    reasoning_content=content,
                    pre_computed_assistant_message_id=pre_computed_assistant_message_id,
                    step_id=step_id,
                    run_id=run_id,
                    append_request_heartbeat=False,
                )
                messages_to_persist = (initial_messages or []) + [approval_message]
                continue_stepping = False
                stop_reason = LettaStopReason(stop_reason=StopReasonType.requires_approval.value)
            else:
                # 2.  Execute the tool (or synthesize an error result if disallowed)
                tool_rule_violated = tool_call_name not in valid_tool_names and not is_approval
                if tool_rule_violated:
                    tool_execution_result = _build_rule_violation_result(tool_call_name, valid_tool_names, tool_rules_solver)
                else:
                    # Prefill + validate args if a rule provided them
                    prefill_args = self.tool_rules_solver.last_prefilled_args_by_tool.get(tool_call_name)
                    if prefill_args:
                        # Find tool object for schema validation
                        target_tool = next((t for t in agent_state.tools if t.name == tool_call_name), None)
                        provenance = self.tool_rules_solver.last_prefilled_args_provenance.get(tool_call_name)
                        try:
                            tool_args = merge_and_validate_prefilled_args(
                                tool=target_tool,
                                llm_args=tool_args,
                                prefilled_args=prefill_args,
                            )
                        except ValueError as ve:
                            # Treat invalid prefilled args as user error and end the step
                            error_prefix = "Invalid prefilled tool arguments from tool rules"
                            prov_suffix = f" (source={provenance})" if provenance else ""
                            err_msg = f"{error_prefix}{prov_suffix}: {str(ve)}"
                            tool_execution_result = ToolExecutionResult(status="error", func_return=err_msg)

                            # Create messages and early return persistence path below
                            continue_stepping, heartbeat_reason, stop_reason = (
                                False,
                                None,
                                LettaStopReason(stop_reason=StopReasonType.invalid_tool_call.value),
                            )
                            tool_call_messages = create_letta_messages_from_llm_response(
                                agent_id=agent_state.id,
                                model=agent_state.llm_config.model,
                                function_name=tool_call_name,
                                function_arguments=tool_args,
                                tool_execution_result=tool_execution_result,
                                tool_call_id=tool_call_id,
                                function_response=tool_execution_result.func_return,
                                timezone=agent_state.timezone,
                                continue_stepping=continue_stepping,
                                heartbeat_reason=None,
                                reasoning_content=content,
                                pre_computed_assistant_message_id=pre_computed_assistant_message_id,
                                step_id=step_id,
                                run_id=run_id,
                                is_approval_response=is_approval or is_denial,
                                force_set_request_heartbeat=False,
                                add_heartbeat_on_continue=False,
                            )
                            messages_to_persist = (initial_messages or []) + tool_call_messages

                            # Set run_id on all messages before persisting
                            for message in messages_to_persist:
                                if message.run_id is None:
                                    message.run_id = run_id

                            persisted_messages = await self.message_manager.create_many_messages_async(
                                messages_to_persist,
                                actor=self.actor,
                                run_id=run_id,
                                project_id=agent_state.project_id,
                                template_id=agent_state.template_id,
                            )
                            return persisted_messages, continue_stepping, stop_reason

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
                    # heartbeat_reason=heartbeat_reason,
                    heartbeat_reason=None,
                    # reasoning_content=reasoning_content,
                    reasoning_content=content,
                    pre_computed_assistant_message_id=pre_computed_assistant_message_id,
                    step_id=step_id,
                    run_id=run_id,
                    is_approval_response=is_approval or is_denial,
                    force_set_request_heartbeat=False,
                    add_heartbeat_on_continue=False,
                )
                messages_to_persist = (initial_messages or []) + tool_call_messages

        # Set run_id on all messages before persisting
        for message in messages_to_persist:
            if message.run_id is None:
                message.run_id = run_id

        persisted_messages = await self.message_manager.create_many_messages_async(
            messages_to_persist, actor=self.actor, run_id=run_id, project_id=agent_state.project_id, template_id=agent_state.template_id
        )

        return persisted_messages, continue_stepping, stop_reason

    @trace_method
    def _decide_continuation(
        self,
        agent_state: AgentState,
        tool_call_name: Optional[str],
        tool_rule_violated: bool,
        tool_rules_solver: ToolRulesSolver,
        is_final_step: bool | None,
    ) -> tuple[bool, str | None, LettaStopReason | None]:
        """
        In v3 loop, we apply the following rules:

        1. Did not call a tool? Loop ends

        2. Called a tool? Loop continues. This can be:
           2a. Called tool, tool executed successfully
           2b. Called tool, tool failed to execute
           2c. Called tool + tool rule violation (did not execute)

        """
        continue_stepping = True  # Default continue
        continuation_reason: str | None = None
        stop_reason: LettaStopReason | None = None

        if tool_call_name is None:
            # No tool call? End loop
            return False, None, LettaStopReason(stop_reason=StopReasonType.end_turn.value)
        else:
            if tool_rule_violated:
                continue_stepping = True
                continuation_reason = f"{NON_USER_MSG_PREFIX}Continuing: tool rule violation."
            else:
                tool_rules_solver.register_tool_call(tool_call_name)

                if tool_rules_solver.is_terminal_tool(tool_call_name):
                    stop_reason = LettaStopReason(stop_reason=StopReasonType.tool_rule.value)
                    continue_stepping = False

                elif tool_rules_solver.has_children_tools(tool_call_name):
                    continue_stepping = True
                    continuation_reason = f"{NON_USER_MSG_PREFIX}Continuing: child tool rule."

                elif tool_rules_solver.is_continue_tool(tool_call_name):
                    continue_stepping = True
                    continuation_reason = f"{NON_USER_MSG_PREFIX}Continuing: continue tool rule."

                # – hard stop overrides –
                if is_final_step:
                    continue_stepping = False
                    stop_reason = LettaStopReason(stop_reason=StopReasonType.max_steps.value)
                else:
                    uncalled = tool_rules_solver.get_uncalled_required_tools(available_tools=set([t.name for t in agent_state.tools]))
                    if uncalled:
                        continue_stepping = True
                        continuation_reason = (
                            f"{NON_USER_MSG_PREFIX}Continuing, user expects these tools: [{', '.join(uncalled)}] to be called still."
                        )

                        stop_reason = None  # reset – we’re still going

            return continue_stepping, continuation_reason, stop_reason

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
            request_heartbeat=False,  # NOTE: difference for v3 (don't add request heartbeat)
            terminal_tools=terminal_tool_names,
        )
        return allowed_tools
