from typing import TYPE_CHECKING, Dict, List, Optional

if TYPE_CHECKING:
    pass

# Import AgentState outside TYPE_CHECKING for @enforce_types decorator
from sqlalchemy import delete, func, select

from letta.errors import LettaInvalidArgumentError
from letta.orm.agent import Agent as AgentModel
from letta.orm.block import Block as BlockModel
from letta.orm.blocks_conversations import BlocksConversations
from letta.orm.conversation import Conversation as ConversationModel
from letta.orm.conversation_messages import ConversationMessage as ConversationMessageModel
from letta.orm.errors import NoResultFound
from letta.orm.message import Message as MessageModel
from letta.otel.tracing import trace_method
from letta.schemas.agent import AgentState
from letta.schemas.block import Block as PydanticBlock
from letta.schemas.conversation import Conversation as PydanticConversation, CreateConversation, UpdateConversation
from letta.schemas.letta_message import LettaMessage
from letta.schemas.message import Message as PydanticMessage
from letta.schemas.user import User as PydanticUser
from letta.server.db import db_registry
from letta.utils import enforce_types


class ConversationManager:
    """Manager class to handle business logic related to Conversations."""

    @enforce_types
    @trace_method
    async def create_conversation(
        self,
        agent_id: str,
        conversation_create: CreateConversation,
        actor: PydanticUser,
    ) -> PydanticConversation:
        """Create a new conversation for an agent.

        Args:
            agent_id: The ID of the agent this conversation belongs to
            conversation_create: The conversation creation request, optionally including
                isolated_block_labels for conversation-specific memory blocks
            actor: The user performing the action

        Returns:
            The created conversation with isolated_block_ids if any were created
        """
        async with db_registry.async_session() as session:
            conversation = ConversationModel(
                agent_id=agent_id,
                summary=conversation_create.summary,
                organization_id=actor.organization_id,
            )
            await conversation.create_async(session, actor=actor)

            # Handle isolated blocks if requested
            isolated_block_ids = []
            if conversation_create.isolated_block_labels:
                isolated_block_ids = await self._create_isolated_blocks(
                    session=session,
                    conversation=conversation,
                    agent_id=agent_id,
                    isolated_block_labels=conversation_create.isolated_block_labels,
                    actor=actor,
                )

            pydantic_conversation = conversation.to_pydantic()
            pydantic_conversation.isolated_block_ids = isolated_block_ids
            return pydantic_conversation

    @enforce_types
    @trace_method
    async def get_conversation_by_id(
        self,
        conversation_id: str,
        actor: PydanticUser,
    ) -> PydanticConversation:
        """Retrieve a conversation by its ID, including in-context message IDs."""
        async with db_registry.async_session() as session:
            conversation = await ConversationModel.read_async(
                db_session=session,
                identifier=conversation_id,
                actor=actor,
                check_is_deleted=True,
            )

            # Get the in-context message IDs for this conversation
            message_ids = await self.get_message_ids_for_conversation(
                conversation_id=conversation_id,
                actor=actor,
            )

            # Build the pydantic model with in_context_message_ids
            pydantic_conversation = conversation.to_pydantic()
            pydantic_conversation.in_context_message_ids = message_ids
            return pydantic_conversation

    @enforce_types
    @trace_method
    async def list_conversations(
        self,
        agent_id: str,
        actor: PydanticUser,
        limit: int = 50,
        after: Optional[str] = None,
    ) -> List[PydanticConversation]:
        """List conversations for an agent with cursor-based pagination."""
        async with db_registry.async_session() as session:
            conversations = await ConversationModel.list_async(
                db_session=session,
                actor=actor,
                agent_id=agent_id,
                limit=limit,
                after=after,
                ascending=False,
            )
            return [conv.to_pydantic() for conv in conversations]

    @enforce_types
    @trace_method
    async def update_conversation(
        self,
        conversation_id: str,
        conversation_update: UpdateConversation,
        actor: PydanticUser,
    ) -> PydanticConversation:
        """Update a conversation."""
        async with db_registry.async_session() as session:
            conversation = await ConversationModel.read_async(
                db_session=session,
                identifier=conversation_id,
                actor=actor,
            )

            # Set attributes on the model
            update_data = conversation_update.model_dump(exclude_none=True)
            for key, value in update_data.items():
                setattr(conversation, key, value)

            # Commit the update
            updated_conversation = await conversation.update_async(
                db_session=session,
                actor=actor,
            )
            return updated_conversation.to_pydantic()

    @enforce_types
    @trace_method
    async def delete_conversation(
        self,
        conversation_id: str,
        actor: PydanticUser,
    ) -> None:
        """Soft delete a conversation and hard-delete its isolated blocks."""
        async with db_registry.async_session() as session:
            conversation = await ConversationModel.read_async(
                db_session=session,
                identifier=conversation_id,
                actor=actor,
            )

            # Get isolated blocks before modifying conversation
            isolated_blocks = list(conversation.isolated_blocks)

            # Soft delete the conversation first
            conversation.is_deleted = True
            await conversation.update_async(db_session=session, actor=actor)

            # Hard-delete isolated blocks (Block model doesn't support soft-delete)
            # Following same pattern as block_manager.delete_block_async
            for block in isolated_blocks:
                # Delete junction table entry first
                await session.execute(delete(BlocksConversations).where(BlocksConversations.block_id == block.id))
                await session.flush()
                # Then hard-delete the block
                await block.hard_delete_async(db_session=session, actor=actor)

    # ==================== Message Management Methods ====================

    @enforce_types
    @trace_method
    async def get_message_ids_for_conversation(
        self,
        conversation_id: str,
        actor: PydanticUser,
    ) -> List[str]:
        """
        Get ordered message IDs for a conversation.

        Returns message IDs ordered by position in the conversation.
        Only returns messages that are currently in_context.
        """
        async with db_registry.async_session() as session:
            query = (
                select(ConversationMessageModel.message_id)
                .where(
                    ConversationMessageModel.conversation_id == conversation_id,
                    ConversationMessageModel.organization_id == actor.organization_id,
                    ConversationMessageModel.in_context == True,
                    ConversationMessageModel.is_deleted == False,
                )
                .order_by(ConversationMessageModel.position)
            )
            result = await session.execute(query)
            return list(result.scalars().all())

    @enforce_types
    @trace_method
    async def get_messages_for_conversation(
        self,
        conversation_id: str,
        actor: PydanticUser,
    ) -> List[PydanticMessage]:
        """
        Get ordered Message objects for a conversation.

        Returns full Message objects ordered by position in the conversation.
        Only returns messages that are currently in_context.
        """
        async with db_registry.async_session() as session:
            query = (
                select(MessageModel)
                .join(
                    ConversationMessageModel,
                    MessageModel.id == ConversationMessageModel.message_id,
                )
                .where(
                    ConversationMessageModel.conversation_id == conversation_id,
                    ConversationMessageModel.organization_id == actor.organization_id,
                    ConversationMessageModel.in_context == True,
                    ConversationMessageModel.is_deleted == False,
                )
                .order_by(ConversationMessageModel.position)
            )
            result = await session.execute(query)
            return [msg.to_pydantic() for msg in result.scalars().all()]

    @enforce_types
    @trace_method
    async def add_messages_to_conversation(
        self,
        conversation_id: str,
        agent_id: str,
        message_ids: List[str],
        actor: PydanticUser,
        starting_position: Optional[int] = None,
    ) -> None:
        """
        Add messages to a conversation's tracking table.

        Creates ConversationMessage entries with auto-incrementing positions.

        Args:
            conversation_id: The conversation to add messages to
            agent_id: The agent ID
            message_ids: List of message IDs to add
            actor: The user performing the action
            starting_position: Optional starting position (defaults to next available)
        """
        if not message_ids:
            return

        async with db_registry.async_session() as session:
            # Get starting position if not provided
            if starting_position is None:
                query = select(func.coalesce(func.max(ConversationMessageModel.position), -1)).where(
                    ConversationMessageModel.conversation_id == conversation_id,
                    ConversationMessageModel.organization_id == actor.organization_id,
                )
                result = await session.execute(query)
                max_position = result.scalar()
                # Use explicit None check instead of `or` to handle position=0 correctly
                if max_position is None:
                    max_position = -1
                starting_position = max_position + 1

            # Create ConversationMessage entries
            for i, message_id in enumerate(message_ids):
                conv_msg = ConversationMessageModel(
                    conversation_id=conversation_id,
                    agent_id=agent_id,
                    message_id=message_id,
                    position=starting_position + i,
                    in_context=True,
                    organization_id=actor.organization_id,
                )
                session.add(conv_msg)

            await session.commit()

    @enforce_types
    @trace_method
    async def update_in_context_messages(
        self,
        conversation_id: str,
        in_context_message_ids: List[str],
        actor: PydanticUser,
    ) -> None:
        """
        Update which messages are in context for a conversation.

        Sets in_context=True for messages in the list, False for others.
        Also updates positions to preserve the order specified in in_context_message_ids.

        This is critical for correctness: when summarization inserts a summary message
        that needs to appear before an approval request, the positions must reflect
        the intended order, not the insertion order.

        Args:
            conversation_id: The conversation to update
            in_context_message_ids: List of message IDs in the desired order
            actor: The user performing the action
        """
        async with db_registry.async_session() as session:
            # Get all conversation messages for this conversation
            query = select(ConversationMessageModel).where(
                ConversationMessageModel.conversation_id == conversation_id,
                ConversationMessageModel.organization_id == actor.organization_id,
                ConversationMessageModel.is_deleted == False,
            )
            result = await session.execute(query)
            conv_messages = result.scalars().all()

            # Build lookup dict
            conv_msg_dict = {cm.message_id: cm for cm in conv_messages}

            # Update in_context status AND positions
            in_context_set = set(in_context_message_ids)
            for conv_msg in conv_messages:
                conv_msg.in_context = conv_msg.message_id in in_context_set

            # Update positions to match the order in in_context_message_ids
            # This ensures ORDER BY position returns messages in the correct order
            for position, message_id in enumerate(in_context_message_ids):
                if message_id in conv_msg_dict:
                    conv_msg_dict[message_id].position = position

            await session.commit()

    @enforce_types
    @trace_method
    async def list_conversation_messages(
        self,
        conversation_id: str,
        actor: PydanticUser,
        limit: Optional[int] = 100,
        before: Optional[str] = None,
        after: Optional[str] = None,
        reverse: bool = False,
        group_id: Optional[str] = None,
        include_err: Optional[bool] = None,
    ) -> List[LettaMessage]:
        """
        List all messages in a conversation with pagination support.

        Unlike get_messages_for_conversation, this returns ALL messages
        (not just in_context) and supports cursor-based pagination.

        Args:
            conversation_id: The conversation to list messages for
            actor: The user performing the action
            limit: Maximum number of messages to return
            before: Return messages before this message ID
            after: Return messages after this message ID
            reverse: If True, return messages in descending order (newest first)
            group_id: Optional group ID to filter messages by
            include_err: Optional boolean to include error messages and error statuses

        Returns:
            List of LettaMessage objects
        """
        async with db_registry.async_session() as session:
            # Build base query joining Message with ConversationMessage
            query = (
                select(MessageModel)
                .join(
                    ConversationMessageModel,
                    MessageModel.id == ConversationMessageModel.message_id,
                )
                .where(
                    ConversationMessageModel.conversation_id == conversation_id,
                    ConversationMessageModel.organization_id == actor.organization_id,
                    ConversationMessageModel.is_deleted == False,
                )
            )

            # Filter by group_id if provided
            if group_id:
                query = query.where(MessageModel.group_id == group_id)

            # Handle cursor-based pagination
            if before:
                # Get the position of the cursor message
                cursor_query = select(ConversationMessageModel.position).where(
                    ConversationMessageModel.conversation_id == conversation_id,
                    ConversationMessageModel.message_id == before,
                )
                cursor_result = await session.execute(cursor_query)
                cursor_position = cursor_result.scalar_one_or_none()
                if cursor_position is not None:
                    query = query.where(ConversationMessageModel.position < cursor_position)

            if after:
                # Get the position of the cursor message
                cursor_query = select(ConversationMessageModel.position).where(
                    ConversationMessageModel.conversation_id == conversation_id,
                    ConversationMessageModel.message_id == after,
                )
                cursor_result = await session.execute(cursor_query)
                cursor_position = cursor_result.scalar_one_or_none()
                if cursor_position is not None:
                    query = query.where(ConversationMessageModel.position > cursor_position)

            # Order by position
            if reverse:
                query = query.order_by(ConversationMessageModel.position.desc())
            else:
                query = query.order_by(ConversationMessageModel.position.asc())

            # Apply limit
            if limit is not None:
                query = query.limit(limit)

            result = await session.execute(query)
            messages = [msg.to_pydantic() for msg in result.scalars().all()]

            # Convert to LettaMessages (reverse=False keeps sub-messages in natural order)
            return PydanticMessage.to_letta_messages_from_list(
                messages, reverse=False, include_err=include_err, text_is_assistant_message=True
            )

    # ==================== Isolated Blocks Methods ====================

    async def _create_isolated_blocks(
        self,
        session,
        conversation: ConversationModel,
        agent_id: str,
        isolated_block_labels: List[str],
        actor: PydanticUser,
    ) -> List[str]:
        """Create conversation-specific copies of blocks for isolated labels.

        Args:
            session: The database session
            conversation: The conversation model (must be created but not yet committed)
            agent_id: The agent ID to get source blocks from
            isolated_block_labels: List of block labels to isolate
            actor: The user performing the action

        Returns:
            List of created block IDs

        Raises:
            LettaInvalidArgumentError: If a block label is not found on the agent
        """
        # Get the agent with its blocks
        agent = await AgentModel.read_async(db_session=session, identifier=agent_id, actor=actor)

        # Map of label -> agent block
        agent_blocks_by_label = {block.label: block for block in agent.core_memory}

        created_block_ids = []
        for label in isolated_block_labels:
            if label not in agent_blocks_by_label:
                raise LettaInvalidArgumentError(
                    f"Block with label '{label}' not found on agent '{agent_id}'",
                    argument_name="isolated_block_labels",
                )

            source_block = agent_blocks_by_label[label]

            # Create a copy of the block with a new ID using Pydantic schema (which auto-generates ID)
            new_block_pydantic = PydanticBlock(
                label=source_block.label,
                description=source_block.description,
                value=source_block.value,
                limit=source_block.limit,
                metadata=source_block.metadata_,
                read_only=source_block.read_only,
            )

            # Convert to ORM model
            block_data = new_block_pydantic.model_dump(to_orm=True, exclude_none=True)
            new_block = BlockModel(**block_data, organization_id=actor.organization_id)
            await new_block.create_async(session, actor=actor)

            # Create the junction table entry
            blocks_conv = BlocksConversations(
                conversation_id=conversation.id,
                block_id=new_block.id,
                block_label=label,
            )
            session.add(blocks_conv)
            created_block_ids.append(new_block.id)

        return created_block_ids

    @enforce_types
    @trace_method
    async def get_isolated_blocks_for_conversation(
        self,
        conversation_id: str,
        actor: PydanticUser,
    ) -> Dict[str, PydanticBlock]:
        """Get isolated blocks for a conversation, keyed by label.

        Args:
            conversation_id: The conversation ID
            actor: The user performing the action

        Returns:
            Dictionary mapping block labels to their conversation-specific blocks
        """
        async with db_registry.async_session() as session:
            conversation = await ConversationModel.read_async(
                db_session=session,
                identifier=conversation_id,
                actor=actor,
                check_is_deleted=True,
            )
            return {block.label: block.to_pydantic() for block in conversation.isolated_blocks}

    @enforce_types
    @trace_method
    async def apply_isolated_blocks_to_agent_state(
        self,
        agent_state: "AgentState",
        conversation_id: str,
        actor: PydanticUser,
    ) -> "AgentState":
        """Apply conversation-specific block overrides to an agent state.

        This method modifies the agent_state.memory to replace blocks that have
        conversation-specific isolated versions.

        Args:
            agent_state: The agent state to modify (will be modified in place)
            conversation_id: The conversation ID to get isolated blocks from
            actor: The user performing the action

        Returns:
            The modified agent state (same object, modified in place)
        """
        from letta.schemas.memory import Memory

        # Get conversation's isolated blocks
        isolated_blocks = await self.get_isolated_blocks_for_conversation(
            conversation_id=conversation_id,
            actor=actor,
        )

        if not isolated_blocks:
            return agent_state

        # Override agent's blocks with conversation-specific blocks
        memory_blocks = []
        for block in agent_state.memory.blocks:
            if block.label in isolated_blocks:
                memory_blocks.append(isolated_blocks[block.label])
            else:
                memory_blocks.append(block)

        # Create new Memory with overridden blocks
        agent_state.memory = Memory(
            blocks=memory_blocks,
            file_blocks=agent_state.memory.file_blocks,
            agent_type=agent_state.memory.agent_type,
        )

        return agent_state
