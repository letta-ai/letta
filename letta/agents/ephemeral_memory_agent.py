import json
from datetime import datetime
from typing import AsyncGenerator, Dict, List

import openai

from letta.agents.base_agent import BaseAgent
from letta.schemas.agent import AgentState
from letta.schemas.block import BlockUpdate
from letta.schemas.enums import MessageRole
from letta.schemas.letta_message import UserMessage
from letta.schemas.letta_message_content import TextContent
from letta.schemas.message import Message
from letta.schemas.openai.chat_completion_request import ChatCompletionRequest, Tool
from letta.schemas.user import User
from letta.services.agent_manager import AgentManager
from letta.services.block_manager import BlockManager
from letta.services.message_manager import MessageManager


class EphemeralMemoryAgent(BaseAgent):
    """
    A stateless agent that helps with offline memory computations.
    """

    def __init__(
        self,
        agent_id: str,
        openai_client: openai.AsyncClient,
        message_manager: MessageManager,
        agent_manager: AgentManager,
        block_manager: BlockManager,
        target_block_label: str,
        actor: User,
    ):
        super().__init__(
            agent_id=agent_id,
            openai_client=openai_client,
            message_manager=message_manager,
            agent_manager=agent_manager,
            actor=actor,
        )

        self.block_manager = block_manager
        self.target_block_label = target_block_label

    async def step(self, input_message: UserMessage) -> List[Message]:
        """
        Process the user's input message, allowing the model to call memory-related tools
        until it decides to stop and provide a final response.
        """
        agent_state = self.agent_manager.get_agent_by_id(agent_id=self.agent_id, actor=self.actor)

        # Pre-process the input message
        input_message_dict = self.pre_process_input_message(input_message=input_message)

        # Create initial list of messages for the OpenAI request
        openai_messages = [input_message_dict]

        # Keep track of all assistant responses
        assistant_responses = []

        # Start a conversation loop that continues until the model decides to stop calling tools
        while True:
            # Build the request with the current messages
            request = self._build_openai_request(openai_messages, agent_state)

            # Send the request to OpenAI
            chat_completion = await self.openai_client.chat.completions.create(**request.model_dump(exclude_unset=True))

            # Get the response
            assistant_message = chat_completion.choices[0].message

            # If no tool calls, the agent has finished
            if not assistant_message.tool_calls:
                # Add the final response
                assistant_responses.append(
                    Message(
                        role=MessageRole.assistant,
                        content=[TextContent(text=assistant_message.content.strip() if assistant_message.content else "")],
                    )
                )
                break

            # Process tool calls
            for tool_call in assistant_message.tool_calls:
                function_name = tool_call.function.name
                function_args = json.loads(tool_call.function.arguments)

                # Execute the appropriate tool function based on the name
                if function_name == "store_episodic_memory":
                    print("Called store_episodic_memory")
                    result = await self.store_episodic_memory(agent_state=agent_state, **function_args)
                elif function_name == "store_semantic_memory":
                    print("Called store_semantic_memory")
                    result = await self.store_semantic_memory(agent_state=agent_state, **function_args)
                elif function_name == "summarize_stored_memories":
                    print("Called summarize_stored_memories")
                    result = await self.summarize_stored_memories(agent_state=agent_state, **function_args)
                else:
                    result = f"Error: Unknown tool function '{function_name}'"

                # Add the tool call and its result to the conversation
                openai_messages.append(
                    {
                        "role": "assistant",
                        "content": assistant_message.content,
                        "tool_calls": [
                            {
                                "id": tool_call.id,
                                "type": "function",
                                "function": {"name": function_name, "arguments": tool_call.function.arguments},
                            }
                        ],
                    }
                )

                openai_messages.append({"role": "tool", "tool_call_id": tool_call.id, "content": str(result)})

        return assistant_responses

    def _format_messages_llm_friendly(self):
        messages = self.message_manager.list_messages_for_agent(agent_id=self.agent_id, actor=self.actor)

        llm_friendly_messages = [f"{m.role}: {m.content[0].text}" for m in messages if m.content and isinstance(m.content[0], TextContent)]
        return "\n".join(llm_friendly_messages)

    def _build_openai_request(self, openai_messages: List[Dict], agent_state: AgentState) -> ChatCompletionRequest:
        openai_request = ChatCompletionRequest(
            model="gpt-4o",  # agent_state.llm_config.model, # TODO: Separate config for summarizer?
            messages=openai_messages,
            tools=self._build_tool_schemas(),
            tool_choice="auto",  # Changed from "required" to allow the model to choose when to stop using tools
            user=self.actor.id,
            max_completion_tokens=agent_state.llm_config.max_tokens,
            temperature=agent_state.llm_config.temperature,
            stream=False,
        )
        return openai_request

    def _build_tool_schemas(self) -> List[Tool]:
        """
        Build the schemas for the three memory-related tools.
        """
        tools = [
            Tool(
                type="function",
                function={
                    "name": "store_episodic_memory",
                    "description": "Store a specific event or conversation as an episodic memory",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "memory": {
                                "type": "string",
                                "description": "The episodic memory to store. Please make sure to add context of the message history around this point that lead you to add this memory.",
                            },
                        },
                        "required": ["memory"],
                    },
                },
            ),
            Tool(
                type="function",
                function={
                    "name": "store_semantic_memory",
                    "description": "Store general information or facts about the human as semantic memory",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "memory": {
                                "type": "string",
                                "description": "The semantic memory to store. Please make sure to add context of the message history around this point that lead you to add this memory.",
                            },
                        },
                        "required": ["memory"],
                    },
                },
            ),
            Tool(
                type="function",
                function={
                    "name": "summarize_stored_memories",
                    "description": "Log a summary of memory storage events for the main agent",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "summary": {
                                "type": "string",
                                "description": "A summary for each of the memories you decided to store. Try to keep the summary brief and high level.",
                            }
                        },
                        "required": ["summary"],
                    },
                },
            ),
        ]

        return tools

    async def store_episodic_memory(self, memory: str, agent_state: AgentState) -> str:
        """
        Store an episodic memory.
        """
        self.agent_manager.passage_manager.insert_passage(
            agent_state=agent_state,
            agent_id=agent_state.id,
            text=memory,
            actor=self.actor,
        )
        self.agent_manager.rebuild_system_prompt(agent_id=agent_state.id, actor=self.actor, force=True)

        return f"Successfully stored episodic memory..."

    async def store_semantic_memory(self, memory: str, agent_state: AgentState) -> str:
        """
        Store a semantic memory.
        """
        # Placeholder implementation
        self.agent_manager.passage_manager.insert_passage(
            agent_state=agent_state,
            agent_id=agent_state.id,
            text=memory,
            actor=self.actor,
        )
        self.agent_manager.rebuild_system_prompt(agent_id=agent_state.id, actor=self.actor, force=True)

        return f"Successfully stored semantic memory..."

    async def summarize_stored_memories(self, summary: str, agent_state: AgentState) -> str:
        """
        Summarize stored memories.
        """
        current_value = str(agent_state.memory.get_block(self.target_block_label).value)
        new_value = current_value + "\n" + f"[{datetime.now().strftime("%Y-%m-%d %H:%M:%S")}] {str(summary)}]"
        agent_state.memory.update_block_value(label=self.target_block_label, value=new_value)
        target_block = next(b for b in agent_state.memory.blocks if b.label == self.target_block_label)
        self.block_manager.update_block(block_id=target_block.id, block_update=BlockUpdate(value=new_value), actor=self.actor)

        return f"Successfully stored memory summary..."

    async def step_stream(self, input_message: UserMessage) -> AsyncGenerator[str, None]:
        """
        This agent is synchronous-only. If called in an async context, raise an error.
        """
        raise NotImplementedError("EphemeralMemoryAgent does not support async step.")
