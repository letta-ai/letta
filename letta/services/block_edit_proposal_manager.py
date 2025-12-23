from typing import List, Optional

from sqlalchemy import select

from letta.constants import READ_ONLY_BLOCK_EDIT_ERROR
from letta.errors import LettaInvalidArgumentError
from letta.orm.block import Block as BlockModel
from letta.orm.block_edit_proposal import BlockEditProposal as BlockEditProposalModel
from letta.orm.block_history import BlockHistory
from letta.orm.errors import NoResultFound
from letta.otel.tracing import trace_method
from letta.schemas.block import BlockUpdate
from letta.schemas.block_edit_proposal import BlockEditProposal, BlockProposalStatus
from letta.schemas.enums import ActorType, PrimitiveType
from letta.schemas.user import User as PydanticUser
from letta.server.db import db_registry
from letta.services.block_manager import validate_block_limit_constraint
from letta.utils import enforce_types
from letta.validators import raise_on_invalid_id


class BlockEditProposalManager:
    """Manager for proposing and approving block edits."""

    @enforce_types
    @trace_method
    @raise_on_invalid_id(param_name="block_id", expected_prefix=PrimitiveType.BLOCK)
    async def create_proposal_async(
        self,
        block_id: str,
        proposed_update: BlockUpdate,
        actor: PydanticUser,
        agent_id: Optional[str] = None,
    ) -> BlockEditProposal:
        update_data = proposed_update.model_dump(exclude_unset=True, exclude_none=True)
        if not update_data:
            raise LettaInvalidArgumentError("No block updates provided.", argument_name="proposed_update")

        async with db_registry.async_session() as session:
            block = await BlockModel.read_async(db_session=session, identifier=block_id, actor=actor)
            if block.read_only:
                raise LettaInvalidArgumentError(READ_ONLY_BLOCK_EDIT_ERROR, argument_name="block_id")

            validate_block_limit_constraint(update_data, block)

            proposal = BlockEditProposalModel(
                organization_id=actor.organization_id,
                block_id=block.id,
                status=BlockProposalStatus.pending.value,
                proposed_update=update_data,
                actor_type=ActorType.LETTA_AGENT if agent_id else ActorType.LETTA_USER,
                actor_id=agent_id if agent_id else actor.id,
                base_block_version=block.version,
                base_history_entry_id=block.current_history_entry_id,
            )
            await proposal.create_async(session, actor=actor, no_commit=True, no_refresh=True)
            await session.commit()
            return proposal.to_pydantic()

    @enforce_types
    @trace_method
    @raise_on_invalid_id(param_name="block_id", expected_prefix=PrimitiveType.BLOCK)
    async def list_proposals_async(
        self,
        block_id: str,
        actor: PydanticUser,
        status: Optional[BlockProposalStatus] = None,
        limit: Optional[int] = 50,
        ascending: bool = False,
    ) -> List[BlockEditProposal]:
        async with db_registry.async_session() as session:
            stmt = select(BlockEditProposalModel).where(
                BlockEditProposalModel.block_id == block_id,
                BlockEditProposalModel.organization_id == actor.organization_id,
            )
            if status:
                stmt = stmt.where(BlockEditProposalModel.status == status.value)

            if ascending:
                stmt = stmt.order_by(BlockEditProposalModel.created_at.asc())
            else:
                stmt = stmt.order_by(BlockEditProposalModel.created_at.desc())

            if limit:
                stmt = stmt.limit(limit)

            result = await session.execute(stmt)
            proposals = result.scalars().all()
            return [proposal.to_pydantic() for proposal in proposals]

    @enforce_types
    @trace_method
    @raise_on_invalid_id(param_name="proposal_id", expected_prefix=PrimitiveType.BLOCK_PROPOSAL)
    async def retrieve_proposal_async(self, proposal_id: str, actor: PydanticUser) -> BlockEditProposal:
        async with db_registry.async_session() as session:
            proposal = await BlockEditProposalModel.read_async(db_session=session, identifier=proposal_id, actor=actor)
            return proposal.to_pydantic()

    @enforce_types
    @trace_method
    @raise_on_invalid_id(param_name="block_id", expected_prefix=PrimitiveType.BLOCK)
    @raise_on_invalid_id(param_name="proposal_id", expected_prefix=PrimitiveType.BLOCK_PROPOSAL)
    async def approve_proposal_async(
        self,
        proposal_id: str,
        block_id: str,
        actor: PydanticUser,
        force: bool = False,
    ) -> BlockEditProposal:
        async with db_registry.async_session() as session:
            proposal = await BlockEditProposalModel.read_async(db_session=session, identifier=proposal_id, actor=actor)
            if proposal.block_id != block_id:
                raise LettaInvalidArgumentError("Proposal does not match block.", argument_name="block_id")
            if proposal.status != BlockProposalStatus.pending.value:
                raise LettaInvalidArgumentError("Proposal is already resolved.", argument_name="proposal_id")

            block = await BlockModel.read_async(db_session=session, identifier=block_id, actor=actor)
            if proposal.base_block_version is not None and block.version != proposal.base_block_version and not force:
                raise LettaInvalidArgumentError(
                    "Block has changed since proposal creation. Retry with force=True to apply anyway.",
                    argument_name="proposal_id",
                )
            if block.read_only:
                raise LettaInvalidArgumentError(READ_ONLY_BLOCK_EDIT_ERROR, argument_name="block_id")

            update_data = proposal.proposed_update or {}
            if not update_data:
                raise LettaInvalidArgumentError("Proposal has no updates.", argument_name="proposal_id")

            validate_block_limit_constraint(update_data, block)

            current_seq = 0
            if block.current_history_entry_id:
                current_entry = await session.get(BlockHistory, block.current_history_entry_id)
                if not current_entry:
                    raise NoResultFound(f"BlockHistory row not found for id={block.current_history_entry_id}")
                current_seq = current_entry.sequence_number

                stmt = select(BlockHistory).filter(
                    BlockHistory.block_id == block.id,
                    BlockHistory.sequence_number > current_seq,
                )
                result = await session.execute(stmt)
                for entry in result.scalars():
                    session.delete(entry)
                await session.flush()

            if current_seq == 0:
                baseline_entry = BlockHistory(
                    organization_id=actor.organization_id,
                    block_id=block.id,
                    sequence_number=1,
                    description=block.description,
                    label=block.label,
                    value=block.value,
                    limit=block.limit,
                    metadata_=block.metadata_,
                    actor_type=ActorType.LETTA_USER,
                    actor_id=actor.id,
                )
                await baseline_entry.create_async(session, actor=actor, no_commit=True)
                current_seq = 1

            for key, value in update_data.items():
                if key == "metadata":
                    setattr(block, "metadata_", value)
                else:
                    setattr(block, key, value)

            history_entry = BlockHistory(
                organization_id=actor.organization_id,
                block_id=block.id,
                sequence_number=current_seq + 1,
                description=block.description,
                label=block.label,
                value=block.value,
                limit=block.limit,
                metadata_=block.metadata_,
                actor_type=ActorType.LETTA_USER,
                actor_id=actor.id,
            )
            await history_entry.create_async(session, actor=actor, no_commit=True)
            block.current_history_entry_id = history_entry.id

            await block.update_async(db_session=session, actor=actor, no_commit=True, no_refresh=True)

            proposal.status = BlockProposalStatus.approved.value
            await proposal.update_async(db_session=session, actor=actor, no_commit=True, no_refresh=True)
            await session.commit()
            return proposal.to_pydantic()

    @enforce_types
    @trace_method
    @raise_on_invalid_id(param_name="proposal_id", expected_prefix=PrimitiveType.BLOCK_PROPOSAL)
    async def reject_proposal_async(self, proposal_id: str, actor: PydanticUser) -> BlockEditProposal:
        async with db_registry.async_session() as session:
            proposal = await BlockEditProposalModel.read_async(db_session=session, identifier=proposal_id, actor=actor)
            if proposal.status != BlockProposalStatus.pending.value:
                raise LettaInvalidArgumentError("Proposal is already resolved.", argument_name="proposal_id")
            proposal.status = BlockProposalStatus.rejected.value
            await proposal.update_async(db_session=session, actor=actor)
            return proposal.to_pydantic()
