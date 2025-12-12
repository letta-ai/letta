import asyncio
import json

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

ANTHROPIC_API_BASE = "https://api.anthropic.com"


def extract_user_messages(body: bytes) -> list[str]:
    try:
        request_data = json.loads(body)
        messages = request_data.get("messages", [])

        user_messages = []
        for msg in messages:
            if msg.get("role") == "user":
                content = msg.get("content", "")
                if isinstance(content, str):
                    user_messages.append(content)
                elif isinstance(content, list):
                    for block in content:
                        if isinstance(block, dict):
                            if block.get("type") == "text":
                                user_messages.append(block.get("text", ""))
                            elif block.get("type") == "image":
                                user_messages.append("[IMAGE]")

        return user_messages
    except Exception as e:
        logger.warning(f"[Anthropic Proxy] Failed to extract user messages: {e}")
        return []


def extract_assistant_message(response_data: dict) -> str:
    try:
        content_blocks = response_data.get("content", [])
        text_parts = []

        for block in content_blocks:
            if isinstance(block, dict) and block.get("type") == "text":
                text_parts.append(block.get("text", ""))

        return "\n".join(text_parts)
    except Exception as e:
        logger.warning(f"[Anthropic Proxy] Failed to extract assistant message: {e}")
        return ""


def prepare_anthropic_headers(request: Request) -> dict | None:
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

    anthropic_headers = {}
    for key, value in request.headers.items():
        if key.lower() not in skip_headers:
            anthropic_headers[key] = value

    # Fallback to letta's anthropic api key if not provided
    if "x-api-key" not in anthropic_headers and "anthropic-api-key" not in anthropic_headers:
        anthropic_api_key = model_settings.anthropic_api_key
        if anthropic_api_key:
            anthropic_headers["x-api-key"] = anthropic_api_key

    if "content-type" not in anthropic_headers:
        anthropic_headers["content-type"] = "application/json"

    return anthropic_headers


def format_memory_blocks(blocks, agent_id: str) -> str:
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


def _build_response_from_chunks(chunks: list[bytes]) -> str:
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
        logger.warning(f"[Anthropic Proxy] Failed to build response from chunks: {e}")
        return ""


async def _inject_memory_context(
    server,
    agent,
    actor,
    request_data: dict,
) -> dict:
    try:
        messages = request_data.get("messages", [])
        if not messages:
            return request_data

        memory_context = format_memory_blocks(agent.blocks, agent.id)

        if not memory_context:
            logger.debug("[Anthropic Proxy] No memory blocks found, skipping memory injection")
            return request_data

        block_count = len([b for b in agent.blocks if b.value])
        logger.info(f"[Anthropic Proxy] Injecting {block_count} memory block(s) into request")

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
                    f"[Anthropic Proxy] Adjusted max_tokens from {current_max_tokens} to {modified_data['max_tokens']} (thinking.budget_tokens={budget_tokens})"
                )

        return modified_data

    except Exception as e:
        logger.exception(f"[Anthropic Proxy] Failed to inject memory context: {e}")
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
        logger.info(f"[Anthropic Proxy] Persisted messages: {result['messages_created']} messages saved")
    except Exception as e:
        logger.error(f"[Anthropic Proxy] Failed to persist messages in background: {e}")


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
            "ANTHROPIC_BASE_URL": "http://localhost:3000/v1/anthropic"
        }
    }
    """
    # Get the request body
    body = await request.body()

    logger.info(f"[Anthropic Proxy] Proxying request to Anthropic Messages API: {ANTHROPIC_API_BASE}/v1/messages")
    logger.debug(f"[Anthropic Proxy] Request body preview: {body[:200]}...")

    actor = await server.user_manager.get_actor_or_default_async(headers.actor_id)

    # Extract all user messages from request
    all_user_messages = extract_user_messages(body)

    # Only capture the LAST user message (the new one the user just sent)
    # Claude Code sends full conversation history, but we only want to persist the new message
    user_messages = [all_user_messages[-1]] if all_user_messages else []

    # Check if this is a system/metadata request
    is_system_request = len(user_messages) == 0 or user_messages[0].startswith("<system-reminder>")
    if is_system_request:
        logger.debug("[Anthropic Proxy] Skipping capture/memory for system request")

    if user_messages and not is_system_request:
        logger.info("=" * 70)
        logger.info("📨 CAPTURED USER MESSAGE (latest only):")
        logger.info(f"  {user_messages[0][:200]}{'...' if len(user_messages[0]) > 200 else ''}")
        logger.info("=" * 70)

    anthropic_headers = prepare_anthropic_headers(request)
    if not anthropic_headers:
        logger.error("[Anthropic Proxy] No Anthropic API key found in headers or settings")
        return Response(
            content='{"error": {"type": "authentication_error", "message": "Anthropic API key required. Pass via anthropic-api-key or x-api-key header."}}',
            status_code=401,
            media_type="application/json",
        )

    # Check if this is a streaming request
    try:
        import json

        request_data = json.loads(body)
        is_streaming = request_data.get("stream", False)
        model_name = request_data.get("model")
        project_id = request_data.get("project_id")
        logger.debug(f"[Anthropic Proxy] Request is streaming: {is_streaming}")
        logger.debug(f"[Anthropic Proxy] Model: {model_name}")
        logger.debug(f"[Anthropic Proxy] Project ID: {project_id}")
    except Exception as e:
        logger.warning(f"[Anthropic Proxy] Failed to parse request body: {e}")
        is_streaming = False
        model_name = None
        project_id = None

    # Get or create agent for Claude Code session (skip for system requests)
    # Note: Agent lookup and memory search are blocking operations before forwarding.
    # Message persistence happens in the background after the response is returned.
    agent = None
    if not is_system_request:
        try:
            agent = await get_or_create_claude_code_agent(
                server=server,
                actor=actor,
                project_id=project_id,
            )
            logger.debug(f"[Anthropic Proxy] Using agent ID: {agent.id}")
        except Exception as e:
            logger.error(f"[Anthropic Proxy] Failed to get/create agent: {e}")

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
                    logger.warning(f"[Anthropic Proxy] Failed to extract assistant response for logging: {e}")

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
            logger.error(f"[Anthropic Proxy] Error proxying request to Anthropic API: {e}")
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

    logger.info(f"[Anthropic Proxy] Proxying catch-all request: {request.method} /{path}")

    anthropic_headers = prepare_anthropic_headers(request)
    if not anthropic_headers:
        logger.error("[Anthropic Proxy] No Anthropic API key found in headers or settings")
        return Response(
            content='{"error": {"type": "authentication_error", "message": "Anthropic API key required"}}',
            status_code=401,
            media_type="application/json",
        )

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
            logger.error(f"[Anthropic Proxy] Error proxying catch-all request to Anthropic API: {e}")
            return Response(
                content=f'{{"error": {{"type": "api_error", "message": "Failed to proxy request to Anthropic API: {str(e)}"}}}}',
                status_code=500,
                media_type="application/json",
            )
