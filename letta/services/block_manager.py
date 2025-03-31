import os
from typing import List, Optional

from sqlalchemy import func

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
        """Retrieve blocks by their names."""
        with self.session_maker() as session:
            blocks = list(
                map(lambda obj: obj.to_pydantic(), BlockModel.read_multiple(db_session=session, identifiers=block_ids, actor=actor))
            )
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
        use_preloaded_block: Optional[BlockModel] = None,  # TODO: Useful for testing concurrency
    ) -> PydanticBlock:
        """
        Create a new checkpoint for the given Block by copying its
        current state into BlockHistory, using SQLAlchemy's built-in
        version_id_col for concurrency checks.

        Note: We only have a single commit at the end, to avoid weird intermediate states.
        e.g. created a BlockHistory, but the block update failed
        """
        with self.session_maker() as session:
            # 1) Load the block via the ORM
            if use_preloaded_block is not None:
                block = session.merge(use_preloaded_block)
            else:
                block = BlockModel.read(db_session=session, identifier=block_id, actor=actor)

            # 2) Create a new sequence number for BlockHistory
            current_max_seq = session.query(func.max(BlockHistory.sequence_number)).filter(BlockHistory.block_id == block_id).scalar()
            next_seq = (current_max_seq or 0) + 1

            # 3) Create a snapshot in BlockHistory
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

            # 4) Update the block’s pointer
            block.current_history_entry_id = history_entry.id

            # 5) Now just flush; SQLAlchemy will:
            block = block.update(db_session=session, actor=actor, no_commit=True)
            session.commit()

            # Return the block’s new state
            return block.to_pydantic()

    @enforce_types
    def undo_checkpoint_block(self, block_id: str, actor: PydanticUser, use_preloaded_block: Optional[BlockModel] = None) -> PydanticBlock:
        """
        Move the block to the previous checkpoint by copying fields
        from the immediately previous BlockHistory entry (sequence_number - 1).

        1) Load the current block (either by merging a preloaded block or reading from DB).
        2) Identify its current history entry. If none, there's nothing to undo.
        3) Determine the previous checkpoint's sequence_number. If seq=1, we can't go earlier.
        4) Copy state from that previous checkpoint into the block.
        5) Commit transaction (optimistic lock check).
        6) Return the updated block as Pydantic.

        Raises:
            ValueError: If no previous checkpoint exists or if we can't find the matching row.
            NoResultFound: If the block or block history row do not exist.
            StaleDataError: If another transaction updated the block concurrently (optimistic locking).
        """
        with self.session_maker() as session:
            # 1) Load the block
            if use_preloaded_block is not None:
                block = session.merge(use_preloaded_block)
            else:
                block = BlockModel.read(db_session=session, identifier=block_id, actor=actor)

            if not block.current_history_entry_id:
                # There's no known history entry to revert from
                raise ValueError(f"Block {block_id} has no history entry - cannot undo.")

            # 2) Fetch the current history entry
            current_entry = session.get(BlockHistory, block.current_history_entry_id)
            if not current_entry:
                raise NoResultFound(f"BlockHistory row not found for id={block.current_history_entry_id}")

            current_seq = current_entry.sequence_number
            if current_seq <= 1:
                # This means there's no previous checkpoint
                raise ValueError(f"Block {block_id} is at the first checkpoint (seq=1). Cannot undo further.")

            # 3) The previous checkpoint is current_seq - 1
            previous_seq = current_seq - 1
            prev_entry = (
                session.query(BlockHistory)
                .filter(BlockHistory.block_id == block.id, BlockHistory.sequence_number == previous_seq)
                .one_or_none()
            )
            if not prev_entry:
                raise NoResultFound(f"No BlockHistory row for block_id={block.id} at sequence_number={previous_seq}")

            # 4) Copy fields from the prev_entry back to the block
            block.description = prev_entry.description
            block.label = prev_entry.label
            block.value = prev_entry.value
            block.limit = prev_entry.limit
            block.metadata_ = prev_entry.metadata_
            block.current_history_entry_id = prev_entry.id

            # 5) Commit with optimistic locking. We do a single commit at the end.
            block = block.update(db_session=session, actor=actor, no_commit=True)
            session.commit()

            # 6) Return the block’s new state in Pydantic form
            return block.to_pydantic()
