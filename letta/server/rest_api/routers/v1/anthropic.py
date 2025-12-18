import asyncio
import json

import httpx
from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response, StreamingResponse

from letta.log import get_logger
from letta.server.rest_api.dependencies import HeaderParams, get_headers, get_letta_server
from letta.server.rest_api.proxy_helpers import (
    build_response_from_chunks,
    check_for_duplicate_message,
    extract_assistant_message,
    extract_user_messages,
    get_or_create_claude_code_agent,
    inject_memory_context,
    is_topic_detection_response,
    persist_messages_background,
    prepare_headers,
)
from letta.server.server import SyncServer

logger = get_logger(__name__)

router = APIRouter(prefix="/anthropic", tags=["anthropic"])

ANTHROPIC_API_BASE = "https://api.anthropic.com"
PROXY_NAME = "Anthropic Proxy"


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

    logger.info(f"[{PROXY_NAME}] Proxying request to Anthropic Messages API: {ANTHROPIC_API_BASE}/v1/messages")
    logger.debug(f"[{PROXY_NAME}] Request body preview: {body[:200]}...")

    actor = await server.user_manager.get_actor_or_default_async(headers.actor_id)

    # Extract all user messages from request
    all_user_messages = extract_user_messages(body)

    # Only capture the LAST user message (the new one the user just sent)
    # Claude Code sends full conversation history, but we only want to persist the new message
    user_messages = [all_user_messages[-1]] if all_user_messages else []

    # Filter out system/metadata requests and policy specs
    user_messages = [s for s in user_messages if not s.startswith("<system-reminder>") and not s.startswith("<policy_spec>")]
    if not user_messages:
        logger.debug(f"[{PROXY_NAME}] Skipping capture/memory for this turn")

    anthropic_headers = prepare_headers(request, PROXY_NAME)
    if not anthropic_headers:
        logger.error(f"[{PROXY_NAME}] No Anthropic API key found in headers or settings")
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
        # Extract and remove project_id (internal use only, not for Anthropic API)
        project_id = request_data.pop("project_id", None)
        logger.debug(f"[{PROXY_NAME}] Request is streaming: {is_streaming}")
        logger.debug(f"[{PROXY_NAME}] Model: {model_name}")
        logger.debug(f"[{PROXY_NAME}] Project ID: {project_id}")
    except Exception as e:
        logger.warning(f"[{PROXY_NAME}] Failed to parse request body: {e}")
        is_streaming = False
        model_name = None
        project_id = None

    # Get or create agent for Claude Code session (skip for system requests)
    # Note: Agent lookup and memory search are blocking operations before forwarding.
    # Message persistence happens in the background after the response is returned.
    agent = None
    try:
        # Check if X-LETTA-AGENT-ID header is provided
        custom_agent_id = request.headers.get("x-letta-agent-id")

        agent = await get_or_create_claude_code_agent(
            server=server,
            actor=actor,
            project_id=project_id,
            agent_id=custom_agent_id,
        )
        logger.debug(f"[{PROXY_NAME}] Using agent ID: {agent.id}")
    except Exception as e:
        logger.error(f"[{PROXY_NAME}] Failed to get/create agent: {e}")

    # Inject memory context into request (skip for system requests)
    # TODO: Optimize - skip memory injection on subsequent messages in same session
    # TODO: Add caching layer to avoid duplicate memory searches
    modified_body = body
    if agent and request_data:
        modified_request_data = await inject_memory_context(
            server=server,
            agent=agent,
            actor=actor,
            request_data=request_data,
            proxy_name=PROXY_NAME,
        )
        # Re-encode the modified request
        import json

        modified_body = json.dumps(modified_request_data).encode("utf-8")

    # Forward the request to Anthropic API (preserve query params like ?beta=true)
    # Note: For streaming, we create the client outside the generator to keep it alive
    anthropic_url = f"{ANTHROPIC_API_BASE}/v1/messages"
    if request.url.query:
        anthropic_url = f"{anthropic_url}?{request.url.query}"

    if is_streaming:
        # Handle streaming response
        collected_chunks = []

        async def stream_response():
            # Create client inside the generator so it stays alive during streaming
            async with httpx.AsyncClient(timeout=300.0) as client:
                async with client.stream(
                    "POST",
                    anthropic_url,
                    headers=anthropic_headers,
                    content=modified_body,
                ) as response:
                    async for chunk in response.aiter_bytes():
                        collected_chunks.append(chunk)
                        yield chunk

                # After streaming is complete, extract and log assistant message
                assistant_message = build_response_from_chunks(collected_chunks)
                if user_messages and assistant_message:
                    logger.info("=" * 70)
                    logger.info("📨 CAPTURED USER MESSAGE:")
                    for i, user_message in enumerate(user_messages):
                        logger.info(f"  {i}: {user_message[:200]}{'...' if len(user_message) > 200 else ''}")
                    logger.info("=" * 70)
                    logger.info("🤖 CAPTURED ASSISTANT RESPONSE (streaming):")
                    logger.info(f"  {assistant_message[:200]}{'...' if len(assistant_message) > 200 else ''}")
                    logger.info("=" * 70)

                    # Skip persisting topic detection responses (metadata, not conversation)
                    if is_topic_detection_response(assistant_message):
                        logger.debug(f"[{PROXY_NAME}] Skipping persistence - topic detection response")
                    # Persist messages to database (non-blocking, skip for system requests)
                    elif agent:
                        # Check for duplicate user messages before creating background task
                        # This prevents race conditions where multiple requests persist the same message
                        user_messages_to_persist = await check_for_duplicate_message(server, agent, actor, user_messages, PROXY_NAME)

                        asyncio.create_task(
                            persist_messages_background(
                                server=server,
                                agent=agent,
                                actor=actor,
                                user_messages=user_messages_to_persist,
                                assistant_message=assistant_message,
                                model_name=model_name,
                                proxy_name=PROXY_NAME,
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
                anthropic_url,
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

                        # Skip persisting topic detection responses (metadata, not conversation)
                        if is_topic_detection_response(assistant_message):
                            logger.debug(f"[{PROXY_NAME}] Skipping persistence - topic detection response")
                        # Persist messages to database (non-blocking)
                        elif agent:
                            # Check for duplicate user messages before creating background task
                            user_messages_to_persist = await check_for_duplicate_message(server, agent, actor, user_messages, PROXY_NAME)

                            asyncio.create_task(
                                persist_messages_background(
                                    server=server,
                                    agent=agent,
                                    actor=actor,
                                    user_messages=user_messages_to_persist,
                                    assistant_message=assistant_message,
                                    model_name=model_name,
                                    proxy_name=PROXY_NAME,
                                )
                            )
                except Exception as e:
                    logger.warning(f"[{PROXY_NAME}] Failed to extract assistant response for logging: {e}")

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
            logger.error(f"[{PROXY_NAME}] Error proxying request to Anthropic API: {e}")
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

    logger.info(f"[{PROXY_NAME}] Proxying catch-all request: {request.method} /{path}")

    anthropic_headers = prepare_headers(request, PROXY_NAME)
    if not anthropic_headers:
        logger.error(f"[{PROXY_NAME}] No Anthropic API key found in headers or settings")
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
            logger.error(f"[{PROXY_NAME}] Error proxying catch-all request to Anthropic API: {e}")
            return Response(
                content=f'{{"error": {{"type": "api_error", "message": "Failed to proxy request to Anthropic API: {str(e)}"}}}}',
                status_code=500,
                media_type="application/json",
            )
