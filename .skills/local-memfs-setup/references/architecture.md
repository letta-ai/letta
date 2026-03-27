# MemFS Architecture (Local Self-Hosted)

## Component Overview

```
Letta Code (client)
    │
    │  git clone/push/pull over HTTP
    │
    ▼
/v1/git/{agent_id}/state.git/*    ← FastAPI proxy routes
    │                                 (git_http.py)
    │
    ▼
MemfsClient (local)                ← memfs_client_base.py
    │
    ▼
LocalStorageBackend                ← storage/local.py
    │
    ▼
~/.letta/memfs/{org}/{agent}/repo.git   ← bare git repos on disk
```

## Key Source Files

| File | Purpose |
|------|---------|
| `letta/services/memory_repo/__init__.py` | Import routing: tries cloud client, falls back to local |
| `letta/services/memory_repo/memfs_client_base.py` | Local `MemfsClient` using `LocalStorageBackend` |
| `letta/services/memory_repo/storage/local.py` | Bare git repo management on local filesystem |
| `letta/services/memory_repo/git_operations.py` | Git plumbing (commit, diff, log) |
| `letta/services/block_manager_git.py` | `GitEnabledBlockManager` wrapping standard `BlockManager` |
| `letta/server/rest_api/routers/v1/git_http.py` | HTTP proxy for git smart protocol |
| `letta/server/server.py` | Server init: creates `MemfsClient` if `memfs_service_url` is set |
| `letta/settings.py` | `LETTA_MEMFS_SERVICE_URL` setting definition |

## Initialization Flow

1. Server starts, calls `_init_memory_repo_manager()`
2. If `LETTA_MEMFS_SERVICE_URL` is set (any non-empty value):
   - Creates `MemfsClient(base_url=...)` from `memory_repo/__init__.py`
   - On OSS, this resolves to `memfs_client_base.MemfsClient` (local storage)
   - `base_url` is accepted but ignored (interface compat with cloud client)
3. If `MemfsClient` exists, server uses `GitEnabledBlockManager` instead of
   plain `BlockManager`
4. `GitEnabledBlockManager` checks per-agent whether `git-memory-enabled` tag
   is present before routing through git

## Write Path

When a block is updated on a git-enabled agent:

1. `GitEnabledBlockManager.update_block_async()` is called
2. Checks `_is_git_enabled_for_agent()` (looks for tag in DB)
3. If enabled: serializes block to markdown, commits to local bare repo via
   `MemfsClient.commit_blocks_async()`
4. Then updates PostgreSQL (cache) via parent `BlockManager`
5. Letta Code picks up changes on next pull

## Read Path

Reads always come from PostgreSQL (fast cache). Git is the source of truth but
PostgreSQL is kept in sync on every write.

## Post-Push Sync

When Letta Code pushes changes (e.g., memory file edits from the client):

1. Push hits `/v1/git/{agent_id}/state.git/git-receive-pack`
2. `git_http.py` proxies to memfs service (or handles locally)
3. After successful push, `_sync_after_push()` syncs changed blocks back to
   PostgreSQL

## Cloud vs Local

The `memory_repo/__init__.py` handles the distinction:

```python
try:
    from letta.services.memory_repo.memfs_client import MemfsClient  # cloud
except ImportError:
    from letta.services.memory_repo.memfs_client_base import MemfsClient  # local
```

On OSS installs, `memfs_client.py` (cloud) doesn't exist, so the local client
is used automatically. No configuration needed beyond the feature flag env var.

## Storage Layout

```
~/.letta/memfs/
└── {org_id}/
    └── {agent_id}/
        └── repo.git/          ← bare git repository
            ├── HEAD
            ├── objects/
            ├── refs/
            └── ...
```

Each agent gets its own bare repo. Memory blocks are stored as markdown files
at the repo root (e.g., `system/human.md`, `system/persona.md`).
