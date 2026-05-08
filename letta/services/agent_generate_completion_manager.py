"""Manager for handling direct LLM completions using agent configuration."""

from typing import TYPE_CHECKING, Any, Dict, Optional

from letta.errors import LLMError
from letta.llm_api.llm_client import LLMClient
from letta.log import get_logger
from letta.schemas.enums import AgentType, MessageRole
from letta.schemas.letta_message_content import TextContent
from letta.schemas.message import Message
from letta.schemas.usage import LettaUsageStatistics

# Tool name used for structured output via tool forcing
STRUCTURED_OUTPUT_TOOL_NAME = "structured_output"

if TYPE_CHECKING:
    from letta.orm import User
    from letta.schemas.llm_config import LLMConfig
    from letta.server.server import SyncServer

logger = get_logger(__name__)


def _schema_to_tool_definition(schema: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert a JSON schema into a tool definition for forced tool calling.

    Args:
        schema: JSON schema object with 'properties' and optionally 'required'

    Returns:
        Tool definition dict compatible with OpenAI/Anthropic function calling format
    """
    return {
        "name": STRUCTURED_OUTPUT_TOOL_NAME,
        "description": "Returns a structured response matching the requested schema.",
        "parameters": {
            "type": "object",
            "properties": schema.get("properties", {}),
            "required": schema.get("required", list(schema.get("properties", {}).keys())),
        },
    }


class GenerateResponse:
    """Response from direct LLM generation."""

    def __init__(self, content: str, model: str, usage: LettaUsageStatistics):
        self.content = content
        self.model = model
        self.usage = usage


class AgentGenerateCompletionManager:
    """Manager for handling direct LLM completions using agent configuration."""

    def __init__(self, server: "SyncServer"):
        """
        Initialize the agent generate completion manager.

        Args:
            server: The SyncServer instance for accessing managers
        """
        self.server = server
        self.agent_manager = server.agent_manager
        self.provider_manager = server.provider_manager

    async def generate_completion_with_agent_config_async(
        self,
        agent_id: str,
        prompt: str,
        actor: "User",
        system_prompt: Optional[str] = None,
        override_model: Optional[str] = None,
        response_schema: Optional[Dict[str, Any]] = None,
    ) -> GenerateResponse:
        """
        Generate a completion directly from the LLM provider using the agent's configuration.

        This method makes a direct request to the LLM provider without any agent processing:
        - No memory or context retrieval
        - No tool calling (unless response_schema is provided)
        - No message persistence
        - No agent state modification

        Args:
            agent_id: The agent ID whose configuration to use
            prompt: The prompt/message to send to the LLM
            actor: The user making the request
            system_prompt: Optional system prompt to prepend to the conversation
            override_model: Optional model handle to override the agent's default
                          (e.g., 'openai/gpt-4', 'anthropic/claude-3-5-sonnet')
            response_schema: Optional JSON schema for structured output. When provided,
                           the LLM will be forced to return a response matching this
                           schema via tool calling.

        Returns:
            GenerateResponse with content, model, and usage statistics.
            When response_schema is provided, content will be the JSON string
            matching the schema.

        Raises:
            NoResultFound: If agent not found
            HandleNotFoundError: If override_model is invalid
            LLMError: If LLM provider error occurs
        """
        # 1. Validate agent exists and user has access
        agent = await self.agent_manager.get_agent_by_id_async(
            agent_id,
            actor,
            include_relationships=[],
        )

        # 2. Get LLM config (with optional override)
        llm_config: "LLMConfig" = agent.llm_config
        if override_model:
            # Get full LLM config for the override model
            # This ensures we get the right provider, endpoint, credentials, etc.
            llm_config = await self.server.get_llm_config_from_handle_async(
                actor=actor,
                handle=override_model,
            )

        logger.info(
            f"Generating completion for agent {agent_id}",
            extra={
                "agent_id": str(agent_id),
                "override_model": override_model,
                "prompt_length": len(prompt),
                "has_system_prompt": system_prompt is not None,
                "has_response_schema": response_schema is not None,
                "model": llm_config.model,
            },
        )

        # 3. Build messages from prompt and optional system_prompt
        letta_messages = []

        # Always add a system message (required by some providers like Anthropic)
        # Use provided system_prompt or minimal default (empty strings not allowed with cache_control)
        letta_messages.append(
            Message(
                role=MessageRole.system,
                content=[TextContent(text=system_prompt if system_prompt else "You are a helpful assistant.")],
            )
        )

        # Add user prompt
        letta_messages.append(
            Message(
                role=MessageRole.user,
                content=[TextContent(text=prompt)],
            )
        )

        # 4. Create LLM client for the provider
        llm_client = LLMClient.create(
            provider_type=llm_config.model_endpoint_type,
            actor=actor,
        )

        if llm_client is None:
            raise LLMError(f"Unsupported provider type: {llm_config.model_endpoint_type}")

        # 5. Build request data
        # If response_schema is provided, create a tool and force the model to call it
        tools = None
        force_tool_call = None
        if response_schema:
            tools = [_schema_to_tool_definition(response_schema)]
            force_tool_call = STRUCTURED_OUTPUT_TOOL_NAME

        # TODO: create a separate agent type
        effective_agent_type = AgentType.split_thread_agent if response_schema else agent.agent_type

        request_data = llm_client.build_request_data(
            agent_type=effective_agent_type,
            messages=letta_messages,
            llm_config=llm_config,
            tools=tools,
            force_tool_call=force_tool_call,
        )

        # 6. Make direct LLM request
        response_data = await llm_client.request_async(request_data, llm_config)

        # 7. Convert to standard chat completion format
        chat_completion = await llm_client.convert_response_to_chat_completion(
            response_data,
            letta_messages,
            llm_config,
        )

        # 8. Extract response content
        content = ""
        if chat_completion.choices and len(chat_completion.choices) > 0:
            message = chat_completion.choices[0].message

            if response_schema:
                # When using structured output, extract from tool call arguments
                if message.tool_calls and len(message.tool_calls) > 0:
                    # The tool call arguments contain the structured output as JSON string
                    content = message.tool_calls[0].function.arguments
                else:
                    # Fallback: some providers may return in content even with tool forcing
                    content = message.content or ""
                    logger.warning(
                        "Expected tool call for structured output but got content response",
                        extra={"agent_id": str(agent_id), "content_length": len(content)},
                    )
            else:
                content = message.content or ""

        # 9. Extract usage statistics
        usage = llm_client.extract_usage_statistics(response_data, llm_config)

        # 10. Build and return response
        return GenerateResponse(
            content=content,
            model=llm_config.model,
            usage=usage,
        )
