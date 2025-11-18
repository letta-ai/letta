"""
Anthropic API proxy router.

This router proxies requests to the Anthropic API, allowing Claude Code CLI
to use Letta as an intermediary by setting anthropic_base_url in settings.json.
"""

import asyncio
import os

import httpx
from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response, StreamingResponse

from letta.log import get_logger
from letta.server.rest_api.dependencies import HeaderParams, get_headers, get_letta_server
from letta.server.rest_api.utils import (
    capture_and_persist_messages,
    get_or_create_claude_code_agent,
)
from letta.server.server import SyncServer
from letta.settings import model_settings

logger = get_logger(__name__)

router = APIRouter(prefix="/anthropic", tags=["anthropic"])

# Anthropic API base URL
ANTHROPIC_API_BASE = "https://api.anthropic.com"


def extract_user_messages(body: bytes) -> list[str]:
    """
    Extract user messages from the request body.

    Returns a list of user message content strings.
    """
    try:
        import json

        request_data = json.loads(body)
        messages = request_data.get("messages", [])

        user_messages = []
        for msg in messages:
            if msg.get("role") == "user":
                content = msg.get("content", "")
                # Content can be a string or a list of content blocks
                if isinstance(content, str):
                    user_messages.append(content)
                elif isinstance(content, list):
                    # Extract text from content blocks
                    for block in content:
                        if isinstance(block, dict) and block.get("type") == "text":
                            user_messages.append(block.get("text", ""))

        return user_messages
    except Exception as e:
        logger.warning(f"Failed to extract user messages: {e}")
        return []


def extract_assistant_message(response_data: dict) -> str:
    """
    Extract assistant message text from Anthropic API response.

    Returns the concatenated text content from the assistant's response.
    """
    try:
        content_blocks = response_data.get("content", [])
        text_parts = []

        for block in content_blocks:
            if isinstance(block, dict) and block.get("type") == "text":
                text_parts.append(block.get("text", ""))

        return "\n".join(text_parts)
    except Exception as e:
        logger.warning(f"Failed to extract assistant message: {e}")
        return ""


def _build_response_from_chunks(chunks: list[bytes]) -> str:
    """
    Build assistant message from streaming response chunks.

    Parses SSE (Server-Sent Events) format and extracts text deltas.
    """
    try:
        import json

        text_parts = []
        full_data = b"".join(chunks).decode("utf-8")

        # Parse SSE format: "data: {json}\n\n"
        for line in full_data.split("\n"):
            if line.startswith("data: "):
                data_str = line[6:]  # Remove "data: " prefix

                # Skip special messages
                if data_str.strip() in ["[DONE]", ""]:
                    continue

                try:
                    event_data = json.loads(data_str)
                    event_type = event_data.get("type")

                    # Extract text from content_block_delta events
                    if event_type == "content_block_delta":
                        delta = event_data.get("delta", {})
                        if delta.get("type") == "text_delta":
                            text_parts.append(delta.get("text", ""))
                except json.JSONDecodeError:
                    continue

        return "".join(text_parts)
    except Exception as e:
        logger.warning(f"Failed to build response from chunks: {e}")
        return ""


async def _inject_memory_context(
    server,
    agent,
    actor,
    request_data: dict,
) -> dict:
    """
    Inject relevant memory context into the request.

    Searches agent's memory and prepends relevant context to the system prompt.

    Args:
        server: SyncServer instance
        agent_id: Agent ID to search memory
        actor: Actor performing the operation
        request_data: Original request data dict

    Returns:
        Modified request data with memory context injected
    """
    try:
        # Extract user messages to use as search query
        messages = request_data.get("messages", [])
        if not messages:
            return request_data

        memory_context = "Memory context from prior conversation:\n\n"
        found = False
        block_count = 0
        for block in agent.blocks:
            if block.value:
                memory_context += f"{block.label.upper()}: {block.value}\n\n"
                found = True
                block_count += 1

        if not found:
            logger.debug("No memory blocks found, skipping memory injection")
            return request_data

        memory_context = memory_context.rstrip()

        logger.info(f"💭 Injecting {block_count} memory block(s) into request")

        # Inject into system prompt
        modified_data = request_data.copy()

        # Check if there's already a system prompt
        # Anthropic API accepts system as either a string or list of content blocks
        existing_system = modified_data.get("system", "")

        # Handle both string and list system prompts
        if isinstance(existing_system, list):
            # If it's a list, prepend our context as a text block
            modified_data["system"] = [{"type": "text", "text": memory_context.rstrip()}] + existing_system
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
                    f"⚠️ Adjusted max_tokens from {current_max_tokens} to {modified_data['max_tokens']} (thinking.budget_tokens={budget_tokens})"
                )

        return modified_data

    except Exception as e:
        logger.exception(f"Failed to inject memory context: {e}")
        return request_data


async def _persist_messages_background(
    server,
    agent,
    actor,
    user_messages: list[str],
    assistant_message: str,
    model_name: str,
):
    """
    Background task to persist messages without blocking the response.

    This runs asynchronously after the response is returned to minimize latency.
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
        logger.info(f"✅ Persisted messages: {result['messages_created']} messages saved")
    except Exception as e:
        logger.error(f"Failed to persist messages in background: {e}")


@router.api_route("/v1/messages", methods=["POST"], operation_id="anthropic_messages_proxy", include_in_schema=False)
async def anthropic_messages_proxy(
    request: Request,
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Proxy endpoint for Anthropic Messages API.

    This endpoint forwards requests to the Anthropic API, allowing Claude Code CLI
    to use Letta as a proxy by configuring anthropic_base_url.

    Usage in Claude Code CLI settings.json:
    {
        "env": {
            "ANTHROPIC_BASE_URL": "http://localhost:8283/v1/anthropic"
        }
    }
    """
    # Get the request body
    body = await request.body()

    logger.info(f"Proxying request to Anthropic Messages API: {ANTHROPIC_API_BASE}/v1/messages")
    logger.debug(f"Request body preview: {body[:200]}...")

    actor = await server.user_manager.get_actor_or_default_async(headers.actor_id)

    # Extract and log user messages
    user_messages = extract_user_messages(body)

    # Check if this is a system/metadata request (Claude Code internal)
    # These start with <system-reminder> and shouldn't be captured
    is_system_request = False
    if user_messages:
        first_message = user_messages[0] if len(user_messages) > 0 else ""
        if first_message.startswith("<system-reminder>"):
            is_system_request = True
            logger.debug("Skipping capture/memory for system request")

    if user_messages and not is_system_request:
        logger.info("=" * 70)
        logger.info("📨 CAPTURED USER MESSAGE(S):")
        for i, msg in enumerate(user_messages, 1):
            logger.info(f"  [{i}] {msg[:200]}{'...' if len(msg) > 200 else ''}")
        logger.info("=" * 70)

    # Get Anthropic API key from headers or fall back to settings
    # Claude Code sends X-Api-Key header (normalized to x-api-key by FastAPI)
    # Priority: x-api-key header (from Claude Code) > server settings (fallback)
    # anthropic_api_key = request.headers.get("x-api-key") or model_settings.anthropic_api_key
    anthropic_api_key = model_settings.anthropic_api_key

    if not anthropic_api_key:
        logger.error("No Anthropic API key found in headers or settings")
        return Response(
            content='{"error": {"type": "authentication_error", "message": "Anthropic API key required. Pass via anthropic-api-key or x-api-key header."}}',
            status_code=401,
            media_type="application/json",
        )

    logger.debug(f"Using Anthropic API key: {anthropic_api_key[:10]}...")

    # Prepare headers for Anthropic API
    anthropic_headers = {
        "x-api-key": anthropic_api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }

    # Check if this is a streaming request
    try:
        import json

        request_data = json.loads(body)
        is_streaming = request_data.get("stream", False)
        model_name = request_data.get("model")
        logger.debug(f"Request is streaming: {is_streaming}")
        logger.debug(f"Model: {model_name}")
    except Exception as e:
        logger.warning(f"Failed to parse request body: {e}")
        is_streaming = False
        model_name = None

    # Get or create agent for Claude Code session (skip for system requests)
    # Note: Agent lookup and memory search are blocking operations before forwarding.
    # Message persistence happens in the background after the response is returned.
    agent = None
    if not is_system_request:
        try:
            agent = await get_or_create_claude_code_agent(
                server=server,
                actor=actor,
            )
            logger.debug(f"Using agent ID: {agent.id}")
        except Exception as e:
            logger.error(f"Failed to get/create agent: {e}")

    # Inject memory context into request (skip for system requests)
    # TODO: Optimize - skip memory injection on subsequent messages in same session
    # TODO: Add caching layer to avoid duplicate memory searches
    modified_body = body
    if agent and request_data and not is_system_request:
        modified_request_data = await _inject_memory_context(
            server=server,
            agent=agent,
            actor=actor,
            request_data=request_data,
        )
        # Re-encode the modified request
        import json

        modified_body = json.dumps(modified_request_data).encode("utf-8")

    # Forward the request to Anthropic API
    # Note: For streaming, we create the client outside the generator to keep it alive
    if is_streaming:
        # Handle streaming response
        collected_chunks = []

        async def stream_response():
            # Create client inside the generator so it stays alive during streaming
            async with httpx.AsyncClient(timeout=300.0) as client:
                async with client.stream(
                    "POST",
                    f"{ANTHROPIC_API_BASE}/v1/messages",
                    headers=anthropic_headers,
                    content=modified_body,
                ) as response:
                    async for chunk in response.aiter_bytes():
                        collected_chunks.append(chunk)
                        yield chunk

                # After streaming is complete, extract and log assistant message
                assistant_message = _build_response_from_chunks(collected_chunks)
                if assistant_message:
                    logger.info("=" * 70)
                    logger.info("🤖 CAPTURED ASSISTANT RESPONSE (streaming):")
                    logger.info(f"  {assistant_message[:500]}{'...' if len(assistant_message) > 500 else ''}")
                    logger.info("=" * 70)

                    # Persist messages to database (non-blocking, skip for system requests)
                    if agent and user_messages and not is_system_request:
                        asyncio.create_task(
                            _persist_messages_background(
                                server=server,
                                agent=agent,
                                actor=actor,
                                user_messages=user_messages,
                                assistant_message=assistant_message,
                                model_name=model_name,
                            )
                        )

        return StreamingResponse(
            stream_response(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        )

    # Non-streaming path
    async with httpx.AsyncClient(timeout=300.0) as client:
        try:
            # Handle non-streaming response
            response = await client.post(
                f"{ANTHROPIC_API_BASE}/v1/messages",
                headers=anthropic_headers,
                content=modified_body,
            )

            logger.info(f"Successfully proxied request, status: {response.status_code}")

            # Extract and log assistant message
            if response.status_code == 200:
                try:
                    import json

                    response_data = json.loads(response.content)
                    assistant_message = extract_assistant_message(response_data)
                    if assistant_message:
                        logger.info("=" * 70)
                        logger.info("🤖 CAPTURED ASSISTANT RESPONSE:")
                        logger.info(f"  {assistant_message[:500]}{'...' if len(assistant_message) > 500 else ''}")
                        logger.info("=" * 70)

                        # Persist messages to database (non-blocking, skip for system requests)
                        if agent and user_messages and not is_system_request:
                            asyncio.create_task(
                                _persist_messages_background(
                                    server=server,
                                    agent=agent,
                                    actor=actor,
                                    user_messages=user_messages,
                                    assistant_message=assistant_message,
                                    model_name=model_name,
                                )
                            )
                except Exception as e:
                    logger.warning(f"Failed to extract assistant response for logging: {e}")

            return Response(
                content=response.content,
                status_code=response.status_code,
                media_type=response.headers.get("content-type", "application/json"),
                headers={
                    k: v
                    for k, v in response.headers.items()
                    if k.lower() not in ["content-encoding", "content-length", "transfer-encoding", "connection"]
                },
            )

        except httpx.HTTPError as e:
            logger.error(f"Error proxying request to Anthropic API: {e}")
            return Response(
                content=f'{{"error": {{"type": "api_error", "message": "Failed to proxy request to Anthropic API: {str(e)}"}}}}',
                status_code=500,
                media_type="application/json",
            )


@router.api_route(
    "/v1/{endpoint:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    operation_id="anthropic_catchall_proxy",
    include_in_schema=False,
)
async def anthropic_catchall_proxy(
    endpoint: str,
    request: Request,
    server: SyncServer = Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """
    Catch-all proxy for other Anthropic API endpoints.

    This forwards all other requests (like /v1/messages/count_tokens) directly to Anthropic
    without message capture or memory injection.
    """
    # Skip the /v1/messages endpoint (handled by specific route)
    if endpoint == "messages" and request.method == "POST":
        # This should be handled by the specific route, but just in case return error
        return Response(
            content='{"error": {"type": "routing_error", "message": "Use specific /v1/messages endpoint"}}',
            status_code=500,
            media_type="application/json",
        )

    # Get the request body
    body = await request.body()

    # Reconstruct the full path
    path = f"v1/{endpoint}"

    logger.info(f"Proxying catch-all request: {request.method} /{path}")

    # Get Anthropic API key from headers or fall back to settings
    # Claude Code sends X-Api-Key header (normalized to x-api-key by FastAPI)
    # Priority: x-api-key header (from Claude Code) > server settings (fallback)
    # anthropic_api_key = request.headers.get("x-api-key") or model_settings.anthropic_api_key
    anthropic_api_key = model_settings.anthropic_api_key
    if not anthropic_api_key:
        logger.error("No Anthropic API key found in headers or settings")
        return Response(
            content='{"error": {"type": "authentication_error", "message": "Anthropic API key required"}}',
            status_code=401,
            media_type="application/json",
        )

    # Prepare headers for Anthropic API
    anthropic_headers = {
        "x-api-key": anthropic_api_key,
        "anthropic-version": request.headers.get("anthropic-version", "2023-06-01"),
        "content-type": request.headers.get("content-type", "application/json"),
    }

    # Forward the request to Anthropic API
    async with httpx.AsyncClient(timeout=300.0) as client:
        try:
            response = await client.request(
                method=request.method,
                url=f"{ANTHROPIC_API_BASE}/{path}",
                headers=anthropic_headers,
                content=body if body else None,
            )

            return Response(
                content=response.content,
                status_code=response.status_code,
                media_type=response.headers.get("content-type", "application/json"),
                headers={
                    k: v
                    for k, v in response.headers.items()
                    if k.lower() not in ["content-encoding", "content-length", "transfer-encoding", "connection"]
                },
            )

        except httpx.HTTPError as e:
            logger.error(f"Error proxying catch-all request to Anthropic API: {e}")
            return Response(
                content=f'{{"error": {{"type": "api_error", "message": "Failed to proxy request to Anthropic API: {str(e)}"}}}}',
                status_code=500,
                media_type="application/json",
            )
