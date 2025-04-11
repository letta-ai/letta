import os
from typing import List, Optional

from sqlalchemy.orm import Session

from letta.orm.block import Block as BlockModel
from letta.orm.block_history import BlockHistory
from letta.orm.enums import ActorType
from letta.orm.errors import NoResultFound
from letta.schemas.agent import AgentState as PydanticAgentState
from letta.schemas.block import Block as PydanticBlock
from letta.schemas.block import BlockUpdate, Human, Persona
from letta.schemas.user import User as PydanticUser
from letta.utils import enforce_types, list_human_files, list_persona_files


class BlockManager:
    """Manager class to handle business logic related to Blocks."""

    def __init__(self):
        # Fetching the db_context similarly as in ToolManager
        from letta.server.db import db_context

        self.session_maker = db_context

    @enforce_types
    def create_or_update_block(self, block: PydanticBlock, actor: PydanticUser) -> PydanticBlock:
        """Create a new block based on the Block schema."""
        db_block = self.get_block_by_id(block.id, actor)
        if db_block:
            update_data = BlockUpdate(**block.model_dump(to_orm=True, exclude_none=True))
            self.update_block(block.id, update_data, actor)
        else:
            with self.session_maker() as session:
                data = block.model_dump(to_orm=True, exclude_none=True)
                block = BlockModel(**data, organization_id=actor.organization_id)
                block.create(session, actor=actor)
            return block.to_pydantic()

    @enforce_types
    def update_block(self, block_id: str, block_update: BlockUpdate, actor: PydanticUser) -> PydanticBlock:
        """Update a block by its ID with the given BlockUpdate object."""
        # Safety check for block

        with self.session_maker() as session:
            block = BlockModel.read(db_session=session, identifier=block_id, actor=actor)
            update_data = block_update.model_dump(to_orm=True, exclude_unset=True, exclude_none=True)

            for key, value in update_data.items():
                setattr(block, key, value)

            block.update(db_session=session, actor=actor)
            return block.to_pydantic()

    @enforce_types
    def delete_block(self, block_id: str, actor: PydanticUser) -> PydanticBlock:
        """Delete a block by its ID."""
        with self.session_maker() as session:
            block = BlockModel.read(db_session=session, identifier=block_id)
            block.hard_delete(db_session=session, actor=actor)
            return block.to_pydantic()

    @enforce_types
    def get_blocks(
        self,
        actor: PydanticUser,
        label: Optional[str] = None,
        is_template: Optional[bool] = None,
        template_name: Optional[str] = None,
        identifier_keys: Optional[List[str]] = None,
        identity_id: Optional[str] = None,
        id: Optional[str] = None,
        after: Optional[str] = None,
        limit: Optional[int] = 50,
    ) -> List[PydanticBlock]:
        """Retrieve blocks based on various optional filters."""
        with self.session_maker() as session:
            # Prepare filters
            filters = {"organization_id": actor.organization_id}
            if label:
                filters["label"] = label
            if is_template is not None:
                filters["is_template"] = is_template
            if template_name:
                filters["template_name"] = template_name
            if id:
                filters["id"] = id

            blocks = BlockModel.list(
                db_session=session,
                after=after,
                limit=limit,
                identifier_keys=identifier_keys,
                identity_id=identity_id,
                **filters,
            )

            return [block.to_pydantic() for block in blocks]

    @enforce_types
    def get_block_by_id(self, block_id: str, actor: Optional[PydanticUser] = None) -> Optional[PydanticBlock]:
        """Retrieve a block by its name."""
        with self.session_maker() as session:
            try:
                block = BlockModel.read(db_session=session, identifier=block_id, actor=actor)
                return block.to_pydantic()
            except NoResultFound:
                return None

    @enforce_types
    def get_all_blocks_by_ids(self, block_ids: List[str], actor: Optional[PydanticUser] = None) -> List[PydanticBlock]:
        """Retrieve blocks by their ids."""
        with self.session_maker() as session:
            blocks = [block.to_pydantic() for block in BlockModel.read_multiple(db_session=session, identifiers=block_ids, actor=actor)]
            # backwards compatibility. previous implementation added None for every block not found.
            blocks.extend([None for _ in range(len(block_ids) - len(blocks))])
            return blocks

    @enforce_types
    def add_default_blocks(self, actor: PydanticUser):
        for persona_file in list_persona_files():
            with open(persona_file, "r", encoding="utf-8") as f:
                text = f.read()
            name = os.path.basename(persona_file).replace(".txt", "")
            self.create_or_update_block(Persona(template_name=name, value=text, is_template=True), actor=actor)

        for human_file in list_human_files():
            with open(human_file, "r", encoding="utf-8") as f:
                text = f.read()
            name = os.path.basename(human_file).replace(".txt", "")
            self.create_or_update_block(Human(template_name=name, value=text, is_template=True), actor=actor)

    @enforce_types
    def get_agents_for_block(self, block_id: str, actor: PydanticUser) -> List[PydanticAgentState]:
        """
        Retrieve all agents associated with a given block.
        """
        with self.session_maker() as session:
            block = BlockModel.read(db_session=session, identifier=block_id, actor=actor)
            agents_orm = block.agents
            agents_pydantic = [agent.to_pydantic() for agent in agents_orm]

            return agents_pydantic

    # Block History Functions

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
        with self.session_maker() as session:
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

    @enforce_types
    def undo_checkpoint_block(self, block_id: str, actor: PydanticUser, use_preloaded_block: Optional[BlockModel] = None) -> PydanticBlock:
        """
        Move the block to the immediately previous checkpoint in BlockHistory.
        If older sequences have been pruned, we jump to the largest sequence
        number that is still < current_seq.
        """
        with self.session_maker() as session:
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

    @enforce_types
    def redo_checkpoint_block(self, block_id: str, actor: PydanticUser, use_preloaded_block: Optional[BlockModel] = None) -> PydanticBlock:
        """
        Move the block to the next checkpoint if it exists.
        If some middle checkpoints have been pruned, we jump to the smallest
        sequence > current_seq that remains.
        """
        with self.session_maker() as session:
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
