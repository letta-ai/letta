"""Git HTTP Smart Protocol endpoints (proxied to memfs service).

This module proxies `/v1/git/*` requests to the external memfs service, which
handles git smart HTTP protocol (clone, push, pull).

Example:

    git clone http://localhost:8283/v1/git/{agent_id}/state.git

Routes (smart HTTP):
    GET  /v1/git/{agent_id}/state.git/info/refs?service=git-upload-pack
    POST /v1/git/{agent_id}/state.git/git-upload-pack
    GET  /v1/git/{agent_id}/state.git/info/refs?service=git-receive-pack
    POST /v1/git/{agent_id}/state.git/git-receive-pack

Post-push sync to PostgreSQL is triggered from the proxy route after a
successful `git-receive-pack`.
"""

from __future__ import annotations

import asyncio
from typing import Dict, Iterable, Optional

import httpx
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, StreamingResponse
from starlette.background import BackgroundTask

from letta.log import get_logger
from letta.server.rest_api.dependencies import HeaderParams, get_headers, get_letta_server
from letta.services.memory_repo.path_mapping import memory_block_label_from_markdown_path

logger = get_logger(__name__)

_background_tasks: set[asyncio.Task] = set()


def _is_syncable_block_markdown_path(path: str) -> bool:
    """Return whether a markdown path should be mirrored into block cache.

    Special-case skills so only skill definitions are mirrored:
    - sync `skills/{skill_name}/SKILL.md` as label `skills/{skill_name}`
    - ignore all other markdown under `skills/`
    """
    return memory_block_label_from_markdown_path(path) is not None


router = APIRouter(prefix="/git", tags=["git"], include_in_schema=False)

# Global storage for the server instance (set during app startup)
_server_instance = None


def set_server_instance(server) -> None:
    """Set the Letta server instance for git operations. Called during app startup."""

    global _server_instance
    _server_instance = server


async def _sync_after_push(actor_id: str, agent_id: str) -> None:
    """Sync blocks to PostgreSQL after a successful push.

    GCS sync is handled by the memfs service. This function syncs the
    block contents to PostgreSQL for caching/querying.
    """
    if _server_instance is None:
        logger.warning("Server instance not set; cannot sync after push")
        return

    try:
        actor = await _server_instance.user_manager.get_actor_by_id_async(actor_id)
    except Exception:
        logger.exception("Failed to resolve actor for post-push sync (actor_id=%s)", actor_id)
        return

    org_id = actor.organization_id

    # Sync blocks to Postgres (if using GitEnabledBlockManager).
    #
    # Keep the same pattern as API-driven edits: read from the source of truth
    # in object storage after persisting the pushed refs/objects, rather than
    # relying on a working tree checkout under repo_path/.
    from letta.services.block_manager_git import GitEnabledBlockManager

    if not isinstance(_server_instance.block_manager, GitEnabledBlockManager):
        return

    # Retry with backoff to handle race condition where GCS upload is still in progress
    # after git-receive-pack returns. The webhook fires immediately but commit objects
    # may not be fully uploaded yet.
    files = {}
    max_retries = 3
    for attempt in range(max_retries):
        try:
            files = await _server_instance.memory_repo_manager.git.get_files(
                agent_id=agent_id,
                org_id=org_id,
                ref="HEAD",
            )
            logger.info("get_files returned %d files (attempt %d)", len(files), attempt + 1)
            break
        except Exception as e:
            if attempt < max_retries - 1:
                wait_time = 2**attempt  # 1s, 2s, 4s
                logger.warning("Failed to read repo files (attempt %d/%d), retrying in %ds: %s", attempt + 1, max_retries, wait_time, e)
                await asyncio.sleep(wait_time)
            else:
                logger.exception("Failed to read repo files after %d retries (agent=%s)", max_retries, agent_id)

    expected_labels = set()
    from letta.services.memory_repo.block_markdown import parse_block_markdown

    md_file_paths = sorted([file_path for file_path in files if _is_syncable_block_markdown_path(file_path)])
    nested_md_file_paths = [file_path for file_path in md_file_paths if "/" in file_path[:-3]]
    logger.info(
        "Post-push sync file scan: agent=%s total_files=%d md_files=%d nested_md_files=%d sample_md_paths=%s",
        agent_id,
        len(files),
        len(md_file_paths),
        len(nested_md_file_paths),
        md_file_paths[:10],
    )

    synced = 0
    for file_path, content in files.items():
        if not _is_syncable_block_markdown_path(file_path):
            continue

        label = memory_block_label_from_markdown_path(file_path)
        if label is None:
            continue
        expected_labels.add(label)

        # Parse frontmatter to extract metadata alongside value
        parsed = parse_block_markdown(content)

        try:
            await _server_instance.block_manager._sync_block_to_postgres(
                agent_id=agent_id,
                label=label,
                value=parsed["value"],
                actor=actor,
                description=parsed.get("description"),
                limit=parsed.get("limit"),
                read_only=parsed.get("read_only"),
                metadata=parsed.get("metadata"),
            )
            synced += 1
            logger.info("Synced block %s to PostgreSQL", label)
        except Exception:
            logger.exception(
                "Failed to sync block %s to PostgreSQL (agent=%s) [path=%s nested=%s]",
                label,
                agent_id,
                file_path,
                "/" in label,
            )

    if synced == 0:
        logger.warning("No *.md files found in repo HEAD during post-push sync (agent=%s)", agent_id)
    else:
        # Detach blocks that were removed in git.
        #
        # We treat git as the source of truth for which blocks are attached to
        # this agent. If a *.md file disappears from HEAD, detach the
        # corresponding block from the agent in Postgres.
        try:
            existing_blocks = await _server_instance.agent_manager.list_agent_blocks_async(
                agent_id=agent_id,
                actor=actor,
                before=None,
                after=None,
                limit=1000,
                ascending=True,
            )
            existing_by_label = {b.label: b for b in existing_blocks}
            removed_labels = set(existing_by_label.keys()) - expected_labels

            for label in sorted(removed_labels):
                block = existing_by_label.get(label)
                if not block:
                    continue
                await _server_instance.agent_manager.detach_block_async(
                    agent_id=agent_id,
                    block_id=block.id,
                    actor=actor,
                )
                logger.info("Detached block %s from agent (removed from git)", label)
        except Exception:
            logger.exception("Failed detaching removed blocks during post-push sync (agent=%s)", agent_id)


def _parse_agent_id_from_repo_path(path: str) -> Optional[str]:
    """Extract agent_id from a git HTTP path.

    Expected path form:
      - {agent_id}/state.git/...
    """

    parts = path.strip("/").split("/")
    if len(parts) < 2:
        return None

    if parts[1] != "state.git":
        return None

    return parts[0]


def _filter_out_hop_by_hop_headers(headers: Iterable[tuple[str, str]]) -> Dict[str, str]:
    # RFC 7230 hop-by-hop headers that should not be forwarded
    hop_by_hop = {
        "connection",
        "keep-alive",
        "proxy-authenticate",
        "proxy-authorization",
        "te",
        "trailers",
        "transfer-encoding",
        "upgrade",
    }

    out: Dict[str, str] = {}
    for k, v in headers:
        lk = k.lower()
        if lk in hop_by_hop:
            continue
        out[k] = v
    return out


def _get_memfs_service_url() -> Optional[str]:
    """Get the memfs service URL from settings, if configured."""
    from letta.settings import settings

    return settings.memfs_service_url


@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"])  # pragma: no cover
async def proxy_git_http(
    path: str,
    request: Request,
    server=Depends(get_letta_server),
    headers: HeaderParams = Depends(get_headers),
):
    """Proxy `/v1/git/*` requests to the memfs service.

    Requires LETTA_MEMFS_SERVICE_URL to be configured.
    """

    memfs_url = _get_memfs_service_url()

    if not memfs_url:
        return JSONResponse(
            status_code=501,
            content={
                "detail": "git HTTP requires memfs service (LETTA_MEMFS_SERVICE_URL not configured)",
            },
        )

    # Proxy to external memfs service
    url = f"{memfs_url.rstrip('/')}/git/{path}"
    logger.info("proxy_git_http: using memfs service at %s", memfs_url)

    req_headers = _filter_out_hop_by_hop_headers(request.headers.items())
    # Avoid sending FastAPI host/length; httpx will compute
    req_headers.pop("host", None)
    req_headers.pop("content-length", None)

    # Resolve org_id from the authenticated actor + agent and forward to memfs.
    agent_id = _parse_agent_id_from_repo_path(path)
    if agent_id is not None:
        actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
        # Authorization check: ensure the actor can access this agent.
        await server.agent_manager.get_agent_by_id_async(agent_id=agent_id, actor=actor, include_relationships=[])

        # Ensure we set exactly one X-Organization-Id header (avoid duplicate casing).
        for k in list(req_headers.keys()):
            if k.lower() == "x-organization-id":
                req_headers.pop(k, None)
        # Use the authenticated actor's org; AgentState may not carry an organization field.
        req_headers["X-Organization-Id"] = actor.organization_id

    logger.info(
        "proxy_git_http: method=%s path=%s parsed_agent_id=%s actor_id=%s has_user_id_hdr=%s x_org_hdr=%s",
        request.method,
        path,
        agent_id,
        headers.actor_id,
        bool(request.headers.get("user_id")),
        req_headers.get("X-Organization-Id") or req_headers.get("x-organization-id"),
    )

    async def _body_iter():
        async for chunk in request.stream():
            yield chunk

    client = httpx.AsyncClient(timeout=None)
    req = client.build_request(
        method=request.method,
        url=url,
        params=request.query_params,
        headers=req_headers,
        content=_body_iter() if request.method not in {"GET", "HEAD"} else None,
    )
    upstream = await client.send(req, stream=True)

    resp_headers = _filter_out_hop_by_hop_headers(upstream.headers.items())

    # If this was a push, trigger our sync.
    if request.method == "POST" and path.endswith("git-receive-pack") and upstream.status_code < 400:
        agent_id = _parse_agent_id_from_repo_path(path)
        if agent_id is not None:
            try:
                actor = await server.user_manager.get_actor_or_default_async(actor_id=headers.actor_id)
                # Authorization check: ensure the actor can access this agent.
                await server.agent_manager.get_agent_by_id_async(agent_id=agent_id, actor=actor, include_relationships=[])
                task = asyncio.create_task(_sync_after_push(actor.id, agent_id))
                _background_tasks.add(task)
                task.add_done_callback(_background_tasks.discard)
            except Exception:
                logger.exception("Failed to trigger post-push sync (agent_id=%s)", agent_id)

    async def _aclose_upstream_and_client() -> None:
        try:
            await upstream.aclose()
        finally:
            await client.aclose()

    return StreamingResponse(
        upstream.aiter_raw(),
        status_code=upstream.status_code,
        headers=resp_headers,
        media_type=upstream.headers.get("content-type"),
        background=BackgroundTask(_aclose_upstream_and_client),
    )
