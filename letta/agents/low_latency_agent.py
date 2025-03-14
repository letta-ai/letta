import json
import uuid
from typing import Any, AsyncGenerator, Dict, List, Tuple

import openai

from letta.agents.base_agent import BaseAgent
from letta.agents.ephemeral_agent import EphemeralAgent
from letta.constants import NON_USER_MSG_PREFIX
from letta.helpers.datetime_helpers import get_utc_time
from letta.helpers.tool_execution_helper import (
    add_pre_execution_message,
    enable_strict_mode,
    execute_external_tool,
    remove_request_heartbeat,
)
from letta.interfaces.openai_chat_completions_streaming_interface import OpenAIChatCompletionsStreamingInterface
from letta.log import get_logger
from letta.orm.enums import ToolType
from letta.schemas.agent import AgentState
from letta.schemas.block import BlockUpdate
from letta.schemas.message import Message, MessageUpdate
from letta.schemas.openai.chat_completion_request import (
    AssistantMessage,
    ChatCompletionRequest,
    Tool,
    ToolCall,
    ToolCallFunction,
    ToolMessage,
    UserMessage,
)
from letta.schemas.user import User
from letta.server.rest_api.utils import (
    convert_letta_messages_to_openai,
    create_assistant_messages_from_openai_response,
    create_tool_call_messages_from_openai_response,
    create_user_message,
)
from letta.services.agent_manager import AgentManager
from letta.services.block_manager import BlockManager
from letta.services.helpers.agent_manager_helper import compile_system_message
from letta.services.message_manager import MessageManager
from letta.services.passage_manager import PassageManager
from letta.services.summarizer.enums import SummarizationMode
from letta.services.summarizer.summarizer import Summarizer
from letta.utils import united_diff

logger = get_logger(__name__)


class LowLatencyAgent(BaseAgent):
    """
    A function-calling loop for streaming OpenAI responses with tool execution.
    This agent:
      - Streams partial tokens in real-time for low-latency output.
      - Detects tool calls and invokes external tools.
      - Gracefully handles OpenAI API failures (429, etc.) and streams errors.
    """

    def __init__(
        self,
        agent_id: str,
        openai_client: openai.AsyncClient,
        message_manager: MessageManager,
        agent_manager: AgentManager,
        block_manager: BlockManager,
        actor: User,
        summarization_mode: SummarizationMode = SummarizationMode.STATIC_MESSAGE_BUFFER,
        message_buffer_limit: int = 10,
        message_buffer_min: int = 4,
    ):
        super().__init__(
            agent_id=agent_id, openai_client=openai_client, message_manager=message_manager, agent_manager=agent_manager, actor=actor
        )

        # TODO: Make this more general, factorable
        # Summarizer settings
        self.block_manager = block_manager
        self.passage_manager = PassageManager()  # TODO: pass this in
        # TODO: This is not guaranteed to exist!
        self.summary_block_label = "human"
        self.summarizer = Summarizer(
            mode=summarization_mode,
            summarizer_agent=EphemeralAgent(
                agent_id=agent_id, openai_client=openai_client, message_manager=message_manager, agent_manager=agent_manager, actor=actor
            ),
            message_buffer_limit=message_buffer_limit,
            message_buffer_min=message_buffer_min,
        )
        self.message_buffer_limit = message_buffer_limit
        self.message_buffer_min = message_buffer_min

    async def step(self, input_message: UserMessage) -> List[Message]:
        raise NotImplementedError("LowLatencyAgent does not have a synchronous step implemented currently.")

    async def step_stream(self, input_message: UserMessage) -> AsyncGenerator[str, None]:
        """
        Async generator that yields partial tokens as SSE events, handles tool calls,
        and streams error messages if OpenAI API failures occur.
        """
        input_message = self.pre_process_input_message(input_message=input_message)
        agent_state = self.agent_manager.get_agent_by_id(agent_id=self.agent_id, actor=self.actor)
        in_context_messages = self.message_manager.get_messages_by_ids(message_ids=agent_state.message_ids, actor=self.actor)
        letta_message_db_queue = [create_user_message(input_message=input_message, agent_id=agent_state.id, actor=self.actor)]
        in_memory_message_history = [input_message]

        while True:
            # Constantly pull down and integrate memory blocks
            in_context_messages = self._rebuild_memory(in_context_messages=in_context_messages, agent_state=agent_state)

            # Convert Letta messages to OpenAI messages
            openai_messages = convert_letta_messages_to_openai(in_context_messages)
            openai_messages.extend(in_memory_message_history)
            request = self._build_openai_request(openai_messages, agent_state)

            # Execute the request
            stream = await self.openai_client.chat.completions.create(**request.model_dump(exclude_unset=True))
            streaming_interface = OpenAIChatCompletionsStreamingInterface(stream_pre_execution_message=True)

            async for sse in streaming_interface.process(stream):
                yield sse

            # Process the AI response (buffered messages, tool execution, etc.)
            continue_execution = await self._handle_ai_response(
                streaming_interface, agent_state, in_memory_message_history, letta_message_db_queue
            )

            if not continue_execution:
                break

        # Rebuild context window
        await self._rebuild_context_window(in_context_messages, letta_message_db_queue, agent_state)

        yield "data: [DONE]\n\n"

    async def _handle_ai_response(
        self,
        streaming_interface: OpenAIChatCompletionsStreamingInterface,
        agent_state: AgentState,
        in_memory_message_history: List[Dict[str, Any]],
        letta_message_db_queue: List[Any],
    ) -> bool:
        """
        Handles AI response processing, including buffering messages, detecting tool calls,
        executing tools, and deciding whether to continue execution.

        Returns:
            bool: True if execution should continue, False if the step loop should terminate.
        """
        # Handle assistant message buffering
        if streaming_interface.content_buffer:
            content = "".join(streaming_interface.content_buffer)
            in_memory_message_history.append({"role": "assistant", "content": content})

            assistant_msgs = create_assistant_messages_from_openai_response(
                response_text=content,
                agent_id=agent_state.id,
                model=agent_state.llm_config.model,
                actor=self.actor,
            )
            letta_message_db_queue.extend(assistant_msgs)

        # Handle tool execution if a tool call occurred
        if streaming_interface.tool_call_happened:
            try:
                tool_args = json.loads(streaming_interface.tool_call_args_str)
            except json.JSONDecodeError:
                tool_args = {}

            tool_call_id = streaming_interface.tool_call_id or f"call_{uuid.uuid4().hex[:8]}"

            assistant_tool_call_msg = AssistantMessage(
                content=None,
                tool_calls=[
                    ToolCall(
                        id=tool_call_id,
                        function=ToolCallFunction(
                            name=streaming_interface.tool_call_name,
                            arguments=streaming_interface.tool_call_args_str,
                        ),
                    )
                ],
            )
            in_memory_message_history.append(assistant_tool_call_msg.model_dump())

            tool_result, function_call_success = await self._execute_tool(
                tool_name=streaming_interface.tool_call_name,
                tool_args=tool_args,
                agent_state=agent_state,
            )

            tool_message = ToolMessage(content=json.dumps({"result": tool_result}), tool_call_id=tool_call_id)
            in_memory_message_history.append(tool_message.model_dump())

            heartbeat_user_message = UserMessage(
                content=f"{NON_USER_MSG_PREFIX} Tool finished executing. Summarize the result for the user."
            )
            in_memory_message_history.append(heartbeat_user_message.model_dump())

            tool_call_messages = create_tool_call_messages_from_openai_response(
                agent_id=agent_state.id,
                model=agent_state.llm_config.model,
                function_name=streaming_interface.tool_call_name,
                function_arguments=tool_args,
                tool_call_id=tool_call_id,
                function_call_success=function_call_success,
                function_response=tool_result,
                actor=self.actor,
                add_heartbeat_request_system_message=True,
            )
            letta_message_db_queue.extend(tool_call_messages)

            # Continue execution by restarting the loop with updated context
            return True

        # Exit the loop if finish_reason_stop or no tool call occurred
        return not streaming_interface.finish_reason_stop

    async def _rebuild_context_window(
        self, in_context_messages: List[Message], letta_message_db_queue: List[Message], agent_state: AgentState
    ) -> None:
        new_letta_messages = self.message_manager.create_many_messages(letta_message_db_queue, actor=self.actor)

        # TODO: Make this more general and configurable, less brittle
        target_block = next(b for b in agent_state.memory.blocks if b.label == self.summary_block_label)
        previous_summary = self.block_manager.get_block_by_id(block_id=target_block.id, actor=self.actor).value
        new_in_context_messages, summary_str, updated = await self.summarizer.summarize(
            in_context_messages=in_context_messages, new_letta_messages=new_letta_messages, previous_summary=previous_summary
        )

        if updated:
            self.block_manager.update_block(block_id=target_block.id, block_update=BlockUpdate(value=summary_str), actor=self.actor)

        self.agent_manager.set_in_context_messages(
            agent_id=self.agent_id, message_ids=[m.id for m in new_in_context_messages], actor=self.actor
        )

    def _rebuild_memory(self, in_context_messages: List[Message], agent_state: AgentState) -> List[Message]:
        # TODO: This is a pretty brittle pattern established all over our code, need to get rid of this
        curr_system_message = in_context_messages[0]
        curr_memory_str = agent_state.memory.compile()
        curr_system_message_text = curr_system_message.content[0].text
        if curr_memory_str in curr_system_message_text:
            # NOTE: could this cause issues if a block is removed? (substring match would still work)
            logger.debug(
                f"Memory hasn't changed for agent id={agent_state.id} and actor=({self.actor.id}, {self.actor.name}), skipping system prompt rebuild"
            )
            return in_context_messages

        memory_edit_timestamp = get_utc_time()

        num_messages = self.message_manager.size(actor=actor, agent_id=agent_id)
        num_archival_memories = self.passage_manager.size(actor=actor, agent_id=agent_id)

        new_system_message_str = compile_system_message(
            system_prompt=agent_state.system,
            in_context_memory=agent_state.memory,
            in_context_memory_last_edit=memory_edit_timestamp,
            previous_message_count=num_messages,
            archival_memory_size=num_archival_memories,
        )

        diff = united_diff(curr_system_message_text, new_system_message_str)
        if len(diff) > 0:
            logger.info(f"Rebuilding system with new memory...\nDiff:\n{diff}")

            new_system_message = self.message_manager.update_message_by_id(
                curr_system_message.id, message_update=MessageUpdate(content=new_system_message_str), actor=self.actor
            )

            # Skip pulling down the agent's memory again to save on a db call
            return [new_system_message] + in_context_messages[1:]

        else:
            return in_context_messages

    def _build_openai_request(self, openai_messages: List[Dict], agent_state: AgentState) -> ChatCompletionRequest:
        tool_schemas = self._build_tool_schemas(agent_state)
        tool_choice = "auto" if tool_schemas else None

        openai_request = ChatCompletionRequest(
            model=agent_state.llm_config.model,
            messages=openai_messages,
            tools=self._build_tool_schemas(agent_state),
            tool_choice=tool_choice,
            user=self.actor.id,
            max_completion_tokens=agent_state.llm_config.max_tokens,
            temperature=agent_state.llm_config.temperature,
            stream=True,
        )
        return openai_request

    def _build_tool_schemas(self, agent_state: AgentState, external_tools_only=True) -> List[Tool]:
        if external_tools_only:
            tools = [t for t in agent_state.tools if t.tool_type in {ToolType.EXTERNAL_COMPOSIO, ToolType.CUSTOM}]
        else:
            tools = agent_state.tools

        # TODO: Customize whether or not to have heartbeats, pre_exec_message, etc.
        return [
            Tool(type="function", function=enable_strict_mode(add_pre_execution_message(remove_request_heartbeat(t.json_schema))))
            for t in tools
        ]

    async def _execute_tool(self, tool_name: str, tool_args: dict, agent_state: AgentState) -> Tuple[str, bool]:
        """
        Executes a tool and returns (result, success_flag).
        """
        target_tool = next((x for x in agent_state.tools if x.name == tool_name), None)
        if not target_tool:
            return f"Tool not found: {tool_name}", False

        try:
            tool_result, _ = execute_external_tool(
                agent_state=agent_state,
                function_name=tool_name,
                function_args=tool_args,
                target_letta_tool=target_tool,
                actor=self.actor,
                allow_agent_state_modifications=False,
            )
            return tool_result, True
        except Exception as e:
            return f"Failed to call tool. Error: {e}", False
