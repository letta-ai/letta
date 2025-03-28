import os
from typing import List, Optional

from letta.orm.block import Block as BlockModel
from letta.orm.errors import NoResultFound
from letta.schemas.agent import AgentState as PydanticAgentState
from letta.schemas.block import Block
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
    def create_or_update_block(self, block: Block, actor: PydanticUser) -> PydanticBlock:
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
