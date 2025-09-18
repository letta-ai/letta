import json
from typing import List, Optional

from letta.constants import DEFAULT_MESSAGE_TOOL, DEFAULT_MESSAGE_TOOL_KWARG
from letta.interface import AgentInterface
from letta.schemas.letta_message import AssistantMessage, LettaMessage
from letta.schemas.message import Message


class MultiAgentMessagingInterface(AgentInterface):
    """
    A minimal interface that captures *only* calls to the 'send_message' function
    by inspecting msg_obj.tool_calls. We parse out the 'message' field from the
    JSON function arguments and store it as an AssistantMessage.
    """

    def __init__(self):
        self._captured_messages: List[AssistantMessage] = []
        self.metadata = {}

    def internal_monologue(self, msg: str, msg_obj: Optional[Message] = None, chunk_index: Optional[int] = None):
        """Ignore internal monologue."""

    def assistant_message(self, msg: str, msg_obj: Optional[Message] = None):
        """Ignore normal assistant messages (only capturing send_message calls)."""

    def function_message(self, msg: str, msg_obj: Optional[Message] = None, chunk_index: Optional[int] = None):
        """
        Called whenever the agent logs a function call. We'll inspect msg_obj.tool_calls:
          - If tool_calls include a function named 'send_message', parse its arguments
          - Extract the 'message' field
          - Save it as an AssistantMessage in self._captured_messages
        """
        if not msg_obj or not msg_obj.tool_calls:
            return

        for tool_call in msg_obj.tool_calls:
            if not tool_call.function:
                continue
            if tool_call.function.name != DEFAULT_MESSAGE_TOOL:
                # Skip any other function calls
                continue

            # Now parse the JSON in tool_call.function.arguments
            func_args_str = tool_call.function.arguments or ""
            try:
                data = json.loads(func_args_str)
                # Extract the 'message' key if present
                content = data.get(DEFAULT_MESSAGE_TOOL_KWARG, str(data))
            except json.JSONDecodeError:
                # If we can't parse, store the raw string
                content = func_args_str

            # Store as an AssistantMessage
            new_msg = AssistantMessage(
                id=msg_obj.id,
                date=msg_obj.created_at,
                content=content,
            )
            self._captured_messages.append(new_msg)

    def user_message(self, msg: str, msg_obj: Optional[Message] = None):
        """Ignore user messages."""

    def step_complete(self):
        """No streaming => no step boundaries."""

    def step_yield(self):
        """No streaming => no final yield needed."""

    def get_captured_send_messages(self) -> List[LettaMessage]:
        """
        Returns only the messages extracted from 'send_message' calls.
        """
        return self._captured_messages
