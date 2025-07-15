import json
import uuid

from letta.helpers.datetime_helpers import get_utc_time
from letta.schemas.agent import AgentState
from letta.schemas.openai.chat_completion_response import ChatCompletionResponse, FunctionCall, ToolCall, UsageStatistics


def mock_chat_completion_resposne(response_data: dict, agent_state: AgentState) -> ChatCompletionResponse:
    return ChatCompletionResponse(
        id=str(uuid.uuid4()),
        choices=response_data["choices"],
        created=get_utc_time(),
        model=agent_state.llm_config.model,
        object="chat.completion",
        usage=UsageStatistics(completion_tokens=0, prompt_tokens=0, total_tokens=0),
    )


def mock_tool_call_response_dict(force_tool_call: str, predefined_args: dict) -> dict:
    tool_call = ToolCall(
        id=f"call_{uuid.uuid4().hex[:8]}",
        function=FunctionCall(name=force_tool_call, arguments=json.dumps(predefined_args)),
    )
    return {
        "choices": [
            {
                "finish_reason": "",
                "index": 0,
                "message": {
                    "tool_calls": [tool_call],
                    "role": "tool_rule_solver",
                },
                "logprobs": None,
                "seed": None,
            }
        ],
        "skip_llm": True,
    }
