from temporalio import activity

from letta.agents.temporal.types import CreateMessagesParams, CreateMessagesResult
from letta.schemas.message import Message
from letta.server.rest_api.utils import create_letta_messages_from_llm_response


@activity.defn(name="create_messages")
async def create_messages_activity(input_: CreateMessagesParams) -> CreateMessagesResult:
    """
    Create Letta messages from tool execution results.

    This activity formats the tool call and its response into proper Letta message format
    for persistence and returning to the user.
    """
    messages = create_letta_messages_from_llm_response(
        agent_id=input_.agent_id,
        model=input_.model,
        function_name=input_.tool_name,
        function_arguments=input_.tool_args,
        tool_execution_result=input_.tool_execution_result,
        tool_call_id=input_.tool_call_id,
        function_call_success=input_.tool_execution_result.success_flag,
        function_response=input_.function_response_string,
        timezone=input_.timezone,
        actor=input_.actor,
        continue_stepping=input_.continue_stepping,
        heartbeat_reason=input_.heartbeat_reason,
        reasoning_content=input_.reasoning_content,
        pre_computed_assistant_message_id=input_.pre_computed_assistant_message_id,
        step_id=input_.step_id,
        is_approval_response=input_.is_approval,
    )

    # Combine with initial messages if provided
    if input_.initial_messages:
        messages = input_.initial_messages + messages

    return CreateMessagesResult(messages=messages)
