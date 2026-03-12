"""Local filesystem-based client for git memory operations.

This is the open-source implementation that stores git repositories
on the local filesystem (~/.letta/memfs/ by default). This enables
git-backed memory for self-hosted deployments without external dependencies.

The cloud/enterprise version (memfs_client.py) connects to the memfs
HTTP service instead.
"""

import hashlib
import os
import uuid
from typing import List, Optional

from letta.constants import CORE_MEMORY_BLOCK_CHAR_LIMIT
from letta.log import get_logger
from letta.otel.tracing import trace_method
from letta.schemas.block import Block as PydanticBlock
from letta.schemas.memory_repo import MemoryCommit
from letta.schemas.user import User as PydanticUser
from letta.services.memory_repo.block_markdown import parse_block_markdown, serialize_block
from letta.services.memory_repo.git_operations import GitOperations
from letta.services.memory_repo.path_mapping import memory_block_label_from_markdown_path
from letta.services.memory_repo.storage.local import LocalStorageBackend
from letta.utils import enforce_types

logger = get_logger(__name__)

# File paths within the memory repository (blocks stored at repo root as {label}.md)

# Default local storage path
DEFAULT_LOCAL_PATH = os.path.expanduser("~/.letta/memfs")


class MemfsClient:
    """Local filesystem-based client for git memory operations.

    Provides the same interface as the cloud MemfsClient but stores
    repositories on the local filesystem using LocalStorageBackend.
    This enables git-backed memory for self-hosted OSS deployments.
    """

    def __init__(self, base_url: str | None = None, local_path: str | None = None, timeout: float = 120.0):
        """Initialize the local memfs client.

        Args:
            base_url: Ignored (for interface compatibility with cloud client)
            local_path: Path for local storage (default: ~/.letta/memfs)
            timeout: Ignored (for interface compatibility)
        """
        self.local_path = local_path or DEFAULT_LOCAL_PATH
        self.storage = LocalStorageBackend(base_path=self.local_path)
        self.git = GitOperations(storage=self.storage, redis_client=None)

        logger.info(f"MemfsClient initialized with local storage at {self.local_path}")

    async def close(self):
        """Close the client (no-op for local storage)."""
        pass

    # =========================================================================
    # Repository Operations
    # =========================================================================

    @enforce_types
    @trace_method
    async def create_repo_async(
        self,
        agent_id: str,
        actor: PydanticUser,
        initial_blocks: List[PydanticBlock] | None = None,
    ) -> str:
        """Create a new repository for an agent with optional initial blocks.

        Args:
            agent_id: Agent ID
            actor: User performing the operation
            initial_blocks: Optional list of blocks to commit as initial state

        Returns:
            The HEAD SHA of the created repository
        """
        initial_blocks = initial_blocks or []
        org_id = actor.organization_id

        # Build initial files from blocks (frontmatter embeds metadata)
        initial_files = {}

        for block in initial_blocks:
            file_path = f"{block.label}.md"
            initial_files[file_path] = serialize_block(
                value=block.value or "",
                description=block.description,
                limit=block.limit,
                read_only=block.read_only,
                metadata=block.metadata,
            )

        return await self.git.create_repo(
            agent_id=agent_id,
            org_id=org_id,
            initial_files=initial_files,
            author_name=f"User {actor.id}",
            author_email=f"{actor.id}@letta.ai",
        )

    # =========================================================================
    # Block Operations (Read)
    # =========================================================================

    @enforce_types
    @trace_method
    async def get_blocks_async(
        self,
        agent_id: str,
        actor: PydanticUser,
        ref: str = "HEAD",
    ) -> List[PydanticBlock]:
        """Get all memory blocks at a specific ref.

        Args:
            agent_id: Agent ID
            actor: User performing the operation
            ref: Git ref (commit SHA, branch name, or 'HEAD')

        Returns:
            List of memory blocks
        """
        org_id = actor.organization_id

        try:
            files = await self.git.get_files(agent_id, org_id, ref)
        except FileNotFoundError:
            return []

        # Convert block files to PydanticBlock (metadata is in frontmatter).
        # skills/{skill_name}/SKILL.md is mapped to block label skills/{skill_name};
        # other files under skills/ are intentionally ignored.
        blocks = []
        for file_path, content in files.items():
            label = memory_block_label_from_markdown_path(file_path)
            if label is None:
                continue

            parsed = parse_block_markdown(content)

            synthetic_uuid = uuid.UUID(hashlib.md5(f"{agent_id}:{label}".encode()).hexdigest())
            blocks.append(
                PydanticBlock(
                    id=f"block-{synthetic_uuid}",
                    label=label,
                    value=parsed["value"],
                    description=parsed.get("description"),
                    limit=parsed.get("limit", CORE_MEMORY_BLOCK_CHAR_LIMIT),
                    read_only=parsed.get("read_only", False),
                    metadata=parsed.get("metadata", {}),
                )
            )

        return blocks

    @enforce_types
    @trace_method
    async def get_block_async(
        self,
        agent_id: str,
        label: str,
        actor: PydanticUser,
        ref: str = "HEAD",
    ) -> Optional[PydanticBlock]:
        """Get a specific memory block.

        Args:
            agent_id: Agent ID
            label: Block label
            actor: User performing the operation
            ref: Git ref

        Returns:
            Memory block or None
        """
        blocks = await self.get_blocks_async(agent_id, actor, ref)
        for block in blocks:
            if block.label == label:
                return block
        return None

    # =========================================================================
    # Block Operations (Write)
    # =========================================================================

    async def _ensure_repo_exists(self, agent_id: str, actor: PydanticUser) -> str:
        """Ensure the repository exists, creating if needed."""
        try:
            return await self.git.get_head_sha(agent_id, actor.organization_id)
        except FileNotFoundError:
            return await self.git.create_repo(
                agent_id=agent_id,
                org_id=actor.organization_id,
                initial_files={},
                author_name=f"User {actor.id}",
                author_email=f"{actor.id}@letta.ai",
            )

    @enforce_types
    @trace_method
    async def update_block_async(
        self,
        agent_id: str,
        label: str,
        value: str,
        actor: PydanticUser,
        message: Optional[str] = None,
        *,
        description: Optional[str] = None,
        limit: Optional[int] = None,
        read_only: bool = False,
        metadata: Optional[dict] = None,
    ) -> MemoryCommit:
        """Update a memory block.

        Args:
            agent_id: Agent ID
            label: Block label
            value: New block value
            actor: User performing the operation
            message: Optional commit message
            description: Block description (for frontmatter)
            limit: Block character limit (for frontmatter)
            read_only: Block read-only flag (for frontmatter)
            metadata: Block metadata dict (for frontmatter)

        Returns:
            Commit details
        """
        from letta.schemas.memory_repo import FileChange

        await self._ensure_repo_exists(agent_id, actor)

        file_path = f"{label}.md"
        file_content = serialize_block(
            value=value,
            description=description,
            limit=limit,
            read_only=read_only,
            metadata=metadata,
        )
        commit_message = message or f"Update {label}"

        return await self.git.commit(
            agent_id=agent_id,
            org_id=actor.organization_id,
            changes=[FileChange(path=file_path, content=file_content, change_type="modify")],
            message=commit_message,
            author_name=f"User {actor.id}",
            author_email=f"{actor.id}@letta.ai",
        )

    @enforce_types
    @trace_method
    async def create_block_async(
        self,
        agent_id: str,
        block: PydanticBlock,
        actor: PydanticUser,
        message: Optional[str] = None,
    ) -> MemoryCommit:
        """Create a new memory block.

        Args:
            agent_id: Agent ID
            block: Block to create
            actor: User performing the operation
            message: Optional commit message

        Returns:
            Commit details
        """
        from letta.schemas.memory_repo import FileChange

        await self._ensure_repo_exists(agent_id, actor)
        org_id = actor.organization_id

        file_content = serialize_block(
            value=block.value or "",
            description=block.description,
            limit=block.limit,
            read_only=block.read_only,
            metadata=block.metadata,
        )

        changes = [
            FileChange(
                path=f"{block.label}.md",
                content=file_content,
                change_type="add",
            ),
        ]

        commit_message = message or f"Create block {block.label}"

        return await self.git.commit(
            agent_id=agent_id,
            org_id=org_id,
            changes=changes,
            message=commit_message,
            author_name=f"User {actor.id}",
            author_email=f"{actor.id}@letta.ai",
        )

    @enforce_types
    @trace_method
    async def delete_block_async(
        self,
        agent_id: str,
        label: str,
        actor: PydanticUser,
        message: Optional[str] = None,
    ) -> MemoryCommit:
        """Delete a memory block.

        Args:
            agent_id: Agent ID
            label: Block label to delete
            actor: User performing the operation
            message: Optional commit message

        Returns:
            Commit details
        """
        from letta.schemas.memory_repo import FileChange

        await self._ensure_repo_exists(agent_id, actor)
        org_id = actor.organization_id

        changes = [
            FileChange(
                path=f"{label}.md",
                content=None,
                change_type="delete",
            ),
        ]

        commit_message = message or f"Delete block {label}"

        return await self.git.commit(
            agent_id=agent_id,
            org_id=org_id,
            changes=changes,
            message=commit_message,
            author_name=f"User {actor.id}",
            author_email=f"{actor.id}@letta.ai",
        )

    # =========================================================================
    # History Operations
    # =========================================================================

    @enforce_types
    @trace_method
    async def get_history_async(
        self,
        agent_id: str,
        actor: PydanticUser,
        path: Optional[str] = None,
        limit: int = 50,
    ) -> List[MemoryCommit]:
        """Get commit history.

        Args:
            agent_id: Agent ID
            actor: User performing the operation
            path: Optional file path to filter by
            limit: Maximum commits to return

        Returns:
            List of commits, newest first
        """
        try:
            return await self.git.get_history(
                agent_id=agent_id,
                org_id=actor.organization_id,
                path=path,
                limit=limit,
            )
        except FileNotFoundError:
            return []
