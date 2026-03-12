"""Git-enabled block manager that uses object storage as source of truth.

When an agent has the GIT_MEMORY_ENABLED_TAG tag, block operations:
1. Write to git (GCS) first - source of truth
2. Update PostgreSQL as cache

This provides full version history while maintaining fast reads from PostgreSQL.
"""

import time
from typing import List, Optional

from letta.constants import CORE_MEMORY_BLOCK_CHAR_LIMIT
from letta.log import get_logger
from letta.orm.block import Block as BlockModel
from letta.otel.tracing import trace_method
from letta.schemas.block import Block as PydanticBlock, BlockUpdate, CreateBlock
from letta.schemas.user import User as PydanticUser
from letta.server.db import db_registry
from letta.services.block_manager import BlockManager
from letta.services.memory_repo import MemfsClient
from letta.utils import enforce_types

logger = get_logger(__name__)

# Tag that enables git-based memory for an agent
GIT_MEMORY_ENABLED_TAG = "git-memory-enabled"


class GitEnabledBlockManager(BlockManager):
    """Block manager that uses git as source of truth when enabled for an agent.

    For agents with the GIT_MEMORY_ENABLED_TAG:
    - All writes go to git first, then sync to PostgreSQL
    - Reads come from PostgreSQL (cache) for performance
    - Full version history is maintained in git

    For agents without the tag:
    - Behaves exactly like the standard BlockManager
    """

    def __init__(self, memory_repo_manager: Optional[MemfsClient] = None):
        """Initialize the git-enabled block manager.

        Args:
            memory_repo_manager: The memory repo manager for git operations.
                                If None, git features are disabled.
        """
        super().__init__()
        self.memory_repo_manager = memory_repo_manager

    async def _is_git_enabled_for_agent(self, agent_id: str, actor: PydanticUser) -> bool:
        """Check if an agent has git-based memory enabled."""
        if self.memory_repo_manager is None:
            return False

        # Check if agent has the git-memory-enabled tag
        async with db_registry.async_session() as session:
            from sqlalchemy import select

            from letta.orm.agents_tags import AgentsTags

            result = await session.execute(
                select(AgentsTags).where(
                    AgentsTags.agent_id == agent_id,
                    AgentsTags.tag == GIT_MEMORY_ENABLED_TAG,
                )
            )
            return result.scalar_one_or_none() is not None

    async def _get_agent_id_for_block(self, block_id: str, actor: PydanticUser) -> Optional[str]:
        """Get the agent ID that owns a block."""
        async with db_registry.async_session() as session:
            from sqlalchemy import select

            from letta.orm.blocks_agents import BlocksAgents

            result = await session.execute(select(BlocksAgents.agent_id).where(BlocksAgents.block_id == block_id))
            row = result.first()
            return row[0] if row else None

    async def _sync_block_to_postgres(
        self,
        agent_id: str,
        label: str,
        value: str,
        actor: PydanticUser,
        description: Optional[str] = None,
        limit: Optional[int] = None,
        read_only: Optional[bool] = None,
        metadata: Optional[dict] = None,
    ) -> PydanticBlock:
        """Sync a block from git to PostgreSQL cache."""
        async with db_registry.async_session() as session:
            from sqlalchemy import select

            from letta.orm.blocks_agents import BlocksAgents

            # Find existing block for this agent+label
            result = await session.execute(
                select(BlockModel)
                .join(BlocksAgents, BlocksAgents.block_id == BlockModel.id)
                .where(
                    BlocksAgents.agent_id == agent_id,
                    BlockModel.label == label,
                    BlockModel.organization_id == actor.organization_id,
                )
            )
            block = result.scalar_one_or_none()

            if block:
                # Update existing block
                block.value = value
                if description is not None:
                    block.description = description
                if limit is not None:
                    block.limit = limit
                if read_only is not None:
                    block.read_only = read_only
                if metadata is not None:
                    block.metadata_ = metadata
                await block.update_async(db_session=session, actor=actor)
            else:
                # Create new block and link to agent in a single transaction
                from letta.schemas.block import BaseBlock

                block = BlockModel(
                    id=BaseBlock.generate_id(),
                    label=label,
                    value=value,
                    description=description or f"{label} block",
                    limit=limit or CORE_MEMORY_BLOCK_CHAR_LIMIT,
                    read_only=read_only or False,
                    metadata_=metadata or {},
                    organization_id=actor.organization_id,
                )
                await block.create_async(db_session=session, actor=actor, no_commit=True)

                # Link to agent
                from letta.orm.blocks_agents import BlocksAgents

                blocks_agents = BlocksAgents(
                    agent_id=agent_id,
                    block_id=block.id,
                    block_label=label,
                )
                session.add(blocks_agents)
                await session.commit()

            return block.to_pydantic()

    async def _delete_block_from_postgres(
        self,
        agent_id: str,
        label: str,
        actor: PydanticUser,
    ) -> None:
        """Delete a block from PostgreSQL cache."""
        async with db_registry.async_session() as session:
            from sqlalchemy import delete, select

            from letta.orm.blocks_agents import BlocksAgents

            # Find block for this agent+label
            result = await session.execute(
                select(BlockModel)
                .join(BlocksAgents, BlocksAgents.block_id == BlockModel.id)
                .where(
                    BlocksAgents.agent_id == agent_id,
                    BlockModel.label == label,
                    BlockModel.organization_id == actor.organization_id,
                )
            )
            block = result.scalar_one_or_none()

            if block:
                # Delete from blocks_agents
                await session.execute(delete(BlocksAgents).where(BlocksAgents.block_id == block.id))
                # Delete the block
                await block.hard_delete_async(db_session=session, actor=actor)

    # =========================================================================
    # Override BlockManager methods to add git integration
    # =========================================================================

    @enforce_types
    @trace_method
    async def update_block_async(
        self,
        block_id: str,
        block_update: BlockUpdate,
        actor: PydanticUser,
    ) -> PydanticBlock:
        """Update a block. If git-enabled, commits to git first."""
        t_start = time.perf_counter()
        logger.info(f"[GIT_PERF] update_block_async START block_id={block_id}")

        # Get agent ID for this block
        t0 = time.perf_counter()
        agent_id = await self._get_agent_id_for_block(block_id, actor)
        logger.info(f"[GIT_PERF] _get_agent_id_for_block took {(time.perf_counter() - t0) * 1000:.2f}ms agent_id={agent_id}")

        # Check if git is enabled for this agent
        t0 = time.perf_counter()
        git_enabled = agent_id and await self._is_git_enabled_for_agent(agent_id, actor)
        logger.info(f"[GIT_PERF] _is_git_enabled_for_agent took {(time.perf_counter() - t0) * 1000:.2f}ms enabled={git_enabled}")

        if git_enabled:
            # Get current block to get label
            t0 = time.perf_counter()
            async with db_registry.async_session() as session:
                block = await BlockModel.read_async(db_session=session, identifier=block_id, actor=actor)
                label = block.label
            logger.info(f"[GIT_PERF] BlockModel.read_async took {(time.perf_counter() - t0) * 1000:.2f}ms label={label}")

            # 1. Commit to git (source of truth)
            # Resolve each field: use the update value if provided, else fall back
            # to the current block value from Postgres.
            resolved_value = block_update.value if block_update.value is not None else block.value
            resolved_description = block_update.description if block_update.description is not None else block.description
            resolved_limit = block_update.limit if block_update.limit is not None else block.limit
            resolved_read_only = block_update.read_only if block_update.read_only is not None else block.read_only
            resolved_metadata = block_update.metadata if block_update.metadata is not None else (block.metadata_ or {})

            t0 = time.perf_counter()
            commit = await self.memory_repo_manager.update_block_async(
                agent_id=agent_id,
                label=label,
                value=resolved_value,
                actor=actor,
                message=f"Update {label} block",
                description=resolved_description,
                limit=resolved_limit,
                read_only=resolved_read_only,
                metadata=resolved_metadata,
            )
            git_time = (time.perf_counter() - t0) * 1000
            logger.info(f"[GIT_PERF] memory_repo_manager.update_block_async took {git_time:.2f}ms commit={commit.sha[:8]}")

            # 2. Sync to PostgreSQL cache
            t0 = time.perf_counter()
            result = await self._sync_block_to_postgres(
                agent_id=agent_id,
                label=label,
                value=block_update.value or block.value,
                actor=actor,
                description=block_update.description,
                limit=block_update.limit,
            )
            logger.info(f"[GIT_PERF] _sync_block_to_postgres took {(time.perf_counter() - t0) * 1000:.2f}ms")

            # Block tags are not stored in git (today); they remain Postgres-only metadata.
            # Preserve legacy behavior by updating tags in Postgres even for git-enabled agents.
            if block_update.tags is not None:
                async with db_registry.async_session() as session:
                    from letta.orm.blocks_tags import BlocksTags

                    await BlockManager._replace_block_pivot_rows_async(
                        session,
                        BlocksTags.__table__,
                        block_id,
                        [{"block_id": block_id, "tag": tag, "organization_id": actor.organization_id} for tag in block_update.tags],
                    )
                result.tags = block_update.tags
            else:
                async with db_registry.async_session() as session:
                    from sqlalchemy import select

                    from letta.orm.blocks_tags import BlocksTags

                    tags_result = await session.execute(select(BlocksTags.tag).where(BlocksTags.block_id == block_id))
                    result.tags = [row[0] for row in tags_result.fetchall()]

            total_time = (time.perf_counter() - t_start) * 1000
            logger.info(f"[GIT_PERF] update_block_async TOTAL {total_time:.2f}ms (git-enabled path)")
            return result
        else:
            # Fall back to standard PostgreSQL-only behavior
            t0 = time.perf_counter()
            result = await super().update_block_async(block_id, block_update, actor)
            logger.info(f"[GIT_PERF] super().update_block_async took {(time.perf_counter() - t0) * 1000:.2f}ms")

            total_time = (time.perf_counter() - t_start) * 1000
            logger.info(f"[GIT_PERF] update_block_async TOTAL {total_time:.2f}ms (postgres-only path)")
            return result

    @enforce_types
    @trace_method
    async def create_block_async(
        self,
        block: CreateBlock,
        actor: PydanticUser,
        agent_id: Optional[str] = None,
    ) -> PydanticBlock:
        """Create a block. If git-enabled and agent_id provided, commits to git first."""
        # Check if git is enabled for this agent
        if agent_id and await self._is_git_enabled_for_agent(agent_id, actor):
            # 1. Commit to git (source of truth)
            commit = await self.memory_repo_manager.create_block_async(
                agent_id=agent_id,
                block=PydanticBlock(
                    label=block.label,
                    value=block.value,
                    description=block.description,
                    limit=block.limit or CORE_MEMORY_BLOCK_CHAR_LIMIT,
                ),
                actor=actor,
                message=f"Create {block.label} block",
            )
            logger.info(f"Git commit for block create: {commit.sha[:8]}")

            # 2. Sync to PostgreSQL cache
            return await self._sync_block_to_postgres(
                agent_id=agent_id,
                label=block.label,
                value=block.value,
                actor=actor,
                description=block.description,
                limit=block.limit,
            )
        else:
            # Fall back to standard PostgreSQL-only behavior
            return await super().create_block_async(block, actor)

    @enforce_types
    @trace_method
    async def delete_block_async(self, block_id: str, actor: PydanticUser) -> None:
        """Delete a block. If git-enabled, commits deletion to git first."""
        # Get agent ID and label for this block
        agent_id = await self._get_agent_id_for_block(block_id, actor)

        if agent_id and await self._is_git_enabled_for_agent(agent_id, actor):
            # Get block label before deleting
            async with db_registry.async_session() as session:
                block = await BlockModel.read_async(db_session=session, identifier=block_id, actor=actor)
                label = block.label

            # 1. Commit deletion to git (source of truth)
            commit = await self.memory_repo_manager.delete_block_async(
                agent_id=agent_id,
                label=label,
                actor=actor,
                message=f"Delete {label} block",
            )
            logger.info(f"Git commit for block delete: {commit.sha[:8]}")

            # 2. Delete from PostgreSQL cache
            await self._delete_block_from_postgres(agent_id, label, actor)
        else:
            # Fall back to standard PostgreSQL-only behavior
            await super().delete_block_async(block_id, actor)

    # =========================================================================
    # Git-specific methods
    # =========================================================================

    @enforce_types
    @trace_method
    async def enable_git_memory_for_agent(
        self,
        agent_id: str,
        actor: PydanticUser,
    ) -> None:
        """Enable git-based memory for an agent.

        This:
        1. Adds the GIT_MEMORY_ENABLED_TAG to the agent
        2. Creates a git repo for the agent
        3. Commits current blocks as initial state
        """
        if self.memory_repo_manager is None:
            raise ValueError("Memory repo manager not configured")

        # If already enabled (tag exists), ensure the repo exists.
        #
        # This matters because tags can be added via the agent update endpoint. In that
        # flow, the tag may be persisted before the git repo is created. We treat the
        # tag as the source-of-truth "desired state" and backfill the repo if missing.
        if await self._is_git_enabled_for_agent(agent_id, actor):
            try:
                # Fast check: does the repo exist in backing storage?
                await self.memory_repo_manager.git.get_head_sha(agent_id=agent_id, org_id=actor.organization_id)

                # Repo exists - check if all blocks are present
                blocks = await self.get_blocks_by_agent_async(agent_id, actor)
                repo_files = await self.memory_repo_manager.git.get_files(agent_id=agent_id, org_id=actor.organization_id, ref="HEAD")

                # Check which blocks are missing from repo
                missing_blocks = []
                for block in blocks:
                    expected_path = f"{block.label}.md"
                    if expected_path not in repo_files:
                        missing_blocks.append(block)

                if missing_blocks:
                    logger.warning(
                        "Git memory repo exists but missing %d/%d blocks for agent %s; backfilling",
                        len(missing_blocks),
                        len(blocks),
                        agent_id,
                    )
                    # Commit missing blocks
                    for block in missing_blocks:
                        await self.memory_repo_manager.update_block_async(
                            agent_id=agent_id,
                            label=block.label,
                            value=block.value or "",
                            actor=actor,
                            message=f"Backfill {block.label} block",
                        )
                    logger.info(f"Backfilled {len(missing_blocks)} missing blocks for agent {agent_id}")
                else:
                    logger.info(f"Git memory already enabled for agent {agent_id}")
                return
            except FileNotFoundError:
                logger.warning(
                    "Git memory tag present but repo missing for agent %s; creating repo from current blocks",
                    agent_id,
                )
                blocks = await self.get_blocks_by_agent_async(agent_id, actor)
                # Ensure blocks have path-based labels before creating repo.
                # All existing blocks were rendered in the system prompt, so they
                # need the system/ prefix.  Check startswith (not "/" presence)
                # because labels like "letta/letta_town" contain "/" but aren't
                # yet in the system/ namespace.
                for block in blocks:
                    if not block.label.startswith("system/"):
                        old_label = block.label
                        new_label = f"system/{block.label}"
                        async with db_registry.async_session() as session:
                            block_orm = await BlockModel.read_async(db_session=session, identifier=block.id, actor=actor)
                            block_orm.label = new_label
                            await session.commit()
                        block.label = new_label
                        logger.info(f"Transformed block label '{old_label}' -> '{new_label}' during backfill for agent {agent_id}")
                await self.memory_repo_manager.create_repo_async(
                    agent_id=agent_id,
                    actor=actor,
                    initial_blocks=blocks,
                )
                logger.info(f"Backfilled git repo for agent {agent_id} with {len(blocks)} blocks")
                return

        # Get current blocks for this agent and transform labels to path-based.
        # All existing blocks were in the system prompt, so they need the system/ prefix.
        # Use startswith check (not "/" presence) because labels like "letta/letta_town"
        # contain "/" but aren't yet in the system/ namespace.
        blocks = await self.get_blocks_by_agent_async(agent_id, actor)
        for block in blocks:
            if not block.label.startswith("system/"):
                old_label = block.label
                new_label = f"system/{block.label}"
                logger.info(f"Transforming block label '{old_label}' -> '{new_label}' for agent {agent_id}")

                # Rename in PostgreSQL directly
                async with db_registry.async_session() as session:
                    block_orm = await BlockModel.read_async(db_session=session, identifier=block.id, actor=actor)
                    block_orm.label = new_label
                    await session.commit()

                block.label = new_label

        # Create git repo with path-based blocks
        await self.memory_repo_manager.create_repo_async(
            agent_id=agent_id,
            actor=actor,
            initial_blocks=blocks,
        )

        # Add the tag
        async with db_registry.async_session() as session:
            from letta.orm.agents_tags import AgentsTags

            tag = AgentsTags(
                agent_id=agent_id,
                tag=GIT_MEMORY_ENABLED_TAG,
            )
            session.add(tag)
            await session.commit()

        logger.info(f"Enabled git memory for agent {agent_id} with {len(blocks)} blocks")

    @enforce_types
    @trace_method
    async def disable_git_memory_for_agent(
        self,
        agent_id: str,
        actor: PydanticUser,
    ) -> None:
        """Disable git-based memory for an agent.

        This removes the tag but keeps the git repo for historical reference.
        """
        async with db_registry.async_session() as session:
            from sqlalchemy import delete

            from letta.orm.agents_tags import AgentsTags

            await session.execute(
                delete(AgentsTags).where(
                    AgentsTags.agent_id == agent_id,
                    AgentsTags.tag == GIT_MEMORY_ENABLED_TAG,
                )
            )

        logger.info(f"Disabled git memory for agent {agent_id}")

    @enforce_types
    @trace_method
    async def get_block_at_commit(
        self,
        agent_id: str,
        label: str,
        commit_sha: str,
        actor: PydanticUser,
    ) -> Optional[PydanticBlock]:
        """Get a block's value at a specific commit.

        This is a git-only operation that reads from version history.
        """
        if self.memory_repo_manager is None:
            raise ValueError("Memory repo manager not configured")

        return await self.memory_repo_manager.get_block_async(
            agent_id=agent_id,
            label=label,
            actor=actor,
            ref=commit_sha,
        )

    @enforce_types
    @trace_method
    async def get_block_history(
        self,
        agent_id: str,
        actor: PydanticUser,
        label: Optional[str] = None,
        limit: int = 50,
    ):
        """Get commit history for an agent's memory blocks.

        Args:
            agent_id: Agent ID
            actor: User performing the operation
            label: Optional block label to filter by
            limit: Maximum commits to return

        Returns:
            List of MemoryCommit objects
        """
        if self.memory_repo_manager is None:
            raise ValueError("Memory repo manager not configured")

        path = f"{label}.md" if label else None
        return await self.memory_repo_manager.get_history_async(
            agent_id=agent_id,
            actor=actor,
            path=path,
            limit=limit,
        )

    @enforce_types
    @trace_method
    async def sync_blocks_from_git(
        self,
        agent_id: str,
        actor: PydanticUser,
    ) -> List[PydanticBlock]:
        """Sync all blocks from git to PostgreSQL.

        Use this to rebuild the PostgreSQL cache from git source of truth.
        """
        if self.memory_repo_manager is None:
            raise ValueError("Memory repo manager not configured")

        # Get all blocks from git
        git_blocks = await self.memory_repo_manager.get_blocks_async(
            agent_id=agent_id,
            actor=actor,
        )

        # Sync each to PostgreSQL
        synced_blocks = []
        for block in git_blocks:
            synced = await self._sync_block_to_postgres(
                agent_id=agent_id,
                label=block.label,
                value=block.value,
                actor=actor,
                description=block.description,
                limit=block.limit,
            )
            synced_blocks.append(synced)

        logger.info(f"Synced {len(synced_blocks)} blocks from git for agent {agent_id}")
        return synced_blocks
