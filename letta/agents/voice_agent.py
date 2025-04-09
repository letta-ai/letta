import json
import uuid
from typing import Any, AsyncGenerator, Dict, List, Tuple

import openai

from letta.agents.base_agent import BaseAgent
from letta.agents.ephemeral_memory_agent import EphemeralMemoryAgent
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
from letta.schemas.letta_message_content import TextContent
from letta.schemas.letta_response import LettaResponse
from letta.schemas.message import Message, MessageCreate, MessageUpdate
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
    create_input_messages,
    create_letta_messages_from_llm_response,
)
from letta.services.agent_manager import AgentManager
from letta.services.block_manager import BlockManager
from letta.services.helpers.agent_manager_helper import compile_system_message
from letta.services.message_manager import MessageManager
from letta.services.passage_manager import PassageManager
from letta.services.summarizer.enums import SummarizationMode
from letta.utils import united_diff

logger = get_logger(__name__)


class VoiceAgent(BaseAgent):
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
        message_buffer_limit: int,
        message_buffer_min: int,
        summarization_mode: SummarizationMode = SummarizationMode.STATIC_MESSAGE_BUFFER,
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
        # self.summarizer = Summarizer(
        #     mode=summarization_mode,
        #     summarizer_agent=EphemeralAgent(
        #         agent_id=agent_id, openai_client=openai_client, message_manager=message_manager, agent_manager=agent_manager, actor=actor
        #     ),
        #     message_buffer_limit=message_buffer_limit,
        #     message_buffer_min=message_buffer_min,
        # )
        self.message_buffer_limit = message_buffer_limit
        # self.message_buffer_min = message_buffer_min
        self.offline_memory_agent = EphemeralMemoryAgent(
            agent_id=agent_id, openai_client=openai_client, message_manager=message_manager, agent_manager=agent_manager, actor=actor
        )

    async def step(self, input_messages: List[MessageCreate], max_steps: int = 10) -> LettaResponse:
        raise NotImplementedError("LowLatencyAgent does not have a synchronous step implemented currently.")

    async def step_stream(self, input_messages: List[MessageCreate], max_steps: int = 10) -> AsyncGenerator[str, None]:
        """
        Main streaming loop that yields partial tokens.
        Whenever we detect a tool call, we yield from _handle_ai_response as well.
        """
        agent_state = self.agent_manager.get_agent_by_id(self.agent_id, actor=self.actor)
        in_context_messages = self.message_manager.get_messages_by_ids(message_ids=agent_state.message_ids, actor=self.actor)
        letta_message_db_queue = [create_input_messages(input_messages=input_messages, agent_id=agent_state.id, actor=self.actor)]
        in_memory_message_history = self.pre_process_input_message(input_messages)

        # TODO: Define max steps here
        for _ in range(max_steps):
            # Rebuild memory each loop
            in_context_messages = self._rebuild_memory(in_context_messages, agent_state)
            openai_messages = convert_letta_messages_to_openai(in_context_messages)
            openai_messages.extend(in_memory_message_history)

            request = self._build_openai_request(openai_messages, agent_state)

            stream = await self.openai_client.chat.completions.create(**request.model_dump(exclude_unset=True))
            streaming_interface = OpenAIChatCompletionsStreamingInterface(stream_pre_execution_message=True)

            # 1) Yield partial tokens from OpenAI
            async for sse_chunk in streaming_interface.process(stream):
                yield sse_chunk

            # 2) Now handle the final AI response. This might yield more text (stalling, etc.)
            should_continue = await self._handle_ai_response(
                streaming_interface,
                agent_state,
                in_memory_message_history,
                letta_message_db_queue,
            )

            if not should_continue:
                break

        # Rebuild context window if desired
        await self._rebuild_context_window(in_context_messages, letta_message_db_queue, agent_state)
        yield "data: [DONE]\n\n"

    async def _handle_ai_response(
        self,
        streaming_interface: "OpenAIChatCompletionsStreamingInterface",
        agent_state: AgentState,
        in_memory_message_history: List[Dict[str, Any]],
        letta_message_db_queue: List[Any],
    ) -> bool:
        """
        Now that streaming is done, handle the final AI response.
        This might yield additional SSE tokens if we do stalling.
        At the end, set self._continue_execution accordingly.
        """
        # 1. If we have any leftover content from partial stream, store it as an assistant message
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

        # 2. If a tool call was requested, handle it
        if streaming_interface.tool_call_happened:
            tool_call_name = streaming_interface.tool_call_name
            tool_call_args_str = streaming_interface.tool_call_args_str or "{}"
            try:
                tool_args = json.loads(tool_call_args_str)
            except json.JSONDecodeError:
                tool_args = {}

            tool_call_id = streaming_interface.tool_call_id or f"call_{uuid.uuid4().hex[:8]}"
            assistant_tool_call_msg = AssistantMessage(
                content=None,
                tool_calls=[
                    ToolCall(
                        id=tool_call_id,
                        function=ToolCallFunction(
                            name=tool_call_name,
                            arguments=tool_call_args_str,
                        ),
                    )
                ],
            )
            in_memory_message_history.append(assistant_tool_call_msg.model_dump())

            tool_result, success_flag = await self._execute_tool(
                tool_name=tool_call_name,
                tool_args=tool_args,
                agent_state=agent_state,
            )

            # 3. Provide function_call response back into the conversation
            tool_message = ToolMessage(
                content=json.dumps({"result": tool_result}),
                tool_call_id=tool_call_id,
            )
            in_memory_message_history.append(tool_message.model_dump())

            # 4. Insert heartbeat message for follow-up
            heartbeat_user_message = UserMessage(
                content=f"{NON_USER_MSG_PREFIX} Tool finished executing. Summarize the result for the user."
            )
            in_memory_message_history.append(heartbeat_user_message.model_dump())

            # 5. Also store in DB
            tool_call_messages = create_letta_messages_from_llm_response(
                agent_id=agent_state.id,
                model=agent_state.llm_config.model,
                function_name=tool_call_name,
                function_arguments=tool_args,
                tool_call_id=tool_call_id,
                function_call_success=success_flag,
                function_response=tool_result,
                actor=self.actor,
                add_heartbeat_request_system_message=True,
            )
            letta_message_db_queue.extend(tool_call_messages)

            # Because we have new data, we want to continue the while-loop in `step_stream`
            return True
        else:
            # If we got here, there's no tool call. If finish_reason_stop => done
            return not streaming_interface.finish_reason_stop

    async def _rebuild_context_window(
        self, in_context_messages: List[Message], letta_message_db_queue: List[Message], agent_state: AgentState
    ) -> None:
        new_letta_messages = self.message_manager.create_many_messages(letta_message_db_queue, actor=self.actor)
        new_in_context_messages = in_context_messages + new_letta_messages

        if len(new_in_context_messages) > self.message_buffer_limit:
            cutoff = len(new_in_context_messages) - self.message_buffer_limit
            new_in_context_messages = [new_in_context_messages[0]] + new_in_context_messages[cutoff:]

        self.agent_manager.set_in_context_messages(
            agent_id=self.agent_id, message_ids=[m.id for m in new_in_context_messages], actor=self.actor
        )

    def _rebuild_memory(self, in_context_messages: List[Message], agent_state: AgentState) -> List[Message]:
        # Refresh memory
        # TODO: This only happens for the summary block
        # TODO: We want to extend this refresh to be general, and stick it in agent_manager
        for i, b in enumerate(agent_state.memory.blocks):
            if b.label == self.summary_block_label:
                agent_state.memory.blocks[i] = self.block_manager.get_block_by_id(block_id=b.id, actor=self.actor)
                break

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

        num_messages = self.message_manager.size(actor=self.actor, agent_id=agent_state.id)
        num_archival_memories = self.passage_manager.size(actor=self.actor, agent_id=agent_state.id)

        new_system_message_str = compile_system_message(
            system_prompt=agent_state.system,
            in_context_memory=agent_state.memory,
            in_context_memory_last_edit=memory_edit_timestamp,
            previous_message_count=num_messages,
            archival_memory_size=num_archival_memories,
        )

        diff = united_diff(curr_system_message_text, new_system_message_str)
        if len(diff) > 0:
            logger.debug(f"Rebuilding system with new memory...\nDiff:\n{diff}")

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

        # Special tool state
        recall_memory_utterance_description = (
            "A lengthier message to be uttered while your memories of the current conversation are being re-contextualized."
            "You should stall naturally and show the user you're thinking hard. The main thing is to not leave the user in silence."
            "You MUST also include punctuation at the end of this message."
        )
        recall_memory_json = Tool(
            type="function",
            function=enable_strict_mode(
                add_pre_execution_message(
                    {
                        "name": "recall_memory",
                        "description": "Retrieve relevant information from memory based on a given query. Use when you don't remember the answer to a question.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "query": {
                                    "type": "string",
                                    "description": "A description of what the model is trying to recall from memory.",
                                }
                            },
                            "required": ["query"],
                        },
                    },
                    description=recall_memory_utterance_description,
                )
            ),
        )

        # TODO: Customize whether or not to have heartbeats, pre_exec_message, etc.
        return [recall_memory_json] + [
            Tool(type="function", function=enable_strict_mode(add_pre_execution_message(remove_request_heartbeat(t.json_schema))))
            for t in tools
        ]

    async def _execute_tool(self, tool_name: str, tool_args: dict, agent_state: AgentState) -> Tuple[str, bool]:
        """
        Executes a tool and returns (result, success_flag).
        """
        # Special memory case
        if tool_name == "recall_memory":
            # TODO: Make this safe
            await self._recall_memory(tool_args["query"], agent_state)
            return f"Successfully recalled memory and populated {self.summary_block_label} block.", True
        else:
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

    async def _recall_memory(self, query, agent_state: AgentState) -> None:
        results = await self.offline_memory_agent.step([MessageCreate(role="user", content=[TextContent(text=query)])])
        target_block = next(b for b in agent_state.memory.blocks if b.label == self.summary_block_label)
        self.block_manager.update_block(
            block_id=target_block.id, block_update=BlockUpdate(value=results[0].content[0].text), actor=self.actor
        )
