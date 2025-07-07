import asyncio
import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, AsyncGenerator, Dict, List, Optional

import openai

from letta.agents.base_agent import BaseAgent
from letta.agents.exceptions import IncompatibleAgentType
from letta.agents.voice_sleeptime_agent import VoiceSleeptimeAgent
from letta.constants import DEFAULT_MAX_STEPS, NON_USER_MSG_PREFIX, PRE_EXECUTION_MESSAGE_ARG, REQUEST_HEARTBEAT_PARAM
from letta.helpers.datetime_helpers import get_utc_time
from letta.helpers.tool_execution_helper import add_pre_execution_message, enable_strict_mode, remove_request_heartbeat
from letta.interfaces.openai_chat_completions_streaming_interface import OpenAIChatCompletionsStreamingInterface
from letta.log import get_logger
from letta.orm.enums import ToolType
from letta.schemas.agent import AgentState, AgentType
from letta.schemas.enums import MessageRole
from letta.schemas.letta_response import LettaResponse
from letta.schemas.message import Message, MessageCreate
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
    convert_in_context_letta_messages_to_openai,
    create_assistant_messages_from_openai_response,
    create_input_messages,
    create_letta_messages_from_llm_response,
)
from letta.services.agent_manager import AgentManager
from letta.services.block_manager import BlockManager
from letta.services.helpers.agent_manager_helper import compile_system_message
from letta.services.job_manager import JobManager
from letta.services.message_manager import MessageManager
from letta.services.passage_manager import PassageManager
from letta.services.summarizer.enums import SummarizationMode
from letta.services.summarizer.summarizer import Summarizer
from letta.services.tool_executor.tool_execution_manager import ToolExecutionManager
from letta.settings import model_settings

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
        job_manager: JobManager,
        passage_manager: PassageManager,
        actor: User,
    ):
        super().__init__(
            agent_id=agent_id, openai_client=openai_client, message_manager=message_manager, agent_manager=agent_manager, actor=actor
        )

        # Summarizer settings
        self.block_manager = block_manager
        self.job_manager = job_manager
        self.passage_manager = passage_manager
        # TODO: This is not guaranteed to exist!
        self.summary_block_label = "human"

        # Cached archival memory/message size
        self.num_messages = None
        self.num_archival_memories = None

    def init_summarizer(self, agent_state: AgentState) -> Summarizer:
        if not agent_state.multi_agent_group:
            raise ValueError("Low latency voice agent is not part of a multiagent group, missing sleeptime agent.")
        if len(agent_state.multi_agent_group.agent_ids) != 1:
            raise ValueError(
                f"None or multiple participant agents found in voice sleeptime group: {agent_state.multi_agent_group.agent_ids}"
            )
        voice_sleeptime_agent_id = agent_state.multi_agent_group.agent_ids[0]
        summarizer = Summarizer(
            mode=SummarizationMode.STATIC_MESSAGE_BUFFER,
            summarizer_agent=VoiceSleeptimeAgent(
                agent_id=voice_sleeptime_agent_id,
                convo_agent_state=agent_state,
                message_manager=self.message_manager,
                agent_manager=self.agent_manager,
                actor=self.actor,
                block_manager=self.block_manager,
                job_manager=self.job_manager,
                passage_manager=self.passage_manager,
                target_block_label=self.summary_block_label,
            ),
            message_buffer_limit=agent_state.multi_agent_group.max_message_buffer_length,
            message_buffer_min=agent_state.multi_agent_group.min_message_buffer_length,
        )

        return summarizer

    async def step(self, input_messages: List[MessageCreate], max_steps: int = DEFAULT_MAX_STEPS) -> LettaResponse:
        raise NotImplementedError("VoiceAgent does not have a synchronous step implemented currently.")

    async def step_stream(self, input_messages: List[MessageCreate], max_steps: int = DEFAULT_MAX_STEPS) -> AsyncGenerator[str, None]:
        """
        Main streaming loop that yields partial tokens.
        Whenever we detect a tool call, we yield from _handle_ai_response as well.
        """
        if len(input_messages) != 1 or input_messages[0].role != MessageRole.user:
            raise ValueError(f"Voice Agent was invoked with multiple input messages or message did not have role `user`: {input_messages}")

        user_query = input_messages[0].content[0].text

        agent_state = await self.agent_manager.get_agent_by_id_async(
            agent_id=self.agent_id,
            include_relationships=["tools", "memory", "tool_exec_environment_variables", "multi_agent_group"],
            actor=self.actor,
        )

        # TODO: Refactor this so it uses our in-house clients
        # TODO: For now, piggyback off of OpenAI client for ease
        if agent_state.llm_config.model_endpoint_type == "anthropic":
            self.openai_client.api_key = model_settings.anthropic_api_key
            self.openai_client.base_url = "https://api.anthropic.com/v1/"
        elif agent_state.llm_config.model_endpoint_type != "openai":
            raise ValueError("Letta voice agents are only compatible with OpenAI or Anthropic.")

        # Safety check
        if agent_state.agent_type != AgentType.voice_convo_agent:
            raise IncompatibleAgentType(expected_type=AgentType.voice_convo_agent, actual_type=agent_state.agent_type)

        summarizer = self.init_summarizer(agent_state=agent_state)

        in_context_messages = await self.message_manager.get_messages_by_ids_async(message_ids=agent_state.message_ids, actor=self.actor)
        memory_edit_timestamp = get_utc_time()
        in_context_messages[0].content[0].text = compile_system_message(
            system_prompt=agent_state.system,
            in_context_memory=agent_state.memory,
            in_context_memory_last_edit=memory_edit_timestamp,
            timezone=agent_state.timezone,
            previous_message_count=self.num_messages,
            archival_memory_size=self.num_archival_memories,
            sources=agent_state.sources,
        )
        letta_message_db_queue = create_input_messages(
            input_messages=input_messages, agent_id=agent_state.id, timezone=agent_state.timezone, actor=self.actor
        )
        in_memory_message_history = self.pre_process_input_message(input_messages)

        # TODO: Define max steps here
        for _ in range(max_steps):
            # Rebuild memory each loop
            in_context_messages = await self._rebuild_memory_async(in_context_messages, agent_state)
            openai_messages = convert_in_context_letta_messages_to_openai(in_context_messages, exclude_system_messages=True)
            openai_messages.extend(in_memory_message_history)

            request = self._build_openai_request(openai_messages, agent_state)

            stream = await self.openai_client.chat.completions.create(**request.model_dump(exclude_unset=True))
            streaming_interface = OpenAIChatCompletionsStreamingInterface(stream_pre_execution_message=True)

            # 1) Yield partial tokens from OpenAI
            async for sse_chunk in streaming_interface.process(stream):
                yield sse_chunk

            # 2) Now handle the final AI response. This might yield more text (stalling, etc.)
            should_continue = await self._handle_ai_response(
                user_query,
                streaming_interface,
                agent_state,
                in_memory_message_history,
                letta_message_db_queue,
            )

            if not should_continue:
                break

        # Rebuild context window if desired
        await self._rebuild_context_window(summarizer, in_context_messages, letta_message_db_queue)

        yield "data: [DONE]\n\n"

    async def _handle_ai_response(
        self,
        user_query: str,
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
                timezone=agent_state.timezone,
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

            tool_execution_result = await self._execute_tool(
                user_query=user_query,
                tool_name=tool_call_name,
                tool_args=tool_args,
                agent_state=agent_state,
            )
            tool_result = tool_execution_result.func_return
            success_flag = tool_execution_result.success_flag

            # 3. Provide function_call response back into the conversation
            # TODO: fix this tool format
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
                tool_execution_result=tool_execution_result,
                timezone=agent_state.timezone,
                actor=self.actor,
                continue_stepping=True,
            )
            letta_message_db_queue.extend(tool_call_messages)

            # Because we have new data, we want to continue the while-loop in `step_stream`
            return True
        else:
            # If we got here, there's no tool call. If finish_reason_stop => done
            return not streaming_interface.finish_reason_stop

    async def _rebuild_context_window(
        self, summarizer: Summarizer, in_context_messages: List[Message], letta_message_db_queue: List[Message]
    ) -> None:
        new_letta_messages = await self.message_manager.create_many_messages_async(letta_message_db_queue, actor=self.actor)

        # TODO: Make this more general and configurable, less brittle
        new_in_context_messages, updated = await summarizer.summarize(
            in_context_messages=in_context_messages, new_letta_messages=new_letta_messages
        )

        await self.agent_manager.set_in_context_messages_async(
            agent_id=self.agent_id, message_ids=[m.id for m in new_in_context_messages], actor=self.actor
        )

    async def _rebuild_memory_async(
        self,
        in_context_messages: List[Message],
        agent_state: AgentState,
    ) -> List[Message]:
        self.num_messages, self.num_archival_memories = await asyncio.gather(
            (
                self.message_manager.size_async(actor=self.actor, agent_id=agent_state.id)
                if self.num_messages is None
                else asyncio.sleep(0, result=self.num_messages)
            ),
            (
                self.passage_manager.agent_passage_size_async(actor=self.actor, agent_id=agent_state.id)
                if self.num_archival_memories is None
                else asyncio.sleep(0, result=self.num_archival_memories)
            ),
        )
        return await super()._rebuild_memory_async(
            in_context_messages, agent_state, num_messages=self.num_messages, num_archival_memories=self.num_archival_memories
        )

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
            tools = [
                t
                for t in agent_state.tools
                if t.tool_type
                in {ToolType.EXTERNAL_COMPOSIO, ToolType.CUSTOM, ToolType.LETTA_FILES_CORE, ToolType.LETTA_BUILTIN, ToolType.EXTERNAL_MCP}
            ]
        else:
            tools = agent_state.tools

        # Special tool state
        search_memory_utterance_description = (
            "A lengthier message to be uttered while your memories of the current conversation are being re-contextualized."
            "You MUST also include punctuation at the end of this message."
            "For example: 'Let me double-check my notes—one moment, please.'"
        )

        search_memory_json = Tool(
            type="function",
            function=enable_strict_mode(  # strict=True   ✓
                add_pre_execution_message(  # injects pre_exec_msg   ✓
                    {
                        "name": "search_memory",
                        "description": (
                            "Look in long-term or earlier-conversation memory **only when** the "
                            "user asks about something missing from the visible context. "
                            "The user's latest utterance is sent automatically as the main query.\n\n"
                            "Optional refinements (set unused fields to *null*):\n"
                            "• `convo_keyword_queries`   – extra names/IDs if the request is vague.\n"
                            "• `start_minutes_ago` / `end_minutes_ago` – limit results to a recent time window."
                        ),
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "convo_keyword_queries": {
                                    "type": ["array", "null"],
                                    "items": {"type": "string"},
                                    "description": (
                                        "Extra keywords (e.g., order ID, place name). " "Use *null* when the utterance is already specific."
                                    ),
                                },
                                "start_minutes_ago": {
                                    "type": ["integer", "null"],
                                    "description": (
                                        "Newer bound of the time window, in minutes ago. " "Use *null* if no lower bound is needed."
                                    ),
                                },
                                "end_minutes_ago": {
                                    "type": ["integer", "null"],
                                    "description": (
                                        "Older bound of the time window, in minutes ago. " "Use *null* if no upper bound is needed."
                                    ),
                                },
                            },
                            "required": [
                                "convo_keyword_queries",
                                "start_minutes_ago",
                                "end_minutes_ago",
                            ],
                            "additionalProperties": False,
                        },
                    },
                    description=search_memory_utterance_description,
                )
            ),
        )

        # TODO: Customize whether or not to have heartbeats, pre_exec_message, etc.
        return [search_memory_json] + [
            Tool(type="function", function=enable_strict_mode(add_pre_execution_message(remove_request_heartbeat(t.json_schema))))
            for t in tools
        ]

    async def _execute_tool(self, user_query: str, tool_name: str, tool_args: dict, agent_state: AgentState) -> "ToolExecutionResult":
        """
        Executes a tool and returns the ToolExecutionResult.
        """
        from letta.schemas.tool_execution_result import ToolExecutionResult

        # Special memory case
        if tool_name == "search_memory":
            tool_result = await self._search_memory(
                archival_query=user_query,
                convo_keyword_queries=tool_args["convo_keyword_queries"],
                start_minutes_ago=tool_args["start_minutes_ago"],
                end_minutes_ago=tool_args["end_minutes_ago"],
                agent_state=agent_state,
            )
            return ToolExecutionResult(
                func_return=tool_result,
                status="success",
            )

        # Find the target tool
        target_tool = next((x for x in agent_state.tools if x.name == tool_name), None)
        if not target_tool:
            return ToolExecutionResult(
                func_return=f"Tool {tool_name} not found",
                status="error",
            )

        # Use ToolExecutionManager for modern tool execution
        sandbox_env_vars = {var.key: var.value for var in agent_state.tool_exec_environment_variables}
        tool_execution_manager = ToolExecutionManager(
            agent_state=agent_state,
            message_manager=self.message_manager,
            agent_manager=self.agent_manager,
            block_manager=self.block_manager,
            job_manager=self.job_manager,
            passage_manager=self.passage_manager,
            sandbox_env_vars=sandbox_env_vars,
            actor=self.actor,
        )

        # Remove request heartbeat / pre_exec_message
        tool_args.pop(PRE_EXECUTION_MESSAGE_ARG, None)
        tool_args.pop(REQUEST_HEARTBEAT_PARAM, None)

        tool_execution_result = await tool_execution_manager.execute_tool_async(
            function_name=tool_name,
            function_args=tool_args,
            tool=target_tool,
            step_id=None,  # VoiceAgent doesn't use step tracking currently
        )

        return tool_execution_result

    async def _search_memory(
        self,
        archival_query: str,
        agent_state: AgentState,
        convo_keyword_queries: Optional[List[str]] = None,
        start_minutes_ago: Optional[int] = None,
        end_minutes_ago: Optional[int] = None,
    ) -> str:
        # Retrieve from archival memory
        now = datetime.now(timezone.utc)
        start_date = now - timedelta(minutes=end_minutes_ago) if end_minutes_ago is not None else None
        end_date = now - timedelta(minutes=start_minutes_ago) if start_minutes_ago is not None else None

        # If both bounds exist but got reversed, swap them
        # Shouldn't happen, but in case LLM misunderstands
        if start_date and end_date and start_date > end_date:
            start_date, end_date = end_date, start_date

        archival_results = await self.agent_manager.list_passages_async(
            actor=self.actor,
            agent_id=self.agent_id,
            query_text=archival_query,
            limit=5,
            embedding_config=agent_state.embedding_config,
            embed_query=True,
            start_date=start_date,
            end_date=end_date,
        )
        formatted_archival_results = [{"timestamp": str(result.created_at), "content": result.text} for result in archival_results]
        response = {
            "archival_search_results": formatted_archival_results,
        }

        # Retrieve from conversation
        keyword_results = {}
        if convo_keyword_queries:
            for keyword in convo_keyword_queries:
                messages = await self.message_manager.list_messages_for_agent_async(
                    agent_id=self.agent_id,
                    actor=self.actor,
                    query_text=keyword,
                    limit=3,
                )
                if messages:
                    keyword_results[keyword] = [message.content[0].text for message in messages]

            response["convo_keyword_search_results"] = keyword_results

        return json.dumps(response, indent=2)
