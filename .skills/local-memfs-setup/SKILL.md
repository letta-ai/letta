---
name: local-memfs-setup
description: >-
  Set up git-backed memory (MemFS) on a self-hosted Letta server. Enables
  persistent, version-controlled agent memory on local disk without Letta Cloud.
  Use when deploying Letta OSS with Letta Code and you want agents to have
  git-backed memory files.
license: Apache-2.0
---

# Local MemFS Setup for Self-Hosted Letta

Enable git-backed agent memory on your own Letta server. No cloud account, no
sidecar services, no source patches. The OSS codebase has full local MemFS
support built in.

## Prerequisites

- **Letta server** (v0.16.6+ recommended): `uv pip install letta` or from source
- **PostgreSQL backend**: Required for the block cache layer
- **Redis**: Not required for local MemFS (the local client skips locking)
- **Letta Code**: Desktop app v0.16.0+ (has the `LETTA_MEMFS_LOCAL` env var)

## Setup

### 1. Configure the Letta Server

Set `LETTA_MEMFS_SERVICE_URL` to any non-empty value. This acts as a feature
flag that initializes the local `MemfsClient`. The URL itself is ignored by the
local storage backend.

```bash
export LETTA_MEMFS_SERVICE_URL=local
```

Or in `~/.letta/conf.yaml`:

```yaml
letta:
  memfs_service_url: "local"
```

Then start the server:

```bash
letta server
```

### 2. Configure Letta Code

Set `LETTA_MEMFS_LOCAL=1` to bypass the cloud connectivity check in Letta Code:

```bash
export LETTA_MEMFS_LOCAL=1
```

Add this to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.) so it persists.

On macOS, if launching Letta Code as a desktop app rather than from the terminal,
you may need to set it via `launchctl`:

```bash
launchctl setenv LETTA_MEMFS_LOCAL 1
```

### 3. Enable MemFS Per Agent

MemFS is opt-in per agent via the `git-memory-enabled` tag.

**From Letta Code CLI:**

```bash
letta --memfs
```

The `--memfs` flag is only needed once per agent. After the first enable, Letta
Code detects the tag and activates MemFS automatically on subsequent launches.

**From the API (Python SDK):**

```python
from letta_client import Letta

client = Letta(base_url="http://localhost:8283")

# Enable on a new agent
agent = client.agents.create(
    name="my-agent",
    tags=["git-memory-enabled"],
)

# Enable on an existing agent
client.agents.modify(
    agent_id="agent-xxx",
    tags=["git-memory-enabled"],
)
```

**From the ADE:**

Add the `git-memory-enabled` tag in the agent's settings panel.

## Verification

Once enabled, you should see bare git repos appear under:

```
~/.letta/memfs/
```

To verify git operations are working, check for the repository structure:

```bash
ls ~/.letta/memfs/
# Should show org/agent directories with repo.git subdirectories
```

From Letta Code, the agent's memory files will be visible as a git-backed
filesystem. Changes to memory blocks are committed as git operations with full
version history.

## How It Works

The OSS Letta server includes a complete local MemFS implementation:

1. `MemfsClient` (local) uses `LocalStorageBackend` to store bare git repos on
   disk at `~/.letta/memfs/`
2. `GitEnabledBlockManager` wraps the standard `BlockManager`, routing writes
   through git first then syncing to PostgreSQL as a cache
3. Letta Code clones/pushes via the `/v1/git/` HTTP endpoints on the server
4. Agents opt in via the `git-memory-enabled` tag

For deeper architecture details, see `references/architecture.md`.

## Troubleshooting

### MemFS not initializing

The server logs should show:

```
MemfsClient initialized with local storage at ~/.letta/memfs
```

If you see "Memory repo manager not configured" instead, `LETTA_MEMFS_SERVICE_URL`
is not set. Check that the env var is visible to the server process.

### Letta Code shows cloud connectivity error

Ensure `LETTA_MEMFS_LOCAL=1` is set in the environment where Letta Code runs.
If launching from a desktop shortcut, terminal env vars may not propagate.

### Agent memory not persisting to git

Verify the agent has the `git-memory-enabled` tag:

```bash
curl http://localhost:8283/v1/agents/{agent_id} | jq '.tags'
```

If the tag is missing, add it via the API or ADE.

### PostgreSQL required

Local MemFS still requires PostgreSQL for the block cache. SQLite is not
supported for git-backed memory. Ensure your Letta server is configured with
a PostgreSQL backend (`LETTA_PG_URI`).

## Credits

Based on the community discovery and documentation by
[Corykidios](https://github.com/Corykidios), who built the first working
self-hosted MemFS setup ([local_letta_memfs_magic](https://github.com/Corykidios/local_letta_memfs_magic))
and demonstrated that the OSS plumbing was ready for local use.
