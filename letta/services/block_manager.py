import asyncio
from typing import Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from letta.log import get_logger
from letta.orm.block import Block as BlockModel
from letta.orm.block_history import BlockHistory
from letta.orm.errors import NoResultFound
from letta.otel.tracing import trace_method
from letta.schemas.agent import AgentState as PydanticAgentState
from letta.schemas.block import Block as PydanticBlock
from letta.schemas.block import BlockUpdate
from letta.schemas.enums import ActorType
from letta.schemas.user import User as PydanticUser
from letta.server.db import db_registry
from letta.utils import enforce_types

logger = get_logger(__name__)


class BlockManager:
    """Manager class to handle business logic related to Blocks."""

    @trace_method
    @enforce_types
    def create_or_update_block(self, block: PydanticBlock, actor: PydanticUser) -> PydanticBlock:
        """Create a new block based on the Block schema."""
        db_block = self.get_block_by_id(block.id, actor)
        if db_block:
            update_data = BlockUpdate(**block.model_dump(to_orm=True, exclude_none=True))
            self.update_block(block.id, update_data, actor)
        else:
            with db_registry.session() as session:
                data = block.model_dump(to_orm=True, exclude_none=True)
                block = BlockModel(**data, organization_id=actor.organization_id)
                block.create(session, actor=actor)
            return block.to_pydantic()

    @trace_method
    @enforce_types
    async def create_or_update_block_async(self, block: PydanticBlock, actor: PydanticUser) -> PydanticBlock:
        """Create a new block based on the Block schema."""
        db_block = await self.get_block_by_id_async(block.id, actor)
        if db_block:
            update_data = BlockUpdate(**block.model_dump(to_orm=True, exclude_none=True))
            return await self.update_block_async(block.id, update_data, actor)
        else:
            async with db_registry.async_session() as session:
                data = block.model_dump(to_orm=True, exclude_none=True)
                block = BlockModel(**data, organization_id=actor.organization_id)
                await block.create_async(session, actor=actor)
                return block.to_pydantic()

    @trace_method
    @enforce_types
    def batch_create_blocks(self, blocks: List[PydanticBlock], actor: PydanticUser) -> List[PydanticBlock]:
        """
        Batch-create multiple Blocks in one transaction for better performance.
        Args:
            blocks: List of PydanticBlock schemas to create
            actor:    The user performing the operation
        Returns:
            List of created PydanticBlock instances (with IDs, timestamps, etc.)
        """
        if not blocks:
            return []

        with db_registry.session() as session:
            block_models = [
                BlockModel(**block.model_dump(to_orm=True, exclude_none=True), organization_id=actor.organization_id) for block in blocks
            ]

            created_models = BlockModel.batch_create(items=block_models, db_session=session, actor=actor)

            # Convert back to Pydantic
            return [m.to_pydantic() for m in created_models]

    @trace_method
    @enforce_types
    async def batch_create_blocks_async(self, blocks: List[PydanticBlock], actor: PydanticUser) -> List[PydanticBlock]:
        """
        Batch-create multiple Blocks in one transaction for better performance.
        Args:
            blocks: List of PydanticBlock schemas to create
            actor:    The user performing the operation
        Returns:
            List of created PydanticBlock instances (with IDs, timestamps, etc.)
        """
        if not blocks:
            return []

        async with db_registry.async_session() as session:
            block_models = [
                BlockModel(**block.model_dump(to_orm=True, exclude_none=True), organization_id=actor.organization_id) for block in blocks
            ]

            created_models = await BlockModel.batch_create_async(items=block_models, db_session=session, actor=actor)

            # Convert back to Pydantic
            return [m.to_pydantic() for m in created_models]

    @trace_method
    @enforce_types
    def update_block(self, block_id: str, block_update: BlockUpdate, actor: PydanticUser) -> PydanticBlock:
        """Update a block by its ID with the given BlockUpdate object."""
        # Safety check for block

        with db_registry.session() as session:
            block = BlockModel.read(db_session=session, identifier=block_id, actor=actor)
            update_data = block_update.model_dump(to_orm=True, exclude_unset=True, exclude_none=True)

            for key, value in update_data.items():
                setattr(block, key, value)

            block.update(db_session=session, actor=actor)
            return block.to_pydantic()

    @trace_method
    @enforce_types
    async def update_block_async(self, block_id: str, block_update: BlockUpdate, actor: PydanticUser) -> PydanticBlock:
        """Update a block by its ID with the given BlockUpdate object."""
        # Safety check for block

        async with db_registry.async_session() as session:
            block = await BlockModel.read_async(db_session=session, identifier=block_id, actor=actor)
            update_data = block_update.model_dump(to_orm=True, exclude_unset=True, exclude_none=True)

            for key, value in update_data.items():
                setattr(block, key, value)

            await block.update_async(db_session=session, actor=actor)
            return block.to_pydantic()

    @trace_method
    @enforce_types
    def delete_block(self, block_id: str, actor: PydanticUser) -> PydanticBlock:
        """Delete a block by its ID."""
        with db_registry.session() as session:
            block = BlockModel.read(db_session=session, identifier=block_id)
            block.hard_delete(db_session=session, actor=actor)
            return block.to_pydantic()

    @trace_method
    @enforce_types
    async def delete_block_async(self, block_id: str, actor: PydanticUser) -> PydanticBlock:
        """Delete a block by its ID."""
        async with db_registry.async_session() as session:
            block = await BlockModel.read_async(db_session=session, identifier=block_id, actor=actor)
            await block.hard_delete_async(db_session=session, actor=actor)
            return block.to_pydantic()

    @trace_method
    @enforce_types
    async def get_blocks_async(
        self,
        actor: PydanticUser,
        label: Optional[str] = None,
        is_template: Optional[bool] = None,
        template_name: Optional[str] = None,
        identity_id: Optional[str] = None,
        identifier_keys: Optional[List[str]] = None,
        limit: Optional[int] = 50,
    ) -> List[PydanticBlock]:
        """Async version of get_blocks method. Retrieve blocks based on various optional filters."""
        from sqlalchemy import select
        from sqlalchemy.orm import noload

        from letta.orm.sqlalchemy_base import AccessType

        async with db_registry.async_session() as session:
            # Start with a basic query
            query = select(BlockModel)

            # Explicitly avoid loading relationships
            query = query.options(noload(BlockModel.agents), noload(BlockModel.identities), noload(BlockModel.groups))

            # Apply access control
            query = BlockModel.apply_access_predicate(query, actor, ["read"], AccessType.ORGANIZATION)

            # Add filters
            query = query.where(BlockModel.organization_id == actor.organization_id)
            if label:
                query = query.where(BlockModel.label == label)

            if is_template is not None:
                query = query.where(BlockModel.is_template == is_template)

            if template_name:
                query = query.where(BlockModel.template_name == template_name)

            if identifier_keys:
                query = (
                    query.join(BlockModel.identities)
                    .filter(BlockModel.identities.property.mapper.class_.identifier_key.in_(identifier_keys))
                    .distinct(BlockModel.id)
                )

            if identity_id:
                query = (
                    query.join(BlockModel.identities)
                    .filter(BlockModel.identities.property.mapper.class_.id == identity_id)
                    .distinct(BlockModel.id)
                )

            # Add limit
            if limit:
                query = query.limit(limit)

            # Execute the query
            result = await session.execute(query)
            blocks = result.scalars().all()

            return [block.to_pydantic() for block in blocks]

    @trace_method
    @enforce_types
    def get_block_by_id(self, block_id: str, actor: Optional[PydanticUser] = None) -> Optional[PydanticBlock]:
        """Retrieve a block by its name."""
        with db_registry.session() as session:
            try:
                block = BlockModel.read(db_session=session, identifier=block_id, actor=actor)
                return block.to_pydantic()
            except NoResultFound:
                return None

    @trace_method
    @enforce_types
    async def get_block_by_id_async(self, block_id: str, actor: Optional[PydanticUser] = None) -> Optional[PydanticBlock]:
        """Retrieve a block by its name."""
        async with db_registry.async_session() as session:
            try:
                block = await BlockModel.read_async(db_session=session, identifier=block_id, actor=actor)
                return block.to_pydantic()
            except NoResultFound:
                return None

    @trace_method
    @enforce_types
    async def get_all_blocks_by_ids_async(self, block_ids: List[str], actor: Optional[PydanticUser] = None) -> List[PydanticBlock]:
        """Retrieve blocks by their ids without loading unnecessary relationships. Async implementation."""
        from sqlalchemy import select
        from sqlalchemy.orm import noload

        from letta.orm.sqlalchemy_base import AccessType

        if not block_ids:
            return []

        async with db_registry.async_session() as session:
            # Start with a basic query
            query = select(BlockModel)

            # Add ID filter
            query = query.where(BlockModel.id.in_(block_ids))

            # Explicitly avoid loading relationships
            query = query.options(noload(BlockModel.agents), noload(BlockModel.identities), noload(BlockModel.groups))

            # Apply access control if actor is provided
            if actor:
                query = BlockModel.apply_access_predicate(query, actor, ["read"], AccessType.ORGANIZATION)

            # TODO: Add soft delete filter if applicable
            # if hasattr(BlockModel, "is_deleted"):
            #     query = query.where(BlockModel.is_deleted == False)

            # Execute the query
            result = await session.execute(query)
            blocks = result.scalars().all()

            # Convert to Pydantic models
            pydantic_blocks = [block.to_pydantic() for block in blocks]

            # For backward compatibility, add None for missing blocks
            if len(pydantic_blocks) < len(block_ids):
                {block.id for block in pydantic_blocks}
                result_blocks = []
                for block_id in block_ids:
                    block = next((b for b in pydantic_blocks if b.id == block_id), None)
                    result_blocks.append(block)
                return result_blocks

            return pydantic_blocks

    @trace_method
    @enforce_types
    async def get_agents_for_block_async(
        self,
        block_id: str,
        actor: PydanticUser,
        include_relationships: Optional[List[str]] = None,
    ) -> List[PydanticAgentState]:
        """
        Retrieve all agents associated with a given block.
        """
        async with db_registry.async_session() as session:
            block = await BlockModel.read_async(db_session=session, identifier=block_id, actor=actor)
            agents_orm = block.agents
            agents = await asyncio.gather(*[agent.to_pydantic_async(include_relationships=include_relationships) for agent in agents_orm])
            return agents

    @trace_method
    @enforce_types
    async def size_async(self, actor: PydanticUser) -> int:
        """
        Get the total count of blocks for the given user.
        """
        async with db_registry.async_session() as session:
            return await BlockModel.size_async(db_session=session, actor=actor)

    # Block History Functions

    @trace_method
    @enforce_types
    def checkpoint_block(
        self,
        block_id: str,
        actor: PydanticUser,
        agent_id: Optional[str] = None,
        use_preloaded_block: Optional[BlockModel] = None,  # For concurrency tests
    ) -> PydanticBlock:
        """
        Create a new checkpoint for the given Block by copying its
        current state into BlockHistory, using SQLAlchemy's built-in
        version_id_col for concurrency checks.

        - If the block was undone to an earlier checkpoint, we remove
          any "future" checkpoints beyond the current state to keep a
          strictly linear history.
        - A single commit at the end ensures atomicity.
        """
        with db_registry.session() as session:
            # 1) Load the Block
            if use_preloaded_block is not None:
                block = session.merge(use_preloaded_block)
            else:
                block = BlockModel.read(db_session=session, identifier=block_id, actor=actor)

            # 2) Identify the block's current checkpoint (if any)
            current_entry = None
            if block.current_history_entry_id:
                current_entry = session.get(BlockHistory, block.current_history_entry_id)

            # The current sequence, or 0 if no checkpoints exist
            current_seq = current_entry.sequence_number if current_entry else 0

            # 3) Truncate any future checkpoints
            #    If we are at seq=2, but there's a seq=3 or higher from a prior "redo chain",
            #    remove those, so we maintain a strictly linear undo/redo stack.
            session.query(BlockHistory).filter(BlockHistory.block_id == block.id, BlockHistory.sequence_number > current_seq).delete()

            # 4) Determine the next sequence number
            next_seq = current_seq + 1

            # 5) Create a new BlockHistory row reflecting the block's current state
            history_entry = BlockHistory(
                organization_id=actor.organization_id,
                block_id=block.id,
                sequence_number=next_seq,
                description=block.description,
                label=block.label,
                value=block.value,
                limit=block.limit,
                metadata_=block.metadata_,
                actor_type=ActorType.LETTA_AGENT if agent_id else ActorType.LETTA_USER,
                actor_id=agent_id if agent_id else actor.id,
            )
            history_entry.create(session, actor=actor, no_commit=True)

            # 6) Update the block’s pointer to the new checkpoint
            block.current_history_entry_id = history_entry.id

            # 7) Flush changes, then commit once
            block = block.update(db_session=session, actor=actor, no_commit=True)
            session.commit()

            return block.to_pydantic()

    @enforce_types
    def _move_block_to_sequence(self, session: Session, block: BlockModel, target_seq: int, actor: PydanticUser) -> BlockModel:
        """
        Internal helper that moves the 'block' to the specified 'target_seq' within BlockHistory.
        1) Find the BlockHistory row at sequence_number=target_seq
        2) Copy fields into the block
        3) Update and flush (no_commit=True) - the caller is responsible for final commit

        Raises:
            NoResultFound: if no BlockHistory row for (block_id, target_seq)
        """
        if not block.id:
            raise ValueError("Block is missing an ID. Cannot move sequence.")

        target_entry = (
            session.query(BlockHistory)
            .filter(
                BlockHistory.block_id == block.id,
                BlockHistory.sequence_number == target_seq,
            )
            .one_or_none()
        )
        if not target_entry:
            raise NoResultFound(f"No BlockHistory row found for block_id={block.id} at sequence={target_seq}")

        # Copy fields from target_entry to block
        block.description = target_entry.description  # type: ignore
        block.label = target_entry.label  # type: ignore
        block.value = target_entry.value  # type: ignore
        block.limit = target_entry.limit  # type: ignore
        block.metadata_ = target_entry.metadata_  # type: ignore
        block.current_history_entry_id = target_entry.id  # type: ignore

        # Update in DB (optimistic locking).
        # We'll do a flush now; the caller does final commit.
        updated_block = block.update(db_session=session, actor=actor, no_commit=True)
        return updated_block

    @trace_method
    @enforce_types
    def undo_checkpoint_block(self, block_id: str, actor: PydanticUser, use_preloaded_block: Optional[BlockModel] = None) -> PydanticBlock:
        """
        Move the block to the immediately previous checkpoint in BlockHistory.
        If older sequences have been pruned, we jump to the largest sequence
        number that is still < current_seq.
        """
        with db_registry.session() as session:
            # 1) Load the current block
            block = (
                session.merge(use_preloaded_block)
                if use_preloaded_block
                else BlockModel.read(db_session=session, identifier=block_id, actor=actor)
            )

            if not block.current_history_entry_id:
                raise ValueError(f"Block {block_id} has no history entry - cannot undo.")

            current_entry = session.get(BlockHistory, block.current_history_entry_id)
            if not current_entry:
                raise NoResultFound(f"BlockHistory row not found for id={block.current_history_entry_id}")

            current_seq = current_entry.sequence_number

            # 2) Find the largest sequence < current_seq
            previous_entry = (
                session.query(BlockHistory)
                .filter(BlockHistory.block_id == block.id, BlockHistory.sequence_number < current_seq)
                .order_by(BlockHistory.sequence_number.desc())
                .first()
            )
            if not previous_entry:
                # No earlier checkpoint available
                raise ValueError(f"Block {block_id} is already at the earliest checkpoint (seq={current_seq}). Cannot undo further.")

            # 3) Move to that sequence
            block = self._move_block_to_sequence(session, block, previous_entry.sequence_number, actor)

            # 4) Commit
            session.commit()
            return block.to_pydantic()

    @trace_method
    @enforce_types
    def redo_checkpoint_block(self, block_id: str, actor: PydanticUser, use_preloaded_block: Optional[BlockModel] = None) -> PydanticBlock:
        """
        Move the block to the next checkpoint if it exists.
        If some middle checkpoints have been pruned, we jump to the smallest
        sequence > current_seq that remains.
        """
        with db_registry.session() as session:
            block = (
                session.merge(use_preloaded_block)
                if use_preloaded_block
                else BlockModel.read(db_session=session, identifier=block_id, actor=actor)
            )

            if not block.current_history_entry_id:
                raise ValueError(f"Block {block_id} has no history entry - cannot redo.")

            current_entry = session.get(BlockHistory, block.current_history_entry_id)
            if not current_entry:
                raise NoResultFound(f"BlockHistory row not found for id={block.current_history_entry_id}")

            current_seq = current_entry.sequence_number

            # Find the smallest sequence that is > current_seq
            next_entry = (
                session.query(BlockHistory)
                .filter(BlockHistory.block_id == block.id, BlockHistory.sequence_number > current_seq)
                .order_by(BlockHistory.sequence_number.asc())
                .first()
            )
            if not next_entry:
                raise ValueError(f"Block {block_id} is at the highest checkpoint (seq={current_seq}). Cannot redo further.")

            block = self._move_block_to_sequence(session, block, next_entry.sequence_number, actor)

            session.commit()
            return block.to_pydantic()

    @trace_method
    @enforce_types
    async def bulk_update_block_values_async(
        self, updates: Dict[str, str], actor: PydanticUser, return_hydrated: bool = False
    ) -> Optional[List[PydanticBlock]]:
        """
        Bulk-update the `value` field for multiple blocks in one transaction.

        Args:
            updates: mapping of block_id -> new value
            actor:   the user performing the update (for org scoping, permissions, audit)
            return_hydrated: whether to return the pydantic Block objects that were updated

        Returns:
            the updated Block objects as Pydantic schemas

        Raises:
            NoResultFound if any block_id doesn't exist or isn't visible to this actor
            ValueError     if any new value exceeds its block's limit
        """
        async with db_registry.async_session() as session:
            query = select(BlockModel).where(BlockModel.id.in_(updates.keys()), BlockModel.organization_id == actor.organization_id)
            result = await session.execute(query)
            blocks = result.scalars().all()

            found_ids = {b.id for b in blocks}
            missing = set(updates.keys()) - found_ids
            if missing:
                logger.warning(f"Block IDs not found or inaccessible, skipping during bulk update: {missing!r}")

            for block in blocks:
                new_val = updates[block.id]
                if len(new_val) > block.limit:
                    logger.warning(f"Value length ({len(new_val)}) exceeds limit " f"({block.limit}) for block {block.id!r}, truncating...")
                    new_val = new_val[: block.limit]
                block.value = new_val

            await session.commit()

            if return_hydrated:
                # TODO: implement for async
                pass

            return None
