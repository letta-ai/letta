from temporalio import activity

from letta.adapters.letta_llm_request_adapter import LettaLLMRequestAdapter
from letta.agents.temporal.types import LLMCallResult, LLMRequestParams
from letta.llm_api.llm_client import LLMClient
from letta.schemas.openai.chat_completion_response import UsageStatistics


@activity.defn(name="llm_request")
async def llm_request(params: LLMRequestParams) -> LLMCallResult:
    """
    Build and execute a non-streaming LLM request and return parsed tool call. Errors from the provider are intentionally propagated so the workflow can handle retries (e.g., summarization on ContextWindowExceededError).
    """
    agent_state = params.agent_state
    llm_config = agent_state.llm_config

    llm_client = LLMClient.create(
        provider_type=llm_config.model_endpoint_type,
        put_inner_thoughts_first=True,
        actor=params.actor,
    )
    llm_adapter = LettaLLMRequestAdapter(llm_client=llm_client, llm_config=llm_config)

    request_data = llm_client.build_request_data(
        messages=params.messages,
        llm_config=llm_config,
        tools=params.allowed_tools,
        force_tool_call=params.force_tool_call,
    )

    # execute the llm request
    invocation = llm_adapter.invoke_llm(
        request_data=request_data,
        messages=params.messages,
        tools=params.allowed_tools,
        use_assistant_message=params.use_assistant_message,
        requires_approval_tools=params.requires_approval_tools or [],
        step_id=params.step_id,
        actor=params.actor,
    )

    # iterate through the async generator (non-streaming mode yields once with None)
    async for _ in invocation:
        pass

    # extract results from the adapter after invocation completes
    usage = llm_adapter.chat_completions_response.usage if llm_adapter.chat_completions_response else UsageStatistics()
    return LLMCallResult(
        tool_call=llm_adapter.tool_call,
        reasoning_content=llm_adapter.reasoning_content,
        assistant_message_id=llm_adapter.message_id,
        usage=usage,
        request_finish_ns=llm_adapter.llm_request_finish_timestamp_ns,
    )
