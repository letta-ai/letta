import json
import uuid
from datetime import datetime
from typing import List, Optional, Sequence, Set, Tuple

from sqlalchemy import delete, exists, func, select, text

from letta.constants import CONVERSATION_SEARCH_TOOL_NAME, DEFAULT_MESSAGE_TOOL, DEFAULT_MESSAGE_TOOL_KWARG
from letta.log import get_logger
from letta.orm.errors import NoResultFound
from letta.orm.message import Message as MessageModel
from letta.otel.tracing import trace_method
from letta.schemas.enums import MessageRole, PrimitiveType
from letta.schemas.letta_message import LettaMessageUpdateUnion
from letta.schemas.letta_message_content import ImageSourceType, LettaImage, MessageContentType, TextContent
from letta.schemas.message import Message as PydanticMessage, MessageSearchResult, MessageUpdate
from letta.schemas.user import User as PydanticUser
from letta.server.db import db_registry
from letta.services.file_manager import FileManager
from letta.services.helpers.agent_manager_helper import validate_agent_exists_async
from letta.settings import DatabaseChoice, settings
from letta.utils import enforce_types, fire_and_forget
from letta.validators import raise_on_invalid_id

logger = get_logger(__name__)


@trace_method
def backfill_missing_tool_call_ids(messages: list, agent_id: Optional[str] = None, actor: Optional[PydanticUser] = None) -> list:
    """Backfill missing tool_call_id values in tool messages from historical bug (oct 1-6, 2025)

    Args:
        messages: List of messages to backfill
        agent_id: Optional agent ID for logging
        actor: Optional actor information for logging

    Returns:
        List of messages with tool_call_ids backfilled where appropriate
    """
    if not messages:
        return messages

    from letta.schemas.message import Message as PydanticMessage

    # Check if messages are ordered chronologically (oldest first)
    # If not, reverse the list to ensure proper chronological order
    was_reversed = False
    if len(messages) > 1:
        first_msg = messages[0]
        last_msg = messages[-1]

        # Only check PydanticMessage objects that have created_at
        if (
            isinstance(first_msg, PydanticMessage)
            and isinstance(last_msg, PydanticMessage)
            and hasattr(first_msg, "created_at")
            and hasattr(last_msg, "created_at")
        ):
            # If first message is newer than last message, list is reversed
            if first_msg.created_at > last_msg.created_at:
                was_reversed = True
                messages.reverse()

    updated_messages = []
    last_tool_call_id = None
    backfilled_count = 0

    for i, message in enumerate(messages):
        if not isinstance(message, PydanticMessage):
            updated_messages.append(message)
            continue

        # check if assistant message has a single tool call to track
        if message.role == MessageRole.assistant and message.tool_calls:
            if len(message.tool_calls) == 1 and message.tool_calls[0].id:
                last_tool_call_id = message.tool_calls[0].id
            else:
                # parallel tool calls or missing id - don't backfill
                last_tool_call_id = None

        # check if tool message needs backfilling
        elif message.role == MessageRole.tool:
            needs_update = False

            # only backfill if we have a single tool return and a preceding tool call id
            if message.tool_returns and len(message.tool_returns) == 1 and last_tool_call_id is not None:
                # check and update message.tool_call_id
                if message.tool_call_id is None:
                    message.tool_call_id = last_tool_call_id
                    needs_update = True

                # check and update tool_return.tool_call_id
                tool_return = message.tool_returns[0]
                if tool_return.tool_call_id is None:
                    tool_return.tool_call_id = last_tool_call_id
                    needs_update = True

                if needs_update:
                    backfilled_count += 1
                    logger.debug(f"Backfilled tool_call_id '{last_tool_call_id}' for message {i} (id={message.id})")

            # clear last_tool_call_id after processing tool message
            last_tool_call_id = None

        updated_messages.append(message)

    # log warning with context if any backfilling occurred
    if backfilled_count > 0:
        actor_info = f"actor_id={actor.id}" if actor else "actor=unknown"
        agent_info = f"agent_id={agent_id}" if agent_id else "agent=unknown"
        logger.warning(
            f"Backfilled {backfilled_count} missing tool_call_ids for historical messages (oct 1-6, 2025 bug) - {agent_info}, {actor_info}"
        )

    if was_reversed:
        updated_messages.reverse()

    return updated_messages


class MessageManager:
    """Manager class to handle business logic related to Messages."""

    def __init__(self):
        """Initialize the MessageManager."""
        self.file_manager = FileManager()

    def _extract_message_text(self, message: PydanticMessage) -> str:
        """Extract text content from a message's complex content structure.

        Only extracts text from searchable message roles (assistant, user, tool).
        Returns JSON format for all message types for consistency.

        Args:
            message: The message to extract text from

        Returns:
            JSON string with message content, or empty string for non-searchable roles
        """
        # only extract text from searchable roles
        if message.role not in [MessageRole.assistant, MessageRole.user, MessageRole.tool]:
            return ""

        # skip tool messages related to send_message and conversation_search entirely
        if message.role == MessageRole.tool and message.name in [DEFAULT_MESSAGE_TOOL, CONVERSATION_SEARCH_TOOL_NAME]:
            return ""

        if not message.content:
            return ""

        # extract raw content text
        if isinstance(message.content, str):
            content_str = message.content
        else:
            text_parts = []
            for content_item in message.content:
                # Try to extract text - prefer .to_text() method, then fall back to attributes
                # .to_text() is the canonical method for getting text representation
                # Falls back to .text or .content attributes if .to_text() returns None
                extracted_text = content_item.to_text()

                if not extracted_text:
                    # Fall back to direct attribute access for types without .to_text() or that return None
                    if hasattr(content_item, "text") and content_item.text:
                        extracted_text = content_item.text
                    elif hasattr(content_item, "content") and content_item.content:
                        extracted_text = content_item.content

                if extracted_text:
                    text_parts.append(extracted_text)
            content_str = " ".join(text_parts)

        # skip heartbeat messages entirely
        try:
            if content_str.strip().startswith("{"):
                parsed_content = json.loads(content_str)
                if isinstance(parsed_content, dict) and parsed_content.get("type") == "heartbeat":
                    return ""
        except (json.JSONDecodeError, ValueError):
            pass

        # format everything as JSON
        if message.role == MessageRole.user:
            # check if content_str is already valid JSON to avoid double nesting
            try:
                # if it's already valid JSON, return as-is
                json.loads(content_str)
                return content_str
            except (json.JSONDecodeError, ValueError):
                # if not valid JSON, wrap it
                return json.dumps({"content": content_str})

        elif message.role == MessageRole.assistant and message.tool_calls:
            # skip assistant messages that call conversation_search
            for tool_call in message.tool_calls:
                if tool_call.function.name == CONVERSATION_SEARCH_TOOL_NAME:
                    return ""

            # check if any tool call is send_message
            for tool_call in message.tool_calls:
                if tool_call.function.name == DEFAULT_MESSAGE_TOOL:
                    # extract the actual message from tool call arguments
                    try:
                        args = json.loads(tool_call.function.arguments)
                        actual_message = args.get(DEFAULT_MESSAGE_TOOL_KWARG, "")

                        return json.dumps({"thinking": content_str, "content": actual_message})
                    except (json.JSONDecodeError, KeyError):
                        # fallback if parsing fails
                        pass

        # default for other messages (tool responses, assistant without send_message)
        # check if content_str is already valid JSON to avoid double nesting
        if message.role == MessageRole.assistant:
            try:
                # if it's already valid JSON, return as-is
                json.loads(content_str)
                return content_str
            except (json.JSONDecodeError, ValueError):
                # if not valid JSON, wrap it
                return json.dumps({"content": content_str})
        else:
            # for tool messages and others, wrap in content
            return json.dumps({"content": content_str})

    def _combine_assistant_tool_messages(self, messages: List[PydanticMessage]) -> List[PydanticMessage]:
        """Combine assistant messages with their corresponding tool results when IDs match.

        Args:
            messages: List of messages to process

        Returns:
            List of messages with assistant+tool combinations merged
        """
        from letta.constants import DEFAULT_MESSAGE_TOOL

        combined_messages = []
        i = 0

        while i < len(messages):
            current_msg = messages[i]

            # skip heartbeat messages
            if self._extract_message_text(current_msg) == "":
                i += 1
                continue

            # if this is an assistant message with tool calls, look for matching tool response
            if current_msg.role == MessageRole.assistant and current_msg.tool_calls and i + 1 < len(messages):
                next_msg = messages[i + 1]

                # check if next message is a tool response that matches
                if (
                    next_msg.role == MessageRole.tool
                    and next_msg.tool_call_id
                    and any(tc.id == next_msg.tool_call_id for tc in current_msg.tool_calls)
                ):
                    # combine the messages - get raw content to avoid double-processing
                    assistant_text = current_msg.content[0].text if current_msg.content else ""

                    # for non-send_message tools, include tool result
                    if next_msg.name != DEFAULT_MESSAGE_TOOL:
                        tool_result_text = next_msg.content[0].text if next_msg.content else ""

                        # get the tool call that matches this result (we know it exists from the condition above)
                        matching_tool_call = next((tc for tc in current_msg.tool_calls if tc.id == next_msg.tool_call_id), None)

                        # format tool call with parameters
                        try:
                            args = json.loads(matching_tool_call.function.arguments)
                            if args:
                                # format parameters nicely
                                param_strs = [f"{k}={repr(v)}" for k, v in args.items()]
                                tool_call_str = f"{matching_tool_call.function.name}({', '.join(param_strs)})"
                            else:
                                tool_call_str = f"{matching_tool_call.function.name}()"
                        except (json.JSONDecodeError, KeyError):
                            tool_call_str = f"{matching_tool_call.function.name}()"

                        # format tool result cleanly
                        try:
                            if tool_result_text.strip().startswith("{"):
                                parsed_result = json.loads(tool_result_text)
                                if isinstance(parsed_result, dict):
                                    # extract key information from tool result
                                    if "message" in parsed_result:
                                        tool_result_summary = parsed_result["message"]
                                    elif "status" in parsed_result:
                                        tool_result_summary = f"Status: {parsed_result['status']}"
                                    else:
                                        tool_result_summary = tool_result_text
                                else:
                                    tool_result_summary = tool_result_text
                            else:
                                tool_result_summary = tool_result_text
                        except (json.JSONDecodeError, ValueError):
                            tool_result_summary = tool_result_text

                        combined_data = {"thinking": assistant_text, "tool_call": tool_call_str, "tool_result": tool_result_summary}
                        combined_text = json.dumps(combined_data)
                    else:
                        combined_text = assistant_text

                    # create a new combined message
                    from letta.schemas.letta_message_content import TextContent

                    combined_message = current_msg.model_copy()
                    combined_message.content = [TextContent(text=combined_text)]
                    combined_messages.append(combined_message)

                    # skip the tool message since we combined it
                    i += 2
                    continue

            # if no combination, add the message as-is
            combined_messages.append(current_msg)
            i += 1

        return combined_messages

    @enforce_types
    @trace_method
    @raise_on_invalid_id(param_name="message_id", expected_prefix=PrimitiveType.MESSAGE)
    async def get_message_by_id_async(self, message_id: str, actor: PydanticUser) -> Optional[PydanticMessage]:
        """Fetch a message by ID."""
        async with db_registry.async_session() as session:
            try:
                message = await MessageModel.read_async(db_session=session, identifier=message_id, actor=actor)
                return message.to_pydantic()
            except NoResultFound:
                return None

    @enforce_types
    @trace_method
    async def get_messages_by_ids_async(self, message_ids: List[str], actor: PydanticUser) -> List[PydanticMessage]:
        """Fetch messages by ID and return them in the requested order. Async version of above function."""
        async with db_registry.async_session() as session:
            results = await MessageModel.read_multiple_async(db_session=session, identifiers=message_ids, actor=actor)
            return self._get_messages_by_id_postprocess(results, message_ids)

    def _get_messages_by_id_postprocess(
        self,
        results: List[MessageModel],
        message_ids: List[str],
    ) -> List[PydanticMessage]:
        if len(results) != len(message_ids):
            logger.warning(
                f"Expected {len(message_ids)} messages, but found {len(results)}. Missing ids={set(message_ids) - set([r.id for r in results])}"
            )
        # Sort results directly based on message_ids
        result_dict = {msg.id: msg.to_pydantic() for msg in results}
        messages = list(filter(lambda x: x is not None, [result_dict.get(msg_id, None) for msg_id in message_ids]))

        # backfill missing tool_call_ids from historical bug (oct 1-6, 2025)
        # Note: we don't have agent_id or actor here, but that's OK for logging
        # TODO: This can cause bugs technically, if we adversarially craft a series of message_ids that are not contiguous
        # TODO: But usually, this is being used by the agent loop code to get the in context messages, which are contiguous
        # TODO: We should remove this as soon as possible, need to inspect for the above log message, if it hasn't happened in a while
        return backfill_missing_tool_call_ids(messages)

    def _create_many_preprocess(self, pydantic_msgs: List[PydanticMessage], actor: PydanticUser) -> List[MessageModel]:
        # Create ORM model instances for all messages
        orm_messages = []
        for pydantic_msg in pydantic_msgs:
            # Set the organization id of the Pydantic message
            msg_data = pydantic_msg.model_dump(to_orm=True)
            msg_data["organization_id"] = actor.organization_id
            orm_messages.append(MessageModel(**msg_data))
        return orm_messages

    @enforce_types
    @trace_method
    async def check_existing_message_ids(self, message_ids: List[str], actor: PydanticUser) -> Set[str]:
        """Check which message IDs already exist in the database.

        Args:
            message_ids: List of message IDs to check
            actor: User performing the action

        Returns:
            Set of message IDs that already exist in the database
        """
        if not message_ids:
            return set()

        async with db_registry.async_session() as session:
            query = select(MessageModel.id).where(MessageModel.id.in_(message_ids), MessageModel.organization_id == actor.organization_id)
            result = await session.execute(query)
            return set(result.scalars().all())

    @enforce_types
    @trace_method
    async def filter_existing_messages(
        self, messages: List[PydanticMessage], actor: PydanticUser
    ) -> Tuple[List[PydanticMessage], List[PydanticMessage]]:
        """Filter messages into new and existing based on their IDs.

        Args:
            messages: List of messages to filter
            actor: User performing the action

        Returns:
            Tuple of (new_messages, existing_messages)
        """
        message_ids = [msg.id for msg in messages if msg.id]
        if not message_ids:
            return messages, []

        existing_ids = await self.check_existing_message_ids(message_ids, actor)

        new_messages = [msg for msg in messages if msg.id not in existing_ids]
        existing_messages = [msg for msg in messages if msg.id in existing_ids]

        return new_messages, existing_messages

    @enforce_types
    @trace_method
    async def create_many_messages_async(
        self,
        pydantic_msgs: List[PydanticMessage],
        actor: PydanticUser,
        run_id: Optional[str] = None,
        strict_mode: bool = False,
        project_id: Optional[str] = None,
        template_id: Optional[str] = None,
        allow_partial: bool = False,
    ) -> List[PydanticMessage]:
        """
        Create multiple messages in a single database transaction asynchronously.

        Args:
            pydantic_msgs: List of Pydantic message models to create
            actor: User performing the action
            strict_mode: If True, wait for embedding to complete; if False, run in background
            project_id: Optional project ID for the messages (for Turbopuffer indexing)
            template_id: Optional template ID for the messages (for Turbopuffer indexing)
            allow_partial: If True, skip messages that already exist; if False, fail on duplicates

        Returns:
            List of created Pydantic message models (and existing ones if allow_partial=True)
        """
        if not pydantic_msgs:
            return []

        messages_to_create = pydantic_msgs
        existing_messages = []

        if allow_partial:
            # filter out messages that already exist
            new_messages, existing_messages = await self.filter_existing_messages(pydantic_msgs, actor)
            messages_to_create = new_messages

            if not messages_to_create:
                # all messages already exist, fetch and return them
                async with db_registry.async_session() as session:
                    existing_ids = [msg.id for msg in existing_messages if msg.id]
                    query = select(MessageModel).where(
                        MessageModel.id.in_(existing_ids), MessageModel.organization_id == actor.organization_id
                    )
                    result = await session.execute(query)
                    return [msg.to_pydantic() for msg in result.scalars()]

        for message in messages_to_create:
            if isinstance(message.content, list):
                for content in message.content:
                    if content.type == MessageContentType.image and content.source.type == ImageSourceType.base64:
                        # TODO: actually persist image files in db
                        # file = await self.file_manager.create_file( # TODO: use batch create to prevent multiple db round trips
                        #     db_session=session,
                        #     image_create=FileMetadata(
                        #         user_id=actor.id, # TODO: add field
                        #         source_id= '' # TODO: make optional
                        #         organization_id=actor.organization_id,
                        #         file_type=content.source.media_type,
                        #         processing_status=FileProcessingStatus.COMPLETED,
                        #         content= '' # TODO: should content be added here or in top level text field?
                        #     ),
                        #     actor=actor,
                        #     text=content.source.data,
                        # )
                        file_id_placeholder = "file-" + str(uuid.uuid4())
                        content.source = LettaImage(
                            file_id=file_id_placeholder,
                            data=content.source.data,
                            media_type=content.source.media_type,
                            detail=content.source.detail,
                        )
        orm_messages = self._create_many_preprocess(messages_to_create, actor)
        async with db_registry.async_session() as session:
            created_messages = await MessageModel.batch_create_async(orm_messages, session, actor=actor, no_commit=True, no_refresh=True)
            result = [msg.to_pydantic() for msg in created_messages]
            await session.commit()

        from letta.helpers.tpuf_client import should_use_tpuf_for_messages

        if should_use_tpuf_for_messages() and result:
            agent_id = result[0].agent_id
            if agent_id:
                if strict_mode:
                    await self._embed_messages_background(result, actor, agent_id, project_id, template_id)
                else:
                    fire_and_forget(
                        self._embed_messages_background(result, actor, agent_id, project_id, template_id),
                        task_name=f"embed_messages_for_agent_{agent_id}",
                    )

        if allow_partial and existing_messages:
            async with db_registry.async_session() as session:
                existing_ids = [msg.id for msg in existing_messages if msg.id]
                query = select(MessageModel).where(MessageModel.id.in_(existing_ids), MessageModel.organization_id == actor.organization_id)
                existing_result = await session.execute(query)
                existing_fetched = [msg.to_pydantic() for msg in existing_result.scalars()]
                result.extend(existing_fetched)

        return result

    async def _embed_messages_background(
        self,
        messages: List[PydanticMessage],
        actor: PydanticUser,
        agent_id: str,
        project_id: Optional[str] = None,
        template_id: Optional[str] = None,
    ) -> None:
        """Background task to embed and store messages in Turbopuffer.

        Args:
            messages: List of messages to embed
            actor: User performing the action
            agent_id: Agent ID for the messages
            project_id: Optional project ID for the messages
            template_id: Optional template ID for the messages
        """
        try:
            from letta.helpers.tpuf_client import TurbopufferClient

            # extract text content from each message
            message_texts = []
            message_ids = []
            roles = []
            created_ats = []

            # combine assistant+tool messages before embedding
            combined_messages = self._combine_assistant_tool_messages(messages)

            for msg in combined_messages:
                text = self._extract_message_text(msg).strip()
                if text:  # only embed messages with text content (role filtering is handled in _extract_message_text)
                    message_texts.append(text)
                    message_ids.append(msg.id)
                    roles.append(msg.role)
                    created_ats.append(msg.created_at)

            if message_texts:
                # insert to turbopuffer - TurbopufferClient will generate embeddings internally
                tpuf_client = TurbopufferClient()
                await tpuf_client.insert_messages(
                    agent_id=agent_id,
                    message_texts=message_texts,
                    message_ids=message_ids,
                    organization_id=actor.organization_id,
                    actor=actor,
                    roles=roles,
                    created_ats=created_ats,
                    project_id=project_id,
                    template_id=template_id,
                )
                logger.info(f"Successfully embedded {len(message_texts)} messages for agent {agent_id}")
        except Exception as e:
            logger.error(f"Failed to embed messages in Turbopuffer for agent {agent_id}: {e}")
            # don't re-raise the exception in background mode - just log it

    @enforce_types
    @trace_method
    async def update_message_by_letta_message_async(
        self, message_id: str, letta_message_update: LettaMessageUpdateUnion, actor: PydanticUser
    ) -> PydanticMessage:
        """
        Updated the underlying messages table giving an update specified to the user-facing LettaMessage
        """
        message = await self.get_message_by_id_async(message_id=message_id, actor=actor)
        if letta_message_update.message_type == "assistant_message":
            # modify the tool call for send_message
            # TODO: fix this if we add parallel tool calls
            # TODO: note this only works if the AssistantMessage is generated by the standard send_message
            assert message.tool_calls[0].function.name == "send_message", (
                f"Expected the first tool call to be send_message, but got {message.tool_calls[0].function.name}"
            )
            original_args = json.loads(message.tool_calls[0].function.arguments)
            original_args["message"] = letta_message_update.content  # override the assistant message
            update_tool_call = message.tool_calls[0].__deepcopy__()
            update_tool_call.function.arguments = json.dumps(original_args)

            update_message = MessageUpdate(tool_calls=[update_tool_call])
        elif letta_message_update.message_type == "reasoning_message":
            update_message = MessageUpdate(content=letta_message_update.reasoning)
        elif letta_message_update.message_type == "user_message" or letta_message_update.message_type == "system_message":
            update_message = MessageUpdate(content=letta_message_update.content)
        else:
            raise ValueError(f"Unsupported message type for modification: {letta_message_update.message_type}")

        message = await self.update_message_by_id_async(message_id=message_id, message_update=update_message, actor=actor)

        # convert back to LettaMessage
        for letta_msg in message.to_letta_messages(use_assistant_message=True):
            if letta_msg.message_type == letta_message_update.message_type:
                return letta_msg

        # raise error if message type got modified
        raise ValueError(f"Message type got modified: {letta_message_update.message_type}")

    @enforce_types
    @trace_method
    async def update_message_by_id_async(
        self,
        message_id: str,
        message_update: MessageUpdate,
        actor: PydanticUser,
        strict_mode: bool = False,
        project_id: Optional[str] = None,
        template_id: Optional[str] = None,
    ) -> PydanticMessage:
        """
        Updates an existing record in the database with values from the provided record object.
        Async version of the function above.

        Args:
            message_id: ID of the message to update
            message_update: Update data for the message
            actor: User performing the action
            strict_mode: If True, wait for embedding update to complete; if False, run in background
            project_id: Optional project ID for the message (for Turbopuffer indexing)
            template_id: Optional template ID for the message (for Turbopuffer indexing)
        """
        async with db_registry.async_session() as session:
            # Fetch existing message from database
            message = await MessageModel.read_async(
                db_session=session,
                identifier=message_id,
                actor=actor,
            )

            message = self._update_message_by_id_impl(message_id, message_update, actor, message)
            await message.update_async(db_session=session, actor=actor, no_commit=True, no_refresh=True)
            pydantic_message = message.to_pydantic()
            await session.commit()

        from letta.helpers.tpuf_client import should_use_tpuf_for_messages

        if should_use_tpuf_for_messages() and pydantic_message.agent_id:
            text = self._extract_message_text(pydantic_message)

            if text:
                if strict_mode:
                    await self._update_message_embedding_background(pydantic_message, text, actor, project_id, template_id)
                else:
                    fire_and_forget(
                        self._update_message_embedding_background(pydantic_message, text, actor, project_id, template_id),
                        task_name=f"update_message_embedding_{message_id}",
                    )

        return pydantic_message

    async def _update_message_embedding_background(
        self, message: PydanticMessage, text: str, actor: PydanticUser, project_id: Optional[str] = None, template_id: Optional[str] = None
    ) -> None:
        """Background task to update a message's embedding in Turbopuffer.

        Args:
            message: The updated message
            text: Extracted text content from the message
            actor: User performing the action
            project_id: Optional project ID for the message
            template_id: Optional template ID for the message
        """
        try:
            from letta.helpers.tpuf_client import TurbopufferClient

            tpuf_client = TurbopufferClient()

            # delete old message from turbopuffer
            await tpuf_client.delete_messages(agent_id=message.agent_id, organization_id=actor.organization_id, message_ids=[message.id])

            # re-insert with updated content - TurbopufferClient will generate embeddings internally
            await tpuf_client.insert_messages(
                agent_id=message.agent_id,
                message_texts=[text],
                message_ids=[message.id],
                organization_id=actor.organization_id,
                actor=actor,
                roles=[message.role],
                created_ats=[message.created_at],
                project_id=project_id,
                template_id=template_id,
            )
            logger.info(f"Successfully updated message {message.id} in Turbopuffer")
        except Exception as e:
            logger.error(f"Failed to update message {message.id} in Turbopuffer: {e}")
            # don't re-raise the exception in background mode - just log it

    def _update_message_by_id_impl(
        self, message_id: str, message_update: MessageUpdate, actor: PydanticUser, message: MessageModel
    ) -> MessageModel:
        """
        Modifies the existing message object to update the database in the sync/async functions.
        """
        # Some safety checks specific to messages
        if message_update.tool_calls and message.role != MessageRole.assistant:
            raise ValueError(
                f"Tool calls {message_update.tool_calls} can only be added to assistant messages. Message {message_id} has role {message.role}."
            )
        if message_update.tool_call_id and message.role != MessageRole.tool:
            raise ValueError(
                f"Tool call IDs {message_update.tool_call_id} can only be added to tool messages. Message {message_id} has role {message.role}."
            )

        # get update dictionary
        update_data = message_update.model_dump(to_orm=True, exclude_unset=True, exclude_none=True)
        # Remove redundant update fields
        update_data = {key: value for key, value in update_data.items() if getattr(message, key) != value}

        for key, value in update_data.items():
            setattr(message, key, value)
        return message

    @enforce_types
    @trace_method
    @raise_on_invalid_id(param_name="message_id", expected_prefix=PrimitiveType.MESSAGE)
    async def delete_message_by_id_async(self, message_id: str, actor: PydanticUser, strict_mode: bool = False) -> bool:
        """Delete a message (async version with turbopuffer support)."""
        # capture agent_id before deletion
        agent_id = None
        async with db_registry.async_session() as session:
            try:
                msg = await MessageModel.read_async(
                    db_session=session,
                    identifier=message_id,
                    actor=actor,
                )
                agent_id = msg.agent_id
                await msg.hard_delete_async(session, actor=actor)
            except NoResultFound:
                raise ValueError(f"Message with id {message_id} not found.")

        from letta.helpers.tpuf_client import TurbopufferClient, should_use_tpuf_for_messages

        if should_use_tpuf_for_messages() and agent_id:
            try:
                tpuf_client = TurbopufferClient()
                await tpuf_client.delete_messages(agent_id=agent_id, organization_id=actor.organization_id, message_ids=[message_id])
                logger.info(f"Successfully deleted message {message_id} from Turbopuffer")
            except Exception as e:
                logger.error(f"Failed to delete message from Turbopuffer: {e}")
                if strict_mode:
                    raise

        return True

    @enforce_types
    @trace_method
    async def size_async(
        self,
        actor: PydanticUser,
        role: Optional[MessageRole] = None,
        agent_id: Optional[str] = None,
    ) -> int:
        """Get the total count of messages with optional filters.
        Args:
            actor: The user requesting the count
            role: The role of the message
        """
        async with db_registry.async_session() as session:
            return await MessageModel.size_async(db_session=session, actor=actor, role=role, agent_id=agent_id)

    @enforce_types
    @trace_method
    async def list_user_messages_for_agent_async(
        self,
        agent_id: str,
        actor: PydanticUser,
        after: Optional[str] = None,
        before: Optional[str] = None,
        query_text: Optional[str] = None,
        limit: Optional[int] = 50,
        ascending: bool = True,
        run_id: Optional[str] = None,
    ) -> List[PydanticMessage]:
        return await self.list_messages(
            agent_id=agent_id,
            actor=actor,
            after=after,
            before=before,
            query_text=query_text,
            roles=[MessageRole.user],
            limit=limit,
            ascending=ascending,
            run_id=run_id,
        )

    @enforce_types
    @trace_method
    async def list_messages(
        self,
        actor: PydanticUser,
        agent_id: Optional[str] = None,
        after: Optional[str] = None,
        before: Optional[str] = None,
        query_text: Optional[str] = None,
        roles: Optional[Sequence[MessageRole]] = None,
        limit: Optional[int] = 50,
        ascending: bool = True,
        group_id: Optional[str] = None,
        include_err: Optional[bool] = None,
        run_id: Optional[str] = None,
    ) -> List[PydanticMessage]:
        """
        Most performant query to list messages by directly querying the Message table.

        This function filters by the agent_id (leveraging the index on messages.agent_id)
        and applies pagination using sequence_id as the cursor.
        If query_text is provided, it will filter messages whose text content partially matches the query.
        If role is provided, it will filter messages by the specified role.

        Args:
            agent_id: The ID of the agent whose messages are queried.
            actor: The user performing the action (used for permission checks).
            after: A message ID; if provided, only messages *after* this message (by sequence_id) are returned.
            before: A message ID; if provided, only messages *before* this message (by sequence_id) are returned.
            query_text: Optional string to partially match the message text content.
            roles: Optional MessageRole to filter messages by role.
            limit: Maximum number of messages to return.
            ascending: If True, sort by sequence_id ascending; if False, sort descending.
            group_id: Optional group ID to filter messages by group_id.
            include_err: Optional boolean to include errors and error statuses. Used for debugging only.
            run_id: Optional run ID to filter messages by run_id.

        Returns:
            List[PydanticMessage]: A list of messages (converted via .to_pydantic()).

        Raises:
            NoResultFound: If the provided after/before message IDs do not exist.
        """

        async with db_registry.async_session() as session:
            # Permission check: raise if the agent doesn't exist or actor is not allowed.

            # Build a query that directly filters the Message table by agent_id.
            query = select(MessageModel)

            if agent_id:
                await validate_agent_exists_async(session, agent_id, actor)
                query = query.where(MessageModel.agent_id == agent_id)

            # If group_id is provided, filter messages by group_id.
            if group_id:
                query = query.where(MessageModel.group_id == group_id)

            if run_id:
                query = query.where(MessageModel.run_id == run_id)

            # if not include_err:
            #    query = query.where((MessageModel.is_err == False) | (MessageModel.is_err.is_(None)))

            # If query_text is provided, filter messages using database-specific JSON search.
            if query_text:
                if settings.database_engine is DatabaseChoice.POSTGRES:
                    # PostgreSQL: Use json_array_elements and ILIKE
                    content_element = func.json_array_elements(MessageModel.content).alias("content_element")
                    query = query.where(
                        exists(
                            select(1)
                            .select_from(content_element)
                            .where(text("content_element->>'type' = 'text' AND content_element->>'text' ILIKE :query_text"))
                            .params(query_text=f"%{query_text}%")
                        )
                    )
                else:
                    # SQLite: Use JSON_EXTRACT with individual array indices for case-insensitive search
                    # Since SQLite doesn't support $[*] syntax, we'll use a different approach
                    query = query.where(text("JSON_EXTRACT(content, '$') LIKE :query_text")).params(query_text=f"%{query_text}%")

            # If role(s) are provided, filter messages by those roles.
            if roles:
                role_values = [r.value for r in roles]
                query = query.where(MessageModel.role.in_(role_values))

            # Apply 'after' pagination if specified.
            if after:
                after_query = select(MessageModel.sequence_id).where(MessageModel.id == after)
                after_result = await session.execute(after_query)
                after_ref = after_result.one_or_none()
                if not after_ref:
                    raise NoResultFound(f"No message found with id '{after}' for agent '{agent_id}'.")
                # Filter out any messages with a sequence_id <= after_ref.sequence_id
                query = query.where(MessageModel.sequence_id > after_ref.sequence_id)

            # Apply 'before' pagination if specified.
            if before:
                before_query = select(MessageModel.sequence_id).where(MessageModel.id == before)
                before_result = await session.execute(before_query)
                before_ref = before_result.one_or_none()
                if not before_ref:
                    raise NoResultFound(f"No message found with id '{before}' for agent '{agent_id}'.")
                # Filter out any messages with a sequence_id >= before_ref.sequence_id
                query = query.where(MessageModel.sequence_id < before_ref.sequence_id)

            # Apply ordering based on the ascending flag.
            if ascending:
                query = query.order_by(MessageModel.sequence_id.asc())
            else:
                query = query.order_by(MessageModel.sequence_id.desc())

            # Limit the number of results.
            query = query.limit(limit)

            # Execute and convert each Message to its Pydantic representation.
            result = await session.execute(query)
            results = result.scalars().all()
            messages = [msg.to_pydantic() for msg in results]

            # backfill missing tool_call_ids from historical bug (oct 1-6, 2025)
            return backfill_missing_tool_call_ids(messages, agent_id=agent_id, actor=actor)

    @enforce_types
    @trace_method
    async def delete_all_messages_for_agent_async(
        self, agent_id: str, actor: PydanticUser, exclude_ids: Optional[List[str]] = None, strict_mode: bool = False
    ) -> int:
        """
        Efficiently deletes all messages associated with a given agent_id,
        while enforcing permission checks and avoiding any ORM‑level loads.
        Optionally excludes specific message IDs from deletion.
        """
        rowcount = 0
        async with db_registry.async_session() as session:
            # 1) verify the agent exists and the actor has access
            await validate_agent_exists_async(session, agent_id, actor)

            # 2) issue a CORE DELETE against the mapped class
            stmt = (
                delete(MessageModel).where(MessageModel.agent_id == agent_id).where(MessageModel.organization_id == actor.organization_id)
            )

            # 3) exclude specific message IDs if provided
            if exclude_ids:
                stmt = stmt.where(~MessageModel.id.in_(exclude_ids))

            result = await session.execute(stmt)
            rowcount = result.rowcount

            # 4) commit once
            await session.commit()

        # 5) delete from turbopuffer if enabled (outside of DB session)
        from letta.helpers.tpuf_client import TurbopufferClient, should_use_tpuf_for_messages

        if should_use_tpuf_for_messages():
            try:
                tpuf_client = TurbopufferClient()
                if exclude_ids:
                    logger.warning(f"Turbopuffer deletion with exclude_ids not fully supported, using delete_all for agent {agent_id}")
                await tpuf_client.delete_all_messages(agent_id, actor.organization_id)
                logger.info(f"Successfully deleted all messages for agent {agent_id} from Turbopuffer")
            except Exception as e:
                logger.error(f"Failed to delete messages from Turbopuffer: {e}")
                if strict_mode:
                    raise

        # 6) return the number of rows deleted
        return rowcount

    @enforce_types
    @trace_method
    async def delete_messages_by_ids_async(self, message_ids: List[str], actor: PydanticUser, strict_mode: bool = False) -> int:
        """
        Efficiently deletes messages by their specific IDs,
        while enforcing permission checks.
        """
        if not message_ids:
            return 0

        agent_ids = []
        rowcount = 0

        from letta.helpers.tpuf_client import TurbopufferClient, should_use_tpuf_for_messages

        async with db_registry.async_session() as session:
            if should_use_tpuf_for_messages():
                agent_query = (
                    select(MessageModel.agent_id)
                    .where(MessageModel.id.in_(message_ids))
                    .where(MessageModel.organization_id == actor.organization_id)
                    .distinct()
                )
                agent_result = await session.execute(agent_query)
                agent_ids = [row[0] for row in agent_result.fetchall() if row[0]]

            # issue a CORE DELETE against the mapped class for specific message IDs
            stmt = delete(MessageModel).where(MessageModel.id.in_(message_ids)).where(MessageModel.organization_id == actor.organization_id)
            result = await session.execute(stmt)
            rowcount = result.rowcount

            # commit once
            await session.commit()

        if should_use_tpuf_for_messages() and agent_ids:
            try:
                tpuf_client = TurbopufferClient()
                for agent_id in agent_ids:
                    await tpuf_client.delete_messages(agent_id=agent_id, organization_id=actor.organization_id, message_ids=message_ids)
                logger.info(f"Successfully deleted {len(message_ids)} messages from Turbopuffer")
            except Exception as e:
                logger.error(f"Failed to delete messages from Turbopuffer: {e}")
                if strict_mode:
                    raise

        return rowcount

    @enforce_types
    @trace_method
    async def search_messages_async(
        self,
        agent_id: str,
        actor: PydanticUser,
        query_text: Optional[str] = None,
        search_mode: str = "hybrid",
        roles: Optional[List[MessageRole]] = None,
        project_id: Optional[str] = None,
        template_id: Optional[str] = None,
        limit: int = 50,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> List[Tuple[PydanticMessage, dict]]:
        """
        Search messages using Turbopuffer if enabled, otherwise fall back to SQL search.

        Args:
            agent_id: ID of the agent whose messages to search
            actor: User performing the search
            query_text: Text query (used for embedding in vector/hybrid modes, and FTS in fts/hybrid modes)
            search_mode: "vector", "fts", "hybrid", or "timestamp" (default: "hybrid")
            roles: Optional list of message roles to filter by
            project_id: Optional project ID to filter messages by
            template_id: Optional template ID to filter messages by
            limit: Maximum number of results to return
            start_date: Optional filter for messages created after this date
            end_date: Optional filter for messages created on or before this date (inclusive)

        Returns:
            List of tuples (message, metadata) where metadata contains relevance scores
        """
        from letta.helpers.tpuf_client import TurbopufferClient, should_use_tpuf_for_messages

        # check if we should use turbopuffer
        if should_use_tpuf_for_messages():
            try:
                # use turbopuffer for search - TurbopufferClient will generate embeddings internally
                tpuf_client = TurbopufferClient()
                results = await tpuf_client.query_messages_by_agent_id(
                    agent_id=agent_id,
                    organization_id=actor.organization_id,
                    actor=actor,
                    query_text=query_text,
                    search_mode=search_mode,
                    top_k=limit,
                    roles=roles,
                    project_id=project_id,
                    template_id=template_id,
                    start_date=start_date,
                    end_date=end_date,
                )

                # create message-like objects using turbopuffer data (which already has properly extracted text)
                if results:
                    # create simplified message objects from turbopuffer data
                    from letta.schemas.letta_message_content import TextContent
                    from letta.schemas.message import Message as PydanticMessage

                    message_tuples = []
                    for msg_dict, score, metadata in results:
                        # create a message object with the properly extracted text from turbopuffer
                        message = PydanticMessage(
                            id=msg_dict["id"],
                            agent_id=agent_id,
                            role=MessageRole(msg_dict["role"]),
                            content=[TextContent(text=msg_dict["text"])],
                            created_at=msg_dict["created_at"],
                            updated_at=msg_dict["created_at"],  # use created_at as fallback
                            created_by_id=actor.id,
                            last_updated_by_id=actor.id,
                        )
                        # Return tuple of (message, metadata)
                        message_tuples.append((message, metadata))

                    return message_tuples
                else:
                    return []

            except Exception as e:
                logger.error(f"Failed to search messages with Turbopuffer, falling back to SQL: {e}")
                # fall back to SQL search
                messages = await self.list_messages(
                    agent_id=agent_id,
                    actor=actor,
                    query_text=query_text,
                    roles=roles,
                    limit=limit,
                    ascending=False,
                )
                combined_messages = self._combine_assistant_tool_messages(messages)
                # Add basic metadata for SQL fallback
                message_tuples = []
                for message in combined_messages:
                    metadata = {
                        "search_mode": "sql_fallback",
                        "combined_score": None,  # SQL doesn't provide scores
                    }
                    message_tuples.append((message, metadata))
                return message_tuples
        else:
            # use sql-based search
            messages = await self.list_messages(
                agent_id=agent_id,
                actor=actor,
                query_text=query_text,
                roles=roles,
                limit=limit,
                ascending=False,
            )
            combined_messages = self._combine_assistant_tool_messages(messages)
            # Add basic metadata for SQL search
            message_tuples = []
            for message in combined_messages:
                metadata = {
                    "search_mode": "sql",
                    "combined_score": None,  # SQL doesn't provide scores
                }
                message_tuples.append((message, metadata))
            return message_tuples

    async def search_messages_org_async(
        self,
        actor: PydanticUser,
        query_text: Optional[str] = None,
        search_mode: str = "hybrid",
        roles: Optional[List[MessageRole]] = None,
        project_id: Optional[str] = None,
        template_id: Optional[str] = None,
        limit: int = 50,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> List[MessageSearchResult]:
        """
        Search messages across entire organization using Turbopuffer.

        Args:
            actor: User performing the search (must have org access)
            query_text: Text query for full-text search
            search_mode: "vector", "fts", or "hybrid" (default: "hybrid")
            roles: Optional list of message roles to filter by
            project_id: Optional project ID to filter messages by
            template_id: Optional template ID to filter messages by
            limit: Maximum number of results to return
            start_date: Optional filter for messages created after this date
            end_date: Optional filter for messages created on or before this date (inclusive)

        Returns:
            List of MessageSearchResult objects with scoring details

        Raises:
            ValueError: If message embedding or Turbopuffer is not enabled
        """
        from letta.helpers.tpuf_client import TurbopufferClient, should_use_tpuf_for_messages

        # check if turbopuffer is enabled
        # TODO: extend to non-Turbopuffer in the future.
        if not should_use_tpuf_for_messages():
            raise ValueError("Message search requires message embedding, OpenAI, and Turbopuffer to be enabled.")

        # use turbopuffer for search - TurbopufferClient will generate embeddings internally
        tpuf_client = TurbopufferClient()
        results = await tpuf_client.query_messages_by_org_id(
            organization_id=actor.organization_id,
            actor=actor,
            query_text=query_text,
            search_mode=search_mode,
            top_k=limit,
            roles=roles,
            project_id=project_id,
            template_id=template_id,
            start_date=start_date,
            end_date=end_date,
        )

        # convert results to MessageSearchResult objects
        if not results:
            return []

        # create message mapping
        message_ids = []
        embedded_text = {}
        for msg_dict, _, _ in results:
            message_ids.append(msg_dict["id"])
            embedded_text[msg_dict["id"]] = msg_dict["text"]
        messages = await self.get_messages_by_ids_async(message_ids=message_ids, actor=actor)
        message_mapping = {message.id: message for message in messages}

        # create search results using list comprehension
        return [
            MessageSearchResult(
                embedded_text=embedded_text[msg_id],
                message=message_mapping[msg_id],
                fts_rank=metadata.get("fts_rank"),
                vector_rank=metadata.get("vector_rank"),
                rrf_score=rrf_score,
            )
            for msg_dict, rrf_score, metadata in results
            if (msg_id := msg_dict.get("id")) in message_mapping
        ]
