"""
Shared helper functions for Anthropic-compatible proxy endpoints.

These helpers are used by both the Anthropic and Z.ai proxy routers to reduce code duplication.
"""

import asyncio
import json

from fastapi import Request

from letta.log import get_logger
from letta.server.rest_api.utils import capture_and_persist_messages
from letta.settings import model_settings

logger = get_logger(__name__)


def strip_policy_specs(text: str) -> str:
    """
    Remove Claude policy injection blocks from message text.

    Claude injects policy instructions in two forms:
    1. Appended with prefix: 'user: <policy_spec>...'
    2. As entire message: '<policy_spec>...'

    We truncate everything from the policy start marker onwards since it's all injected policy content.
    """
    # Check if entire message is a policy spec (starts with tag)
    if text.startswith("<policy_spec>"):
        logger.info("[Proxy Helpers] Stripped policy injection (entire message)")
        return ""

    # Check if policy spec is appended (with prefix)
    policy_start = text.find("user: <policy_spec>")
    if policy_start != -1:
        logger.info(f"[Proxy Helpers] Stripped policy injection from position {policy_start}")
        # Truncate everything from this point onwards
        cleaned = text[:policy_start].strip()
        return cleaned

    # No policy injection found, return original text
    return text


def extract_user_messages(body: bytes) -> list[str]:
    """Extract user messages from request body."""
    messages = []
    try:
        request_data = json.loads(body)
        messages = request_data.get("messages", [])

        user_messages = []
        for msg in messages:
            if msg.get("role") == "user":
                content = msg.get("content", "")
                if isinstance(content, str):
                    # Strip policy specs before adding
                    cleaned = strip_policy_specs(content)
                    if cleaned:  # Only add if not empty after stripping
                        user_messages.append(cleaned)
                elif isinstance(content, list):
                    for block in content:
                        if isinstance(block, dict):
                            if block.get("type") == "text":
                                text = block.get("text", "")
                                # Strip policy specs from text blocks
                                cleaned = strip_policy_specs(text)
                                if cleaned:  # Only add if not empty after stripping
                                    user_messages.append(cleaned)
                            elif block.get("type") == "image":
                                user_messages.append("[IMAGE]")

        return user_messages
    except Exception as e:
        logger.warning(f"[Proxy Helpers] Failed to extract user messages from request {messages}: {e}")
        return []


def extract_assistant_message(response_data: dict) -> str:
    """Extract assistant message from response data."""
    content_blocks = []
    try:
        content_blocks = response_data.get("content", [])
        text_parts = []

        for block in content_blocks:
            if isinstance(block, dict) and block.get("type") == "text":
                text_parts.append(block.get("text", ""))

        return "\n".join(text_parts)
    except Exception as e:
        logger.warning(f"[Proxy Helpers] Failed to extract assistant message from response {content_blocks}: {e}")
        return ""


def is_topic_detection_response(message: str) -> bool:
    """
    Check if the assistant message is a topic detection response (contains isNewTopic key).
    These are Claude Code metadata responses that should not be persisted as conversation.
    """
    try:
        stripped = message.strip()
        if stripped.startswith("{") and stripped.endswith("}"):
            parsed = json.loads(stripped)
            # Check for isNewTopic key which indicates topic detection
            if "isNewTopic" in parsed:
                return True
    except (json.JSONDecodeError, AttributeError):
        pass
    return False


def prepare_headers(request: Request, proxy_name: str, use_bearer_auth: bool = False) -> dict | None:
    """
    Prepare headers for forwarding to Anthropic-compatible API.

    Args:
        request: The incoming FastAPI request
        proxy_name: Name of the proxy for logging (e.g., "Anthropic Proxy", "Z.ai Proxy")
        use_bearer_auth: If True, convert x-api-key to Bearer token in Authorization header (for Z.ai)

    Returns:
        Dictionary of headers to forward, or None if authentication fails
    """
    skip_headers = {
        "host",
        "connection",
        "content-length",
        "transfer-encoding",
        "content-encoding",
        "te",
        "upgrade",
        "proxy-authenticate",
        "proxy-authorization",
        "authorization",
    }

    headers = {}
    for key, value in request.headers.items():
        if key.lower() not in skip_headers:
            headers[key] = value

    # Extract API key from headers or fallback to letta's key
    api_key = None
    if "x-api-key" in headers:
        api_key = headers["x-api-key"]
    elif "anthropic-api-key" in headers:
        api_key = headers["anthropic-api-key"]
    else:
        # Fallback to letta's anthropic api key if not provided
        api_key = model_settings.anthropic_api_key
        if api_key:
            logger.info(f"[{proxy_name}] Falling back to Letta's anthropic api key instead of user's key")

    # Handle authentication based on proxy type
    if use_bearer_auth:
        # Z.ai: use Bearer token in Authorization header
        if api_key:
            headers["authorization"] = f"Bearer {api_key}"
        # Keep x-api-key in headers too (doesn't hurt)
        if "x-api-key" not in headers and api_key:
            headers["x-api-key"] = api_key
    else:
        # Anthropic: use x-api-key header
        if api_key and "x-api-key" not in headers:
            headers["x-api-key"] = api_key

    if "content-type" not in headers:
        headers["content-type"] = "application/json"

    return headers


def format_memory_blocks(blocks, agent_id: str) -> str:
    """Format memory blocks for injection into system prompt."""
    blocks_with_content = [block for block in blocks if block.value]

    if not blocks_with_content:
        return ""

    memory_context = (
        "<letta>\n"
        "You have persistent memory powered by Letta that is maintained across conversations. "
        "A background agent updates these memory blocks based on conversation content.\n"
        "<memory_blocks>\n"
        "The following memory blocks are currently engaged in your core memory unit:\n\n"
    )

    for idx, block in enumerate(blocks_with_content):
        label = block.label or "block"
        value = block.value or ""
        desc = block.description or ""
        chars_current = len(value)
        limit = block.limit if block.limit is not None else 0

        memory_context += f"<{label}>\n"
        if desc:
            memory_context += "<description>\n"
            memory_context += f"{desc}\n"
            memory_context += "</description>\n"
        memory_context += "<metadata>\n"
        memory_context += f"- chars_current={chars_current}\n"
        memory_context += f"- chars_limit={limit}\n"
        memory_context += "</metadata>\n"
        memory_context += "<value>\n"
        memory_context += f"{value}\n"
        memory_context += "</value>\n"
        memory_context += f"</{label}>\n"

        if idx != len(blocks_with_content) - 1:
            memory_context += "\n"

    memory_context += "\n</memory_blocks>\n\n"
    memory_context += (
        "<memory_management>\n"
        f"Users can view and edit their memory blocks at:\n"
        f"https://app.letta.com/agents/{agent_id}\n\n"
        "Share this link when users ask how to manage their memory, what you remember about them, or how to view, edit, or delete stored information.\n"
        "</memory_management>\n\n"
        "<documentation>\n"
        "- Memory blocks: https://docs.letta.com/guides/agents/memory-blocks/index.md\n"
        "- Full Letta documentation: https://docs.letta.com/llms.txt\n\n"
        "Reference these when users ask how Letta memory works or want to learn more about the platform.\n"
        "</documentation>\n"
        "</letta>"
    )
    return memory_context


def build_response_from_chunks(chunks: list[bytes]) -> str:
    """Build complete response text from streaming chunks."""
    try:
        text_parts = []
        full_data = b"".join(chunks).decode("utf-8")

        for line in full_data.split("\n"):
            if line.startswith("data: "):
                data_str = line[6:]  # Remove "data: " prefix

                if data_str.strip() in ["[DONE]", ""]:
                    continue

                try:
                    event_data = json.loads(data_str)
                    event_type = event_data.get("type")

                    if event_type == "content_block_delta":
                        delta = event_data.get("delta", {})
                        if delta.get("type") == "text_delta":
                            text_parts.append(delta.get("text", ""))
                except json.JSONDecodeError:
                    continue

        return "".join(text_parts)
    except Exception as e:
        logger.warning(f"[Proxy Helpers] Failed to build response from chunks: {e}")
        return ""


async def inject_memory_context(
    server,
    agent,
    actor,
    request_data: dict,
    proxy_name: str,
) -> dict:
    """
    Inject memory context into the request system prompt.

    Args:
        server: SyncServer instance
        agent: Agent to get memory from
        actor: Actor performing the operation
        request_data: Request data dictionary to modify
        proxy_name: Name of the proxy for logging (e.g., "Anthropic Proxy", "Z.ai Proxy")

    Returns:
        Modified request data with memory context injected
    """
    try:
        messages = request_data.get("messages", [])
        if not messages:
            return request_data

        memory_context = format_memory_blocks(agent.blocks, agent.id)

        if not memory_context:
            logger.debug(f"[{proxy_name}] No memory blocks found, skipping memory injection")
            return request_data

        block_count = len([b for b in agent.blocks if b.value])
        logger.info(f"[{proxy_name}] Injecting {block_count} memory block(s) into request")

        # Inject into system prompt
        modified_data = request_data.copy()

        # Check if there's already a system prompt
        # Anthropic API accepts system as either a string or list of content blocks
        existing_system = modified_data.get("system", "")

        # Handle both string and list system prompts
        if isinstance(existing_system, list):
            # If it's a list, prepend our context as a text block
            modified_data["system"] = existing_system + [{"type": "text", "text": memory_context.rstrip()}]
        elif existing_system:
            # If it's a non-empty string, prepend our context
            modified_data["system"] = memory_context + existing_system
        else:
            # No existing system prompt
            modified_data["system"] = memory_context.rstrip()

        # Fix max_tokens if using extended thinking
        # Anthropic requires max_tokens > thinking.budget_tokens
        if "thinking" in modified_data and isinstance(modified_data["thinking"], dict):
            budget_tokens = modified_data["thinking"].get("budget_tokens", 0)
            current_max_tokens = modified_data.get("max_tokens", 0)

            if budget_tokens > 0 and current_max_tokens <= budget_tokens:
                # Set max_tokens to budget_tokens + reasonable buffer for response
                # Claude Code typically uses budget_tokens around 10000-20000
                modified_data["max_tokens"] = budget_tokens + 4096
                logger.info(
                    f"[{proxy_name}] Adjusted max_tokens from {current_max_tokens} to {modified_data['max_tokens']} (thinking.budget_tokens={budget_tokens})"
                )

        return modified_data

    except Exception as e:
        logger.exception(f"[{proxy_name}] Failed to inject memory context: {e}")
        return request_data


async def persist_messages_background(
    server,
    agent,
    actor,
    user_messages: list[str],
    assistant_message: str,
    model_name: str,
    proxy_name: str,
):
    """
    Background task to persist messages without blocking the response.

    This runs asynchronously after the response is returned to minimize latency.

    Args:
        server: SyncServer instance
        agent: Agent to persist messages for
        actor: Actor performing the operation
        user_messages: List of user messages to persist
        assistant_message: Assistant message to persist
        model_name: Model name for the messages
        proxy_name: Name of the proxy for logging (e.g., "Anthropic Proxy", "Z.ai Proxy")
    """
    try:
        result = await capture_and_persist_messages(
            server=server,
            agent=agent,
            actor=actor,
            user_messages=user_messages,
            assistant_message=assistant_message,
            model=model_name,
        )
        if result.get("success"):
            logger.info(f"[{proxy_name}] Persisted messages: {result['messages_created']} messages saved")
        else:
            logger.debug(f"[{proxy_name}] Skipped persistence: {result.get('reason', 'unknown')}")
    except Exception as e:
        logger.error(f"[{proxy_name}] Failed to persist messages in background: {e}")


async def check_for_duplicate_message(server, agent, actor, user_messages: list[str], proxy_name: str) -> list[str]:
    """
    Check if the last user message is a duplicate of the most recent persisted message.

    Returns a filtered list with duplicates removed to prevent race conditions.

    Args:
        server: SyncServer instance
        agent: Agent to check messages for
        actor: Actor performing the operation
        user_messages: List of user messages to check
        proxy_name: Name of the proxy for logging

    Returns:
        Filtered list of user messages (empty if duplicate detected)
    """
    user_messages_to_persist = user_messages.copy() if user_messages else []
    if user_messages_to_persist:
        try:
            from letta.schemas.enums import MessageRole

            recent_messages = await server.message_manager.list_messages(
                agent_id=agent.id,
                actor=actor,
                limit=5,
                roles=[MessageRole.user],
                ascending=False,
            )
            if recent_messages:
                last_user_msg = recent_messages[0]
                last_message_text = ""
                if last_user_msg.content:
                    for content_block in last_user_msg.content:
                        if hasattr(content_block, "text"):
                            last_message_text += content_block.text

                incoming_msg = user_messages_to_persist[-1]
                if last_message_text and last_message_text == incoming_msg:
                    logger.info(f"[{proxy_name}] Skipping duplicate user message: {incoming_msg[:100]}...")
                    user_messages_to_persist = []
        except Exception as e:
            logger.warning(f"[{proxy_name}] Failed to check for duplicate messages: {e}")

    return user_messages_to_persist


async def backfill_agent_project_id(server, agent, actor, project_id: str):
    """
    Temporary helper to backfill project_id for legacy agents.

    TODO(@caren): Remove this function after all existing Claude Code agents have been backfilled.

    Args:
        server: SyncServer instance
        agent: Agent to update
        actor: Actor performing the operation
        project_id: Project ID to set

    Returns:
        Updated agent or original agent if update fails
    """
    from letta.schemas.agent import UpdateAgent

    try:
        updated_agent = await server.update_agent_async(
            agent_id=agent.id,
            request=UpdateAgent(project_id=project_id),
            actor=actor,
        )
        logger.info(f"[Backfill] Successfully updated agent {agent.id} with project_id {project_id}")
        return updated_agent
    except Exception as e:
        logger.warning(f"[Backfill] Failed to update agent project_id: {e}. Continuing with in-memory update.")
        # Fallback: continue with in-memory update
        agent.project_id = project_id
        return agent


async def get_or_create_claude_code_agent(
    server,
    actor,
    project_id: str = None,
    agent_id: str = None,
):
    """
    Get or create a special agent for Claude Code sessions.

    Args:
        server: SyncServer instance
        actor: Actor performing the operation (user ID)
        project_id: Optional project ID to associate the agent with
        agent_id: Optional specific agent ID to use (from X-LETTA-AGENT-ID header)

    Returns:
        Agent instance
    """
    from letta.schemas.agent import CreateAgent

    # If a specific agent ID is provided, try to use it directly
    if agent_id:
        logger.debug(f"Attempting to fetch agent by ID: {agent_id}")
        try:
            agent = await server.agent_manager.get_agent_by_id_async(agent_id=agent_id, actor=actor)
            logger.info(f"Found agent via X-LETTA-AGENT-ID header: {agent.id} (name: {agent.name})")
            return agent
        except Exception as e:
            logger.warning(f"Could not find agent with ID {agent_id}: {e}. Falling back to default behavior.")
            # Fall through to default behavior below

    # Create short user identifier from UUID (first 8 chars)
    if actor:
        user_short_id = str(actor.id)[:8] if hasattr(actor, "id") else str(actor)[:8]
    else:
        user_short_id = "default"

    agent_name = f"claude-code-{user_short_id}"

    try:
        # Try to find existing agent by name (most reliable)
        # Note: Search by name only, not tags, since name is unique and more reliable
        logger.debug(f"Searching for agent with name: {agent_name}")
        agents = await server.agent_manager.list_agents_async(
            actor=actor,
            limit=10,  # Get a few in case of duplicates
            name=agent_name,
            include=["agent.blocks", "agent.managed_group", "agent.tags"],
        )

        # list_agents_async returns a list directly, not an object with .agents
        logger.debug(f"Agent search returned {len(agents) if agents else 0} results")
        if agents and len(agents) > 0:
            # Return the first matching agent
            logger.info(f"Found existing Claude Code agent: {agents[0].id} (name: {agent_name})")
            agent = agents[0]

            # Temporary patch: Fix project_id if it's missing (legacy bug)
            # TODO(@caren): Remove this after all existing Claude Code agents have been backfilled
            if not agent.project_id and project_id:
                logger.info(f"[Backfill] Agent {agent.id} missing project_id, backfilling with {project_id}")
                agent = await backfill_agent_project_id(server, agent, actor, project_id)

            return agent
        else:
            logger.debug(f"No existing agent found with name: {agent_name}")

    except Exception as e:
        logger.warning(f"Could not find existing agent: {e}", exc_info=True)

    # Create new agent
    try:
        logger.info(f"Creating new Claude Code agent: {agent_name} with project_id: {project_id}")

        # Create minimal agent config
        agent_config = CreateAgent(
            name=agent_name,
            description="Agent for capturing Claude Code conversations",
            memory_blocks=[
                {
                    "label": "human",
                    "value": "This is my section of core memory devoted to information about the human.\nI don't yet know anything about them.\nWhat's their name? Where are they from? What do they do? Who are they?\nI should update this memory over time as I interact with the human and learn more about them.",
                    "description": "A memory block for keeping track of the human (user) the agent is interacting with.",
                },
                {
                    "label": "persona",
                    "value": "This is my section of core memory devoted to information myself.\nThere's nothing here yet.\nI should update this memory over time as I develop my personality.",
                    "description": "A memory block for storing the agent's core personality details and behavior profile.",
                },
                {
                    "label": "project",
                    "value": "This is my section of core memory devoted to information about what the agent is working on.\nI don't yet know anything about it.\nI should update this memory over time with high level understanding and learnings.",
                    "description": "A memory block for storing the information about the project the agent is working on.",
                },
            ],
            tags=["claude-code"],
            enable_sleeptime=True,
            agent_type="letta_v1_agent",
            model="anthropic/claude-sonnet-4-5-20250929",
            embedding="openai/text-embedding-ada-002",
            project_id=project_id,
        )

        new_agent = await server.create_agent_async(
            request=agent_config,
            actor=actor,
        )

        logger.info(f"Created Claude Code agent {new_agent.name}: {new_agent.id}")
        return new_agent

    except Exception as e:
        logger.exception(f"Failed to create Claude Code agent: {e}")
        raise
