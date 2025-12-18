import asyncio
import json
import uuid
from typing import Any, AsyncGenerator, Dict, Literal, Optional

from opentelemetry.trace import Span

from letta.adapters.letta_llm_adapter import LettaLLMAdapter
from letta.adapters.simple_llm_request_adapter import SimpleLLMRequestAdapter
from letta.adapters.simple_llm_stream_adapter import SimpleLLMStreamAdapter
from letta.agents.helpers import (
    _build_rule_violation_result,
    _load_last_function_response,
    _maybe_get_approval_messages,
    _maybe_get_pending_tool_call_message,
    _prepare_in_context_messages_no_persist_async,
    _safe_load_tool_call_str,
    generate_step_id,
    merge_and_validate_prefilled_args,
)
from letta.agents.letta_agent_v2 import LettaAgentV2
from letta.constants import DEFAULT_MAX_STEPS, NON_USER_MSG_PREFIX, REQUEST_HEARTBEAT_PARAM, SUMMARIZATION_TRIGGER_MULTIPLIER
from letta.errors import ContextWindowExceededError, LLMError, SystemPromptTokenExceededError
from letta.helpers import ToolRulesSolver
from letta.helpers.datetime_helpers import get_utc_time, get_utc_timestamp_ns
from letta.helpers.message_helper import convert_message_creates_to_messages
from letta.helpers.tool_execution_helper import enable_strict_mode
from letta.local_llm.constants import INNER_THOUGHTS_KWARG
from letta.otel.tracing import trace_method
from letta.schemas.agent import AgentState
from letta.schemas.enums import MessageRole
from letta.schemas.letta_message import ApprovalReturn, LettaErrorMessage, LettaMessage, MessageType
from letta.schemas.letta_message_content import OmittedReasoningContent, ReasoningContent, RedactedReasoningContent, TextContent
from letta.schemas.letta_response import LettaResponse
from letta.schemas.letta_stop_reason import LettaStopReason, StopReasonType
from letta.schemas.llm_config import LLMConfig
from letta.schemas.message import Message, MessageCreate, ToolReturn
from letta.schemas.openai.chat_completion_response import FunctionCall, ToolCall, ToolCallDenial, UsageStatistics
from letta.schemas.step import StepProgression
from letta.schemas.step_metrics import StepMetrics
from letta.schemas.tool_execution_result import ToolExecutionResult
from letta.schemas.usage import LettaUsageStatistics
from letta.server.rest_api.utils import (
    create_approval_request_message_from_llm_response,
    create_letta_messages_from_llm_response,
    create_parallel_tool_messages_from_llm_response,
    create_tool_returns_for_denials,
)
from letta.services.helpers.tool_parser_helper import runtime_override_tool_json_schema
from letta.services.summarizer.summarizer_all import summarize_all
from letta.services.summarizer.summarizer_config import CompactionSettings
from letta.services.summarizer.summarizer_sliding_window import (
    count_tokens,
    summarize_via_sliding_window,
)
from letta.settings import settings, summarizer_settings
from letta.system import package_function_response, package_summarize_message_no_counts
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
        # Approximate token count for the *current* in-context buffer, used
        # only for proactive summarization / eviction logic. This is derived
        # from per-step usage but can be updated after summarization without
        # affecting step-level telemetry.
        self.context_token_estimate: int | None = None
        self.in_context_messages: list[Message] = []  # in-memory tracker

    def _compute_tool_return_truncation_chars(self) -> int:
        """Compute a dynamic cap for tool returns in requests.

        Heuristic: ~20% of context window × 4 chars/token, minimum 5k chars.
        This prevents any single tool return from consuming too much context.
        """
        try:
            cap = int(self.agent_state.llm_config.context_window * 0.2 * 4)  # 20% of tokens → chars
        except Exception:
            cap = 5000
        return max(5000, cap)

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
        response_letta_messages = []

        curr_in_context_messages, input_messages_to_persist = await _prepare_in_context_messages_no_persist_async(
            input_messages, self.agent_state, self.message_manager, self.actor, run_id
        )
        follow_up_messages = []
        if len(input_messages_to_persist) > 1 and input_messages_to_persist[0].role == "approval":
            follow_up_messages = input_messages_to_persist[1:]
            input_messages_to_persist = [input_messages_to_persist[0]]

        self.in_context_messages = curr_in_context_messages
        for i in range(max_steps):
            if i == 1 and follow_up_messages:
                input_messages_to_persist = follow_up_messages
                follow_up_messages = []

            response = self._step(
                # we append input_messages_to_persist since they aren't checkpointed as in-context until the end of the step (may be rolled back)
                messages=list(self.in_context_messages + input_messages_to_persist),
                input_messages_to_persist=input_messages_to_persist,
                # TODO need to support non-streaming adapter too
                llm_adapter=SimpleLLMRequestAdapter(llm_client=self.llm_client, llm_config=self.agent_state.llm_config),
                run_id=run_id,
                # use_assistant_message=use_assistant_message,
                include_return_message_types=include_return_message_types,
                request_start_timestamp_ns=request_start_timestamp_ns,
            )
            input_messages_to_persist = []  # clear after first step

            async for chunk in response:
                response_letta_messages.append(chunk)

            # Check if step was cancelled - break out of the step loop
            if not self.should_continue and self.stop_reason.stop_reason == StopReasonType.cancelled.value:
                break

            # TODO: persist the input messages if successful first step completion
            # TODO: persist the new messages / step / run

            ## Proactive summarization if approaching context limit
            # if (
            #    self.context_token_estimate is not None
            #    and self.context_token_estimate > self.agent_state.llm_config.context_window * SUMMARIZATION_TRIGGER_MULTIPLIER
            #    and not self.agent_state.message_buffer_autoclear
            # ):
            #    self.logger.warning(
            #        f"Step usage ({self.last_step_usage.total_tokens} tokens) approaching "
            #        f"context limit ({self.agent_state.llm_config.context_window}), triggering summarization."
            #    )

            #    in_context_messages = await self.summarize_conversation_history(
            #        in_context_messages=in_context_messages,
            #        new_letta_messages=self.response_messages,
            #        total_tokens=self.context_token_estimate,
            #        force=True,
            #    )

            #    # Clear to avoid duplication in next iteration
            #    self.response_messages = []

            if not self.should_continue:
                break

            # input_messages_to_persist = []

            if i == max_steps - 1 and self.stop_reason is None:
                self.stop_reason = LettaStopReason(stop_reason=StopReasonType.max_steps.value)

        ## Rebuild context window after stepping (safety net)
        # if not self.agent_state.message_buffer_autoclear:
        #    if self.context_token_estimate is not None:
        #        await self.summarize_conversation_history(
        #            in_context_messages=in_context_messages,
        #            new_letta_messages=self.response_messages,
        #            total_tokens=self.context_token_estimate,
        #            force=False,
        #        )
        #    else:
        #        self.logger.warning(
        #            "Post-loop summarization skipped: last_step_usage is None. "
        #            "No step completed successfully or usage stats were not updated."
        #        )

        if self.stop_reason is None:
            self.stop_reason = LettaStopReason(stop_reason=StopReasonType.end_turn.value)

        # construct the response
        response_letta_messages = Message.to_letta_messages_from_list(
            self.response_messages,
            use_assistant_message=False,  # NOTE: set to false
            reverse=False,
            text_is_assistant_message=True,
        )
        if include_return_message_types:
            response_letta_messages = [m for m in response_letta_messages if m.message_type in include_return_message_types]
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
        response_letta_messages = []
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
            follow_up_messages = []
            if len(input_messages_to_persist) > 1 and input_messages_to_persist[0].role == "approval":
                follow_up_messages = input_messages_to_persist[1:]
                input_messages_to_persist = [input_messages_to_persist[0]]

            self.in_context_messages = in_context_messages
            for i in range(max_steps):
                if i == 1 and follow_up_messages:
                    input_messages_to_persist = follow_up_messages
                    follow_up_messages = []
                response = self._step(
                    # we append input_messages_to_persist since they aren't checkpointed as in-context until the end of the step (may be rolled back)
                    messages=list(self.in_context_messages + input_messages_to_persist),
                    input_messages_to_persist=input_messages_to_persist,
                    llm_adapter=llm_adapter,
                    run_id=run_id,
                    # use_assistant_message=use_assistant_message,
                    include_return_message_types=include_return_message_types,
                    request_start_timestamp_ns=request_start_timestamp_ns,
                )
                input_messages_to_persist = []  # clear after first step
                async for chunk in response:
                    response_letta_messages.append(chunk)
                    if first_chunk:
                        request_span = self._request_checkpoint_ttft(request_span, request_start_timestamp_ns)
                    yield f"data: {chunk.model_dump_json()}\n\n"
                    first_chunk = False

                # Check if step was cancelled - break out of the step loop
                if not self.should_continue and self.stop_reason.stop_reason == StopReasonType.cancelled.value:
                    break

                # refresh in-context messages (TODO: remove?)
                # in_context_messages = await self._refresh_messages(in_context_messages)

                if not self.should_continue:
                    break

                if i == max_steps - 1 and self.stop_reason is None:
                    self.stop_reason = LettaStopReason(stop_reason=StopReasonType.max_steps.value)

            ## Rebuild context window after stepping (safety net)
            # if not self.agent_state.message_buffer_autoclear:
            #    if self.context_token_estimate is not None:
            #        await self.summarize_conversation_history(
            #            in_context_messages=in_context_messages,
            #            new_letta_messages=self.response_messages,
            #            total_tokens=self.context_token_estimate,
            #            force=False,
            #        )
            #    else:
            #        self.logger.warning(
            #            "Post-loop summarization skipped: last_step_usage is None. "
            #            "No step completed successfully or usage stats were not updated."
            #        )

            if self.stop_reason is None:
                self.stop_reason = LettaStopReason(stop_reason=StopReasonType.end_turn.value)

        except Exception as e:
            self.logger.warning(f"Error during agent stream: {e}", exc_info=True)

            # Set stop_reason if not already set
            if self.stop_reason is None:
                # Classify error type
                if isinstance(e, LLMError):
                    self.stop_reason = LettaStopReason(stop_reason=StopReasonType.llm_api_error.value)
                else:
                    self.stop_reason = LettaStopReason(stop_reason=StopReasonType.error.value)

            if first_chunk:
                # Raise if no chunks sent yet (response not started, can return error status code)
                raise
            else:
                yield f"data: {self.stop_reason.model_dump_json()}\n\n"

                # Mid-stream error: yield error event to client in SSE format
                error_message = LettaErrorMessage(
                    run_id=run_id,
                    error_type="internal_error",
                    message="An error occurred during agent execution.",
                    detail=str(e),
                )
                yield f"event: error\ndata: {error_message.model_dump_json()}\n\n"

                # Return immediately - don't fall through to finish chunks
                # This prevents sending end_turn finish chunks after an error
                return

        # Cleanup and finalize (only runs if no exception occurred)
        try:
            if run_id:
                # Filter out LettaStopReason from messages (only valid in LettaStreamingResponse, not LettaResponse)
                filtered_messages = [m for m in response_letta_messages if not isinstance(m, LettaStopReason)]
                result = LettaResponse(messages=filtered_messages, stop_reason=self.stop_reason, usage=self.usage)
                if self.job_update_metadata is None:
                    self.job_update_metadata = {}
                self.job_update_metadata["result"] = result.model_dump(mode="json")

            await self._request_checkpoint_finish(
                request_span=request_span, request_start_timestamp_ns=request_start_timestamp_ns, run_id=run_id
            )
            for finish_chunk in self.get_finish_chunks_for_stream(self.usage, self.stop_reason):
                yield f"data: {finish_chunk}\n\n"
        except Exception as cleanup_error:
            # Error during cleanup/finalization - ensure we still send a terminal event
            self.logger.error(f"Error during stream cleanup: {cleanup_error}", exc_info=True)

            # Set stop_reason if not already set
            if self.stop_reason is None:
                self.stop_reason = LettaStopReason(stop_reason=StopReasonType.error.value)

            yield f"data: {self.stop_reason.model_dump_json()}\n\n"

            # Send error event
            error_message = LettaErrorMessage(
                run_id=run_id,
                error_type="cleanup_error",
                message="An error occurred during stream finalization.",
                detail=str(cleanup_error),
            )
            yield f"event: error\ndata: {error_message.model_dump_json()}\n\n"
            # Note: we don't send finish chunks here since we already errored

    async def _check_for_system_prompt_overflow(self, system_message):
        """
        Since the system prompt cannot be compacted, we need to check to see if it is the cause of the context overflow
        """
        system_prompt_token_estimate = await count_tokens(
            actor=self.actor,
            llm_config=self.agent_state.llm_config,
            messages=[system_message],
        )
        if system_prompt_token_estimate is not None and system_prompt_token_estimate >= self.agent_state.llm_config.context_window:
            self.should_continue = False
            self.stop_reason = LettaStopReason(stop_reason=StopReasonType.context_window_overflow_in_system_prompt.value)
            raise SystemPromptTokenExceededError(
                system_prompt_token_estimate=system_prompt_token_estimate,
                context_window=self.agent_state.llm_config.context_window,
            )

    async def _checkpoint_messages(self, run_id: str, step_id: str, new_messages: list[Message], in_context_messages: list[Message]):
        """
        Checkpoint the current message state - run this only when the current messages are 'safe' - meaning the step has completed successfully.

        This handles:
        - Persisting the new messages into the `messages` table
        - Updating the in-memory trackers for in-context messages (`self.in_context_messages`) and agent state (`self.agent_state.message_ids`)
        - Updating the DB with the current in-context messages (`self.agent_state.message_ids`)

        Args:
            run_id: The run ID to associate with the messages
            step_id: The step ID to associate with the messages
            new_messages: The new messages to persist
            in_context_messages: The current in-context messages
        """
        # make sure all the new messages have the correct run_id and step_id
        for message in new_messages:
            message.step_id = step_id
            message.run_id = run_id

        # persist the new message objects - ONLY place where messages are persisted
        persisted_messages = await self.message_manager.create_many_messages_async(
            new_messages,
            actor=self.actor,
            run_id=run_id,
            project_id=self.agent_state.project_id,
            template_id=self.agent_state.template_id,
        )

        # persist the in-context messages
        # TODO: somehow make sure all the message ids are already persisted
        await self.agent_manager.update_message_ids_async(
            agent_id=self.agent_state.id,
            message_ids=[m.id for m in in_context_messages],
            actor=self.actor,
        )
        self.agent_state.message_ids = [m.id for m in in_context_messages]  # update in-memory state
        self.in_context_messages = in_context_messages  # update in-memory state

    @trace_method
    async def _step(
        self,
        messages: list[Message],  # current in-context messages
        llm_adapter: LettaLLMAdapter,
        input_messages_to_persist: list[Message] | None = None,
        run_id: str | None = None,
        # use_assistant_message: bool = True,
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
            include_return_message_types: Filter for which message types to yield
            request_start_timestamp_ns: Start time for tracking request duration
            remaining_turns: Number of turns remaining (for max_steps enforcement)
            dry_run: If true, only build and return the request without executing

        Yields:
            LettaMessage or dict: Chunks for streaming mode, or request data for dry_run
        """
        if enforce_run_id_set and run_id is None:
            raise AssertionError("run_id is required when enforce_run_id_set is True")

        input_messages_to_persist = input_messages_to_persist or []

        if self.context_token_estimate is None:
            self.logger.warning("Context token estimate is not set")

        step_progression = StepProgression.START
        # TODO(@caren): clean this up
        tool_calls, content, agent_step_span, first_chunk, step_id, logged_step, step_start_ns, step_metrics = (
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

            # Always refresh messages at the start of each step to pick up external inputs
            # (e.g., approval responses submitted by the client while this stream is running)
            try:
                # TODO: cleanup and de-dup
                # updates the system prompt with the latest blocks / message histories
                messages = await self._refresh_messages(messages)

            except Exception as e:
                self.logger.warning(f"Failed to refresh messages at step start: {e}")

            approval_request, approval_response = _maybe_get_approval_messages(messages)
            tool_call_denials, tool_returns = [], []
            if approval_request and approval_response:
                # case of handling approval responses
                content = approval_request.content

                # Get tool calls that are pending
                backfill_tool_call_id = approval_request.tool_calls[0].id  # legacy case
                if approval_response.approvals:
                    approved_tool_call_ids = {
                        backfill_tool_call_id if a.tool_call_id.startswith("message-") else a.tool_call_id
                        for a in approval_response.approvals
                        if isinstance(a, ApprovalReturn) and a.approve
                    }
                else:
                    approved_tool_call_ids = {}
                tool_calls = [tool_call for tool_call in approval_request.tool_calls if tool_call.id in approved_tool_call_ids]
                pending_tool_call_message = _maybe_get_pending_tool_call_message(messages)
                if pending_tool_call_message:
                    tool_calls.extend(pending_tool_call_message.tool_calls)

                # Get tool calls that were denied
                if approval_response.approvals:
                    denies = {d.tool_call_id: d for d in approval_response.approvals if isinstance(d, ApprovalReturn) and not d.approve}
                else:
                    denies = {}
                tool_call_denials = [
                    ToolCallDenial(**t.model_dump(), reason=denies.get(t.id).reason) for t in approval_request.tool_calls if t.id in denies
                ]

                # Get tool calls that were executed client side
                if approval_response.approvals:
                    tool_returns = [r for r in approval_response.approvals if isinstance(r, ToolReturn)]

                # Validate that the approval response contains meaningful data
                # If all three lists are empty, this is a malformed approval response
                if not tool_calls and not tool_call_denials and not tool_returns:
                    self.logger.error(
                        f"Invalid approval response: approval_response.approvals is {approval_response.approvals} "
                        f"but no tool calls, denials, or returns were extracted. "
                        f"This likely indicates a corrupted or malformed approval payload."
                    )
                    self.should_continue = False
                    self.stop_reason = LettaStopReason(stop_reason=StopReasonType.invalid_tool_call.value)
                    return

                step_id = approval_request.step_id
                step_metrics = await self.step_manager.get_step_metrics_async(step_id=step_id, actor=self.actor)
            else:
                # Check for job cancellation at the start of each step
                if run_id and await self._check_run_cancellation(run_id):
                    self.should_continue = False
                    self.stop_reason = LettaStopReason(stop_reason=StopReasonType.cancelled.value)
                    self.logger.info(f"Agent execution cancelled for run {run_id}")
                    return

                step_id = generate_step_id()
                step_progression, logged_step, step_metrics, agent_step_span = await self._step_checkpoint_start(
                    step_id=step_id, run_id=run_id
                )

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
                            tool_return_truncation_chars=self._compute_tool_return_truncation_chars(),
                        )
                        # TODO: Extend to more providers, and also approval tool rules
                        # TODO: this entire code block should be inside of the clients
                        # Enable parallel tool use when no tool rules are attached
                        try:
                            no_tool_rules = (
                                not self.agent_state.tool_rules
                                or len([t for t in self.agent_state.tool_rules if t.type != "requires_approval"]) == 0
                            )

                            # Anthropic/Bedrock parallel tool use
                            if self.agent_state.llm_config.model_endpoint_type in ["anthropic", "bedrock"]:
                                if (
                                    isinstance(request_data.get("tool_choice"), dict)
                                    and "disable_parallel_tool_use" in request_data["tool_choice"]
                                ):
                                    # Gate parallel tool use on both: no tool rules and toggled on
                                    if no_tool_rules and self.agent_state.llm_config.parallel_tool_calls:
                                        request_data["tool_choice"]["disable_parallel_tool_use"] = False
                                    else:
                                        # Explicitly disable when tool rules present or llm_config toggled off
                                        request_data["tool_choice"]["disable_parallel_tool_use"] = True

                            # OpenAI parallel tool use
                            elif self.agent_state.llm_config.model_endpoint_type == "openai":
                                # For OpenAI, we control parallel tool calling via parallel_tool_calls field
                                # Only allow parallel tool calls when no tool rules and enabled in config
                                if "parallel_tool_calls" in request_data:
                                    if no_tool_rules and self.agent_state.llm_config.parallel_tool_calls:
                                        request_data["parallel_tool_calls"] = True
                                    else:
                                        request_data["parallel_tool_calls"] = False

                            # Gemini (Google AI/Vertex) parallel tool use
                            elif self.agent_state.llm_config.model_endpoint_type in ["google_ai", "google_vertex"]:
                                # Gemini supports parallel tool calling natively through multiple parts in the response
                                # We just need to ensure the config flag is set for tracking purposes
                                # The actual handling happens in GoogleVertexClient.convert_response_to_chat_completion
                                pass  # No specific request_data field needed for Gemini
                        except Exception:
                            # if this fails, we simply don't enable parallel tool use
                            pass
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
                            self.logger.info(
                                f"Context window exceeded (error {e}), trying to compact messages attempt {llm_request_attempt + 1} of {summarizer_settings.max_summarizer_retries + 1}"
                            )
                            # checkpoint summarized messages
                            # TODO: might want to delay this checkpoint in case of corrupated state
                            try:
                                summary_message, messages = await self.compact(
                                    messages, trigger_threshold=self.agent_state.llm_config.context_window
                                )
                                self.logger.info("Summarization succeeded, continuing to retry LLM request")
                                continue
                            except SystemPromptTokenExceededError:
                                self.stop_reason = LettaStopReason(
                                    stop_reason=StopReasonType.context_window_overflow_in_system_prompt.value
                                )
                                raise e
                            except Exception as e:
                                self.stop_reason = LettaStopReason(stop_reason=StopReasonType.error.value)
                                self.logger.error(f"Unknown error occured for summarization run {run_id}: {e}")
                                raise e

                            # update the messages
                            await self._checkpoint_messages(
                                run_id=run_id, step_id=step_id, new_messages=[summary_message], in_context_messages=messages
                            )

                        else:
                            self.stop_reason = LettaStopReason(stop_reason=StopReasonType.error.value)
                            self.logger.error(f"Unknown error occured for run {run_id}: {e}")
                            raise e

                step_progression, step_metrics = self._step_checkpoint_llm_request_finish(
                    step_metrics, agent_step_span, llm_adapter.llm_request_finish_timestamp_ns
                )
                # update metrics
                self._update_global_usage_stats(llm_adapter.usage)
                self.context_token_estimate = llm_adapter.usage.total_tokens
                self.logger.info(f"Context token estimate after LLM request: {self.context_token_estimate}")

                # Handle the AI response with the extracted data (supports multiple tool calls)
                # Gather tool calls - check for multi-call API first, then fall back to single
                if hasattr(llm_adapter, "tool_calls") and llm_adapter.tool_calls:
                    tool_calls = llm_adapter.tool_calls
                elif llm_adapter.tool_call is not None:
                    tool_calls = [llm_adapter.tool_call]
                else:
                    tool_calls = []

            # get the new generated `Message` objects from handling the LLM response
            new_messages, self.should_continue, self.stop_reason = await self._handle_ai_response(
                tool_calls=tool_calls,
                valid_tool_names=[tool["name"] for tool in valid_tools],
                tool_rules_solver=self.tool_rules_solver,
                usage=UsageStatistics(
                    completion_tokens=self.usage.completion_tokens,
                    prompt_tokens=self.usage.prompt_tokens,
                    total_tokens=self.usage.total_tokens,
                ),
                content=content or llm_adapter.content,
                pre_computed_assistant_message_id=llm_adapter.message_id,
                step_id=step_id,
                initial_messages=[],  # input_messages_to_persist, # TODO: deprecate - super confusing
                agent_step_span=agent_step_span,
                is_final_step=(remaining_turns == 0),
                run_id=run_id,
                step_metrics=step_metrics,
                is_approval_response=approval_response is not None,
                tool_call_denials=tool_call_denials,
                tool_returns=tool_returns,
                finish_reason=llm_adapter.finish_reason,
            )

            # extend trackers with new messages
            self.response_messages.extend(new_messages)
            messages.extend(new_messages)

            # step(...) has successfully completed! now we can persist messages and update the in-context messages + save metrics
            # persistence needs to happen before streaming to minimize chances of agent getting into an inconsistent state
            step_progression, step_metrics = await self._step_checkpoint_finish(step_metrics, agent_step_span, logged_step)
            await self._checkpoint_messages(
                run_id=run_id,
                step_id=step_id,
                new_messages=input_messages_to_persist + new_messages,
                in_context_messages=messages,  # update the in-context messages
            )

            # yield back generated messages
            if llm_adapter.supports_token_streaming():
                if tool_calls:
                    # Stream each tool return if tools were executed
                    response_tool_returns = [msg for msg in new_messages if msg.role == "tool"]
                    for tr in response_tool_returns:
                        # Skip streaming for aggregated parallel tool returns (no per-call tool_call_id)
                        if tr.tool_call_id is None and tr.tool_returns:
                            continue
                        tool_return_letta = tr.to_letta_messages()[0]
                        if include_return_message_types is None or tool_return_letta.message_type in include_return_message_types:
                            yield tool_return_letta
            else:
                # TODO: modify this use step_response_messages
                filter_user_messages = [m for m in new_messages if m.role != "user"]
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

            # check compaction
            if self.context_token_estimate is not None and self.context_token_estimate > self.agent_state.llm_config.context_window:
                self.logger.info(
                    f"Context window exceeded (current: {self.context_token_estimate}, threshold: {self.agent_state.llm_config.context_window}), trying to compact messages"
                )
                summary_message, messages = await self.compact(messages, trigger_threshold=self.agent_state.llm_config.context_window)
                # TODO: persist + return the summary message
                # TODO: convert this to a SummaryMessage
                self.response_messages.append(summary_message)
                for message in Message.to_letta_messages(summary_message):
                    yield message
                await self._checkpoint_messages(
                    run_id=run_id, step_id=step_id, new_messages=[summary_message], in_context_messages=messages
                )

        except Exception as e:
            # NOTE: message persistence does not happen in the case of an exception (rollback to previous state)
            self.logger.warning(f"Error during step processing: {e}")
            self.job_update_metadata = {"error": str(e)}

            # This indicates we failed after we decided to stop stepping, which indicates a bug with our flow.
            if not self.stop_reason:
                self.stop_reason = LettaStopReason(stop_reason=StopReasonType.error.value)
            elif self.stop_reason.stop_reason in (StopReasonType.end_turn, StopReasonType.max_steps, StopReasonType.tool_rule):
                self.logger.warning("Error occurred during step processing, with valid stop reason: %s", self.stop_reason.stop_reason)
            elif self.stop_reason.stop_reason not in (
                StopReasonType.no_tool_call,
                StopReasonType.invalid_tool_call,
                StopReasonType.invalid_llm_response,
                StopReasonType.llm_api_error,
                StopReasonType.context_window_overflow_in_system_prompt,
            ):
                self.logger.warning("Error occurred during step processing, with unexpected stop reason: %s", self.stop_reason.stop_reason)
            raise e
        finally:
            # always make sure we update the step/run metadata
            self.logger.debug("Running cleanup for agent loop run: %s", run_id)
            self.logger.info("Running final update. Step Progression: %s", step_progression)
            try:
                if step_progression == StepProgression.FINISHED:
                    if not self.should_continue:
                        if self.stop_reason is None:
                            self.stop_reason = LettaStopReason(stop_reason=StopReasonType.end_turn.value)
                        if logged_step and step_id:
                            await self.step_manager.update_step_stop_reason(self.actor, step_id, self.stop_reason.stop_reason)
                    if not self.stop_reason or self.stop_reason.stop_reason != StopReasonType.context_window_overflow_in_system_prompt:
                        # only return if the stop reason is not context window overflow in system prompt
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
                elif step_progression <= StepProgression.LOGGED_TRACE:
                    if self.stop_reason is None:
                        self.logger.warning("Error in step after logging step")
                        self.stop_reason = LettaStopReason(stop_reason=StopReasonType.error.value)
                    if logged_step:
                        await self.step_manager.update_step_stop_reason(self.actor, step_id, self.stop_reason.stop_reason)
                else:
                    self.logger.warning("Invalid StepProgression value")

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
                self.logger.warning(f"Error during post-completion step tracking: {e}")

    @trace_method
    async def _handle_ai_response(
        self,
        valid_tool_names: list[str],
        tool_rules_solver: ToolRulesSolver,
        usage: UsageStatistics,
        content: list[TextContent | ReasoningContent | RedactedReasoningContent | OmittedReasoningContent] | None = None,
        pre_computed_assistant_message_id: str | None = None,
        step_id: str | None = None,
        initial_messages: list[Message] | None = None,
        agent_step_span: Span | None = None,
        is_final_step: bool | None = None,
        run_id: str | None = None,
        step_metrics: StepMetrics = None,
        is_approval_response: bool | None = None,
        tool_calls: list[ToolCall] = [],
        tool_call_denials: list[ToolCallDenial] = [],
        tool_returns: list[ToolReturn] = [],
        finish_reason: str | None = None,
    ) -> tuple[list[Message], bool, LettaStopReason | None]:
        """
        Handle the final AI response once streaming completes, execute / validate tool calls,
        decide whether we should keep stepping, and persist state.

        Unified approach: treats single and multi-tool calls uniformly to reduce code duplication.
        """

        # 1. Handle no-tool cases (content-only or no-op)
        if not tool_calls and not tool_call_denials and not tool_returns:
            # Case 1a: No tool call, no content (LLM no-op)
            if content is None or len(content) == 0:
                # Check if there are required-before-exit tools that haven't been called
                uncalled = tool_rules_solver.get_uncalled_required_tools(available_tools=set([t.name for t in self.agent_state.tools]))
                if uncalled:
                    heartbeat_reason = (
                        f"{NON_USER_MSG_PREFIX}ToolRuleViolated: You must call {', '.join(uncalled)} at least once to exit the loop."
                    )
                    from letta.server.rest_api.utils import create_heartbeat_system_message

                    heartbeat_msg = create_heartbeat_system_message(
                        agent_id=self.agent_state.id,
                        model=self.agent_state.llm_config.model,
                        function_call_success=True,
                        timezone=self.agent_state.timezone,
                        heartbeat_reason=heartbeat_reason,
                        run_id=run_id,
                    )
                    messages_to_persist = (initial_messages or []) + [heartbeat_msg]
                    continue_stepping, stop_reason = True, None
                else:
                    # No required tools remaining, end turn without persisting no-op
                    continue_stepping = False
                    stop_reason = LettaStopReason(stop_reason=StopReasonType.end_turn.value)
                    messages_to_persist = initial_messages or []

            # Case 1b: No tool call but has content
            else:
                continue_stepping, heartbeat_reason, stop_reason = self._decide_continuation(
                    agent_state=self.agent_state,
                    tool_call_name=None,
                    tool_rule_violated=False,
                    tool_rules_solver=tool_rules_solver,
                    is_final_step=is_final_step,
                    finish_reason=finish_reason,
                )
                assistant_message = create_letta_messages_from_llm_response(
                    agent_id=self.agent_state.id,
                    model=self.agent_state.llm_config.model,
                    function_name=None,
                    function_arguments=None,
                    tool_execution_result=None,
                    tool_call_id=None,
                    function_response=None,
                    timezone=self.agent_state.timezone,
                    continue_stepping=continue_stepping,
                    heartbeat_reason=heartbeat_reason,
                    reasoning_content=content,
                    pre_computed_assistant_message_id=pre_computed_assistant_message_id,
                    step_id=step_id,
                    run_id=run_id,
                    is_approval_response=is_approval_response,
                    force_set_request_heartbeat=False,
                    add_heartbeat_on_continue=bool(heartbeat_reason),
                )
                messages_to_persist = (initial_messages or []) + assistant_message
            return messages_to_persist, continue_stepping, stop_reason

        # 2. Check whether tool call requires approval
        if not is_approval_response:
            requested_tool_calls = [t for t in tool_calls if tool_rules_solver.is_requires_approval_tool(t.function.name)]
            allowed_tool_calls = [t for t in tool_calls if not tool_rules_solver.is_requires_approval_tool(t.function.name)]
            if requested_tool_calls:
                approval_messages = create_approval_request_message_from_llm_response(
                    agent_id=self.agent_state.id,
                    model=self.agent_state.llm_config.model,
                    requested_tool_calls=requested_tool_calls,
                    allowed_tool_calls=allowed_tool_calls,
                    reasoning_content=content,
                    pre_computed_assistant_message_id=pre_computed_assistant_message_id,
                    step_id=step_id,
                    run_id=run_id,
                )
                messages_to_persist = (initial_messages or []) + approval_messages
                return messages_to_persist, False, LettaStopReason(stop_reason=StopReasonType.requires_approval.value)

        result_tool_returns = []

        # 3. Handle client side tool execution
        if tool_returns:
            # Clamp client-side tool returns before persisting (JSON-aware: truncate only the 'message' field)
            try:
                cap = self._compute_tool_return_truncation_chars()
            except Exception:
                cap = 5000

            for tr in tool_returns:
                try:
                    if tr.func_response and isinstance(tr.func_response, str):
                        parsed = json.loads(tr.func_response)
                        if isinstance(parsed, dict) and "message" in parsed and isinstance(parsed["message"], str):
                            msg = parsed["message"]
                            if len(msg) > cap:
                                original_len = len(msg)
                                parsed["message"] = msg[:cap] + f"... [truncated {original_len - cap} chars]"
                                tr.func_response = json.dumps(parsed)
                                self.logger.warning(f"Truncated client-side tool return message from {original_len} to {cap} chars")
                        else:
                            # Fallback to raw string truncation if not a dict with 'message'
                            if len(tr.func_response) > cap:
                                original_len = len(tr.func_response)
                                tr.func_response = tr.func_response[:cap] + f"... [truncated {original_len - cap} chars]"
                                self.logger.warning(f"Truncated client-side tool return (raw) from {original_len} to {cap} chars")
                except json.JSONDecodeError:
                    # Non-JSON or unexpected shape; truncate as raw string
                    if tr.func_response and len(tr.func_response) > cap:
                        original_len = len(tr.func_response)
                        tr.func_response = tr.func_response[:cap] + f"... [truncated {original_len - cap} chars]"
                        self.logger.warning(f"Truncated client-side tool return (non-JSON) from {original_len} to {cap} chars")
                except Exception as e:
                    # Unexpected error; log and skip truncation for this return
                    self.logger.warning(f"Failed to truncate client-side tool return: {e}")

            continue_stepping = True
            stop_reason = None
            result_tool_returns = tool_returns

        # 4. Handle denial cases
        if tool_call_denials:
            # Convert ToolCallDenial objects to ToolReturn objects using shared helper
            # Group denials by reason to potentially batch them, but for now process individually
            for tool_call_denial in tool_call_denials:
                denial_returns = create_tool_returns_for_denials(
                    tool_calls=[tool_call_denial],
                    denial_reason=tool_call_denial.reason,
                    timezone=self.agent_state.timezone,
                )
                result_tool_returns.extend(denial_returns)

        # 5. Unified tool execution path (works for both single and multiple tools)

        # 5a. Validate parallel tool calling constraints
        if len(tool_calls) > 1:
            # No parallel tool calls with tool rules
            if self.agent_state.tool_rules and len([r for r in self.agent_state.tool_rules if r.type != "requires_approval"]) > 0:
                raise ValueError(
                    "Parallel tool calling is not allowed when tool rules are present. Disable tool rules to use parallel tool calls."
                )

        # 5b. Prepare execution specs for all tools
        exec_specs = []
        for tc in tool_calls:
            call_id = tc.id or f"call_{uuid.uuid4().hex[:8]}"
            name = tc.function.name
            args = _safe_load_tool_call_str(tc.function.arguments)
            args.pop(REQUEST_HEARTBEAT_PARAM, None)
            args.pop(INNER_THOUGHTS_KWARG, None)

            # Validate against allowed tools
            tool_rule_violated = name not in valid_tool_names and not is_approval_response

            # Handle prefilled args if present
            if not tool_rule_violated:
                prefill_args = tool_rules_solver.last_prefilled_args_by_tool.get(name)
                if prefill_args:
                    target_tool = next((t for t in self.agent_state.tools if t.name == name), None)
                    provenance = tool_rules_solver.last_prefilled_args_provenance.get(name)
                    try:
                        args = merge_and_validate_prefilled_args(
                            tool=target_tool,
                            llm_args=args,
                            prefilled_args=prefill_args,
                        )
                    except ValueError as ve:
                        # Invalid prefilled args - create error result
                        error_prefix = "Invalid prefilled tool arguments from tool rules"
                        prov_suffix = f" (source={provenance})" if provenance else ""
                        err_msg = f"{error_prefix}{prov_suffix}: {str(ve)}"

                        exec_specs.append(
                            {
                                "id": call_id,
                                "name": name,
                                "args": args,
                                "violated": False,
                                "error": err_msg,
                            }
                        )
                        continue

            exec_specs.append(
                {
                    "id": call_id,
                    "name": name,
                    "args": args,
                    "violated": tool_rule_violated,
                    "error": None,
                }
            )

        # 5c. Execute tools (sequentially for single, parallel for multiple)
        async def _run_one(spec: Dict[str, Any]):
            if spec.get("error"):
                return ToolExecutionResult(status="error", func_return=spec["error"]), 0
            if spec["violated"]:
                result = _build_rule_violation_result(spec["name"], valid_tool_names, tool_rules_solver)
                return result, 0
            t0 = get_utc_timestamp_ns()
            target_tool = next((x for x in self.agent_state.tools if x.name == spec["name"]), None)
            res = await self._execute_tool(
                target_tool=target_tool,
                tool_args=spec["args"],
                agent_state=self.agent_state,
                agent_step_span=agent_step_span,
                step_id=step_id,
            )
            dt = get_utc_timestamp_ns() - t0
            return res, dt

        if len(exec_specs) == 1:
            results = [await _run_one(exec_specs[0])]
        else:
            # separate tools by parallel execution capability
            parallel_items = []
            serial_items = []

            for idx, spec in enumerate(exec_specs):
                target_tool = next((x for x in self.agent_state.tools if x.name == spec["name"]), None)
                if target_tool and target_tool.enable_parallel_execution:
                    parallel_items.append((idx, spec))
                else:
                    serial_items.append((idx, spec))

            # execute all parallel tools concurrently and all serial tools sequentially
            results = [None] * len(exec_specs)

            parallel_results = await asyncio.gather(*[_run_one(spec) for _, spec in parallel_items]) if parallel_items else []
            for (idx, _), result in zip(parallel_items, parallel_results):
                results[idx] = result

            for idx, spec in serial_items:
                results[idx] = await _run_one(spec)

        # 5d. Update metrics with execution time
        if step_metrics is not None and results:
            step_metrics.tool_execution_ns = max(dt for _, dt in results)

        # 5e. Process results and compute function responses
        function_responses: list[Optional[str]] = []
        persisted_continue_flags: list[bool] = []
        persisted_stop_reasons: list[LettaStopReason | None] = []

        for idx, spec in enumerate(exec_specs):
            tool_execution_result, _ = results[idx]
            has_prefill_error = bool(spec.get("error"))

            # Validate and format function response
            truncate = spec["name"] not in {"conversation_search", "conversation_search_date", "archival_memory_search"}
            return_char_limit = next((t.return_char_limit for t in self.agent_state.tools if t.name == spec["name"]), None)
            function_response_string = validate_function_response(
                tool_execution_result.func_return,
                return_char_limit=return_char_limit,
                truncate=truncate,
            )
            function_responses.append(function_response_string)

            # Update last function response (for tool rules)
            self.last_function_response = package_function_response(
                was_success=tool_execution_result.success_flag,
                response_string=function_response_string,
                timezone=self.agent_state.timezone,
            )

            # Register successful tool call with solver
            if not spec["violated"] and not has_prefill_error:
                tool_rules_solver.register_tool_call(spec["name"])

            # Decide continuation for this tool
            if has_prefill_error:
                cont = False
                hb_reason = None
                sr = LettaStopReason(stop_reason=StopReasonType.invalid_tool_call.value)
            else:
                cont, hb_reason, sr = self._decide_continuation(
                    agent_state=self.agent_state,
                    tool_call_name=spec["name"],
                    tool_rule_violated=spec["violated"],
                    tool_rules_solver=tool_rules_solver,
                    is_final_step=(is_final_step and idx == len(exec_specs) - 1),
                    finish_reason=finish_reason,
                )
            persisted_continue_flags.append(cont)
            persisted_stop_reasons.append(sr)

        # 5f. Create messages using parallel message creation (works for both single and multi)
        tool_call_specs = [{"name": s["name"], "arguments": s["args"], "id": s["id"]} for s in exec_specs]
        tool_execution_results = [res for (res, _) in results]

        # Use the parallel message creation function for both single and multiple tools
        parallel_messages = create_parallel_tool_messages_from_llm_response(
            agent_id=self.agent_state.id,
            model=self.agent_state.llm_config.model,
            tool_call_specs=tool_call_specs,
            tool_execution_results=tool_execution_results,
            function_responses=function_responses,
            timezone=self.agent_state.timezone,
            run_id=run_id,
            step_id=step_id,
            reasoning_content=content,
            pre_computed_assistant_message_id=pre_computed_assistant_message_id,
            is_approval_response=is_approval_response,
            tool_returns=result_tool_returns,
        )

        messages_to_persist: list[Message] = (initial_messages or []) + parallel_messages

        # Set run_id and step_id on all messages before persisting
        for message in messages_to_persist:
            if message.run_id is None:
                message.run_id = run_id
            if message.step_id is None:
                message.step_id = step_id

        # 5g. Aggregate continuation decisions
        aggregate_continue = any(persisted_continue_flags) if persisted_continue_flags else False
        aggregate_continue = aggregate_continue or tool_call_denials or tool_returns

        # Determine aggregate stop reason
        aggregate_stop_reason = None
        for sr in persisted_stop_reasons:
            if sr is not None:
                aggregate_stop_reason = sr

        # For parallel tool calls, always continue to allow the agent to process/summarize results
        # unless a terminal tool was called or we hit max steps
        if len(exec_specs) > 1:
            has_terminal = any(sr and sr.stop_reason == StopReasonType.tool_rule.value for sr in persisted_stop_reasons)
            is_max_steps = any(sr and sr.stop_reason == StopReasonType.max_steps.value for sr in persisted_stop_reasons)

            if not has_terminal and not is_max_steps:
                # Force continuation for parallel tool execution
                aggregate_continue = True
                aggregate_stop_reason = None
        return messages_to_persist, aggregate_continue, aggregate_stop_reason

    @trace_method
    def _decide_continuation(
        self,
        agent_state: AgentState,
        tool_call_name: Optional[str],
        tool_rule_violated: bool,
        tool_rules_solver: ToolRulesSolver,
        is_final_step: bool | None,
        finish_reason: str | None = None,
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
            # No tool call – if there are required-before-exit tools uncalled, keep stepping
            # and provide explicit feedback to the model; otherwise end the loop.
            uncalled = tool_rules_solver.get_uncalled_required_tools(available_tools=set([t.name for t in agent_state.tools]))
            if uncalled and not is_final_step:
                reason = f"{NON_USER_MSG_PREFIX}ToolRuleViolated: You must call {', '.join(uncalled)} at least once to exit the loop."
                return True, reason, None
            # No required tools remaining → end turn
            # Check if the LLM hit max_tokens (finish_reason == "length")
            if finish_reason == "length":
                return False, None, LettaStopReason(stop_reason=StopReasonType.max_tokens_exceeded.value)
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

    @trace_method
    async def compact(self, messages, trigger_threshold: Optional[int] = None) -> Message:
        """Compact the current in-context messages for this agent.

        Compaction uses a summarizer LLM configuration derived from
        ``compaction_settings.model`` when provided. This mirrors how agent
        creation derives defaults from provider-specific ModelSettings, but is
        localized to summarization.
        """

        # Use agent's compaction_settings if set, otherwise fall back to
        # global defaults based on the agent's model handle.
        if self.agent_state.compaction_settings is not None:
            summarizer_config = self.agent_state.compaction_settings
        else:
            # Prefer the new handle field if set, otherwise derive from llm_config
            if self.agent_state.model is not None:
                handle = self.agent_state.model
            else:
                llm_cfg = self.agent_state.llm_config
                handle = llm_cfg.handle or f"{llm_cfg.model_endpoint_type}/{llm_cfg.model}"

            summarizer_config = CompactionSettings(model=handle)

        # Build the LLMConfig used for summarization
        summarizer_llm_config = self._build_summarizer_llm_config(
            agent_llm_config=self.agent_state.llm_config,
            summarizer_config=summarizer_config,
        )

        summarization_mode_used = summarizer_config.mode
        if summarizer_config.mode == "all":
            summary, compacted_messages = await summarize_all(
                actor=self.actor,
                llm_config=summarizer_llm_config,
                summarizer_config=summarizer_config,
                in_context_messages=messages,
            )
        elif summarizer_config.mode == "sliding_window":
            try:
                summary, compacted_messages = await summarize_via_sliding_window(
                    actor=self.actor,
                    llm_config=summarizer_llm_config,
                    summarizer_config=summarizer_config,
                    in_context_messages=messages,
                )
            except Exception as e:
                self.logger.error(f"Sliding window summarization failed with exception: {str(e)}. Falling back to all mode.")
                summary, compacted_messages = await summarize_all(
                    actor=self.actor,
                    llm_config=summarizer_llm_config,
                    summarizer_config=summarizer_config,
                    in_context_messages=messages,
                )
                summarization_mode_used = "all"
        else:
            raise ValueError(f"Invalid summarizer mode: {summarizer_config.mode}")

        # update the token count
        self.context_token_estimate = await count_tokens(
            actor=self.actor, llm_config=self.agent_state.llm_config, messages=compacted_messages
        )
        self.logger.info(f"Context token estimate after summarization: {self.context_token_estimate}")

        # if the trigger_threshold is provided, we need to make sure that the new token count is below it
        if trigger_threshold is not None and self.context_token_estimate is not None and self.context_token_estimate >= trigger_threshold:
            # If even after summarization the context is still at or above
            # the proactive summarization threshold, treat this as a hard
            # failure: log loudly and evict all prior conversation state
            # (keeping only the system message) to avoid getting stuck in
            # repeated summarization loops.
            self.logger.error(
                "Summarization failed to sufficiently reduce context size: "
                f"post-summarization tokens={self.context_token_estimate}, "
                f"threshold={trigger_threshold}, context_window={self.context_token_estimate}. "
                "Evicting all prior messages without a summary to break potential loops.",
            )

            # if we used the sliding window mode, try to summarize again with the all mode
            if summarization_mode_used == "sliding_window":
                # try to summarize again with the all mode
                summary, compacted_messages = await summarize_all(
                    actor=self.actor,
                    llm_config=self.agent_state.llm_config,
                    summarizer_config=summarizer_config,
                    in_context_messages=compacted_messages,
                )
                summarization_mode_used = "all"

            self.context_token_estimate = await count_tokens(
                actor=self.actor, llm_config=self.agent_state.llm_config, messages=compacted_messages
            )

            # final edge case: the system prompt is the cause of the context overflow (raise error)
            if self.context_token_estimate is not None and self.context_token_estimate >= trigger_threshold:
                await self._check_for_system_prompt_overflow(compacted_messages[0])

                # raise an error if this is STILL not the problem
                # do not throw an error, since we don't want to brick the agent
                self.logger.error(
                    f"Failed to summarize messages after hard eviction and checking the system prompt token estimate: {self.context_token_estimate} > {trigger_threshold}"
                )
            else:
                self.logger.info(
                    f"Summarization fallback succeeded in bringing the context size below the trigger threshold: {self.context_token_estimate} < {trigger_threshold}"
                )

        # Persist the summary message to DB
        summary_message_str_packed = package_summarize_message_no_counts(
            summary=summary,
            timezone=self.agent_state.timezone,
        )
        summary_messages = await convert_message_creates_to_messages(
            message_creates=[
                MessageCreate(
                    role=MessageRole.user,
                    content=[TextContent(text=summary_message_str_packed)],
                )
            ],
            agent_id=self.agent_state.id,
            timezone=self.agent_state.timezone,
            # We already packed, don't pack again
            wrap_user_message=False,
            wrap_system_message=False,
            run_id=None,  # TODO: add this
        )
        if not len(summary_messages) == 1:
            self.logger.error(f"Expected only one summary message, got {len(summary_messages)} in {summary_messages}")
        summary_message_obj = summary_messages[0]

        # final messages: inject summarization message at the beginning
        final_messages = [compacted_messages[0]] + [summary_message_obj]
        if len(compacted_messages) > 1:
            final_messages += compacted_messages[1:]

        return summary_message_obj, final_messages

    @staticmethod
    def _build_summarizer_llm_config(
        agent_llm_config: LLMConfig,
        summarizer_config: CompactionSettings,
    ) -> LLMConfig:
        """Derive an LLMConfig for summarization from a model handle.

        This mirrors the agent-creation path: start from the agent's LLMConfig,
        override provider/model/handle from ``compaction_settings.model``, and
        then apply any explicit ``compaction_settings.model_settings`` via
        ``_to_legacy_config_params``.
        """

        # If no summarizer model handle is provided, fall back to the agent's config
        if not summarizer_config.model:
            return agent_llm_config

        try:
            # Parse provider/model from the handle, falling back to the agent's
            # provider type when only a model name is given.
            if "/" in summarizer_config.model:
                provider, model_name = summarizer_config.model.split("/", 1)
                if provider == "openai-proxy":
                    # fix for pydantic LLMConfig validation
                    provider = "openai"
            else:
                provider = agent_llm_config.model_endpoint_type
                model_name = summarizer_config.model

            # Start from the agent's config and override model + provider + handle
            base = agent_llm_config.model_copy()
            base.model_endpoint_type = provider
            base.model = model_name
            base.handle = summarizer_config.model

            # If explicit model_settings are provided for the summarizer, apply
            # them just like server.create_agent_async does for agents.
            if summarizer_config.model_settings is not None:
                update_params = summarizer_config.model_settings._to_legacy_config_params()
                return base.model_copy(update=update_params)

            return base
        except Exception:
            # On any error, do not break the agent – just fall back
            return agent_llm_config
