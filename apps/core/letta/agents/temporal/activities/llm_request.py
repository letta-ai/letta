from temporalio import activity

from letta.agents.temporal.types import LLMCallResult, LLMRequestParams


@activity.defn(name="llm_request")
async def llm_request(params: LLMRequestParams) -> LLMCallResult:
    """Build and execute a non-streaming LLM request and return parsed tool call.

    TODO: Implement following LettaAgentV2._step LLM request path (blocking adapter):
      - Construct LLMClient via LLMClient.create with params.agent_state.llm_config and actor
      - Build request_data = client.build_request_data(messages, llm_config, tools=params.allowed_tools, force_tool_call=params.force_tool_call)
      - Invoke request with LettaLLMRequestAdapter.invoke_llm(...) to get tool_call, reasoning_content, usage, assistant_message_id
      - Catch ContextWindowExceededError and propagate so workflow can trigger summarize-then-retry
      - Return LLMCallResult(tool_call, reasoning_content, assistant_message_id, usage, request_finish_ns)

    Notes:
      - Keep all provider/network calls here; the workflow should only orchestrate retries and tool selection.
      - Use params.requires_approval_tools to pass requires-approval tool names into the adapter if applicable.
    """
    # Stub: return an empty result to be filled in by the workflow later.
    from letta.schemas.openai.chat_completion_response import UsageStatistics

    return LLMCallResult(
        tool_call=None,
        reasoning_content=None,
        assistant_message_id=None,
        usage=UsageStatistics(completion_tokens=0, prompt_tokens=0, total_tokens=0),
        request_finish_ns=None,
    )
