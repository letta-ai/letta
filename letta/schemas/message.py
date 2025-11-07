from __future__ import annotations

from letta.log import get_logger

logger = get_logger(__name__)

import copy
import json
import re
import uuid
from collections import OrderedDict
from datetime import datetime, timezone
from enum import Enum
from typing import Annotated, Any, Dict, List, Literal, Optional, Union

from openai.types.chat.chat_completion_message_tool_call import ChatCompletionMessageToolCall as OpenAIToolCall, Function as OpenAIFunction
from openai.types.responses import ResponseReasoningItem
from pydantic import BaseModel, Field, field_validator, model_validator

from letta.constants import DEFAULT_MESSAGE_TOOL, DEFAULT_MESSAGE_TOOL_KWARG, REQUEST_HEARTBEAT_PARAM, TOOL_CALL_ID_MAX_LEN
from letta.helpers.datetime_helpers import get_utc_time, is_utc_datetime
from letta.helpers.json_helpers import json_dumps
from letta.local_llm.constants import INNER_THOUGHTS_KWARG, INNER_THOUGHTS_KWARG_VERTEX
from letta.schemas.enums import MessageRole, PrimitiveType
from letta.schemas.letta_base import OrmMetadataBase
from letta.schemas.letta_message import (
    ApprovalRequestMessage,
    ApprovalResponseMessage,
    ApprovalReturn,
    AssistantMessage,
    HiddenReasoningMessage,
    LettaMessage,
    LettaMessageReturnUnion,
    MessageType,
    ReasoningMessage,
    SystemMessage,
    ToolCall,
    ToolCallMessage,
    ToolReturn as LettaToolReturn,
    ToolReturnMessage,
    UserMessage,
)
from letta.schemas.letta_message_content import (
    ImageContent,
    LettaMessageContentUnion,
    OmittedReasoningContent,
    ReasoningContent,
    RedactedReasoningContent,
    SummarizedReasoningContent,
    TextContent,
    ToolCallContent,
    ToolReturnContent,
    get_letta_message_content_union_str_json_schema,
)
from letta.system import unpack_message
from letta.utils import parse_json, validate_function_response


def truncate_tool_return(content: Optional[str], limit: Optional[int]) -> Optional[str]:
    if limit is None or content is None:
        return content
    if len(content) <= limit:
        return content
    return content[:limit] + f"... [truncated {len(content) - limit} chars]"


def add_inner_thoughts_to_tool_call(
    tool_call: OpenAIToolCall,
    inner_thoughts: str,
    inner_thoughts_key: str,
) -> OpenAIToolCall:
    """Add inner thoughts (arg + value) to a tool call"""
    try:
        # load the args list
        func_args = parse_json(tool_call.function.arguments)
        # create new ordered dict with inner thoughts first
        ordered_args = OrderedDict({inner_thoughts_key: inner_thoughts})
        # update with remaining args
        ordered_args.update(func_args)
        # create the updated tool call (as a string)
        updated_tool_call = copy.deepcopy(tool_call)
        updated_tool_call.function.arguments = json_dumps(ordered_args)
        return updated_tool_call
    except json.JSONDecodeError as e:
        logger.warning(f"Failed to put inner thoughts in kwargs: {e}")
        raise e


class MessageCreateType(str, Enum):
    message = "message"
    approval = "approval"


class MessageCreateBase(BaseModel):
    type: MessageCreateType = Field(..., description="The message type to be created.")


class MessageCreate(MessageCreateBase):
    """Request to create a message"""

    type: Optional[Literal[MessageCreateType.message]] = Field(
        default=MessageCreateType.message, description="The message type to be created."
    )
    # In the simplified format, only allow simple roles
    role: Literal[
        MessageRole.user,
        MessageRole.system,
        MessageRole.assistant,
    ] = Field(..., description="The role of the participant.")
    content: Union[str, List[LettaMessageContentUnion]] = Field(
        ...,
        description="The content of the message.",
        json_schema_extra=get_letta_message_content_union_str_json_schema(),
    )
    name: Optional[str] = Field(default=None, description="The name of the participant.")
    otid: Optional[str] = Field(default=None, description="The offline threading id associated with this message")
    sender_id: Optional[str] = Field(default=None, description="The id of the sender of the message, can be an identity id or agent id")
    batch_item_id: Optional[str] = Field(default=None, description="The id of the LLMBatchItem that this message is associated with")
    group_id: Optional[str] = Field(default=None, description="The multi-agent group that the message was sent in")

    def model_dump(self, to_orm: bool = False, **kwargs) -> Dict[str, Any]:
        data = super().model_dump(**kwargs)
        if to_orm and "content" in data:
            if isinstance(data["content"], str):
                data["content"] = [TextContent(text=data["content"])]
        return data


class ApprovalCreate(MessageCreateBase):
    """Input to approve or deny a tool call request"""

    type: Literal[MessageCreateType.approval] = Field(default=MessageCreateType.approval, description="The message type to be created.")
    approvals: Optional[List[LettaMessageReturnUnion]] = Field(default=None, description="The list of approval responses")
    approve: Optional[bool] = Field(None, description="Whether the tool has been approved", deprecated=True)
    approval_request_id: Optional[str] = Field(None, description="The message ID of the approval request", deprecated=True)
    reason: Optional[str] = Field(None, description="An optional explanation for the provided approval status", deprecated=True)
    group_id: Optional[str] = Field(default=None, description="The multi-agent group that the message was sent in")

    @model_validator(mode="after")
    def migrate_deprecated_fields(self):
        if not self.approvals and self.approve is not None and self.approval_request_id is not None:
            self.approvals = [
                ApprovalReturn(
                    tool_call_id=self.approval_request_id,
                    approve=self.approve,
                    reason=self.reason,
                )
            ]
        return self


MessageCreateUnion = Union[MessageCreate, ApprovalCreate]


class MessageUpdate(BaseModel):
    """Request to update a message"""

    role: Optional[MessageRole] = Field(default=None, description="The role of the participant.")
    content: Optional[Union[str, List[LettaMessageContentUnion]]] = Field(
        default=None,
        description="The content of the message.",
        json_schema_extra=get_letta_message_content_union_str_json_schema(),
    )
    # NOTE: probably doesn't make sense to allow remapping user_id or agent_id (vs creating a new message)
    # user_id: Optional[str] = Field(None, description="The unique identifier of the user.")
    # agent_id: Optional[str] = Field(None, description="The unique identifier of the agent.")
    # NOTE: we probably shouldn't allow updating the model field, otherwise this loses meaning
    # model: Optional[str] = Field(None, description="The model used to make the function call.")
    name: Optional[str] = Field(default=None, description="The name of the participant.")
    # NOTE: we probably shouldn't allow updating the created_at field, right?
    # created_at: Optional[datetime] = Field(None, description="The time the message was created.")
    tool_calls: Optional[List[OpenAIToolCall,]] = Field(default=None, description="The list of tool calls requested.")
    tool_call_id: Optional[str] = Field(default=None, description="The id of the tool call.")

    def model_dump(self, to_orm: bool = False, **kwargs) -> Dict[str, Any]:
        data = super().model_dump(**kwargs)
        if to_orm and "content" in data:
            if isinstance(data["content"], str):
                data["content"] = [TextContent(text=data["content"])]
        return data


class BaseMessage(OrmMetadataBase):
    __id_prefix__ = PrimitiveType.MESSAGE.value


class Message(BaseMessage):
    """
        Letta's internal representation of a message. Includes methods to convert to/from LLM provider formats.

        Attributes:
            id (str): The unique identifier of the message.
            role (MessageRole): The role of the participant.
            text (str): The text of the message.
            user_id (str): The unique identifier of the user.
            agent_id (str): The unique identifier of the agent.
            model (str): The model used to make the function call.
            name (str): The name of the participant.
            created_at (datetime): The time the message was created.
            tool_calls (List[OpenAIToolCall,]): The list of tool calls requested.
            tool_call_id (str): The id of the tool call.
            step_id (str): The id of the step that this message was created in.
            otid (str): The offline threading id associated with this message.
            tool_returns (List[ToolReturn]): The list of tool returns requested.
            group_id (str): The multi-agent group that the message was sent in.
            sender_id (str): The id of the sender of the message, can be an identity id or agent id.
    t
    """

    id: str = BaseMessage.generate_id_field()
    agent_id: Optional[str] = Field(default=None, description="The unique identifier of the agent.")
    model: Optional[str] = Field(default=None, description="The model used to make the function call.")
    # Basic OpenAI-style fields
    role: MessageRole = Field(..., description="The role of the participant.")
    content: Optional[List[LettaMessageContentUnion]] = Field(default=None, description="The content of the message.")
    # NOTE: in OpenAI, this field is only used for roles 'user', 'assistant', and 'function' (now deprecated). 'tool' does not use it.
    name: Optional[str] = Field(
        default=None,
        description="For role user/assistant: the (optional) name of the participant. For role tool/function: the name of the function called.",
    )
    tool_calls: Optional[List[OpenAIToolCall]] = Field(
        default=None, description="The list of tool calls requested. Only applicable for role assistant."
    )
    tool_call_id: Optional[str] = Field(default=None, description="The ID of the tool call. Only applicable for role tool.")
    # Extras
    step_id: Optional[str] = Field(default=None, description="The id of the step that this message was created in.")
    run_id: Optional[str] = Field(default=None, description="The id of the run that this message was created in.")
    otid: Optional[str] = Field(default=None, description="The offline threading id associated with this message")
    tool_returns: Optional[List[ToolReturn]] = Field(default=None, description="Tool execution return information for prior tool calls")
    group_id: Optional[str] = Field(default=None, description="The multi-agent group that the message was sent in")
    sender_id: Optional[str] = Field(default=None, description="The id of the sender of the message, can be an identity id or agent id")
    batch_item_id: Optional[str] = Field(default=None, description="The id of the LLMBatchItem that this message is associated with")
    is_err: Optional[bool] = Field(
        default=None, description="Whether this message is part of an error step. Used only for debugging purposes."
    )
    approval_request_id: Optional[str] = Field(
        default=None, description="The id of the approval request if this message is associated with a tool call request."
    )
    approve: Optional[bool] = Field(default=None, description="Whether tool call is approved.")
    denial_reason: Optional[str] = Field(default=None, description="The reason the tool call request was denied.")
    approvals: Optional[List[ApprovalReturn | ToolReturn]] = Field(default=None, description="The list of approvals for this message.")
    # This overrides the optional base orm schema, created_at MUST exist on all messages objects
    created_at: datetime = Field(default_factory=get_utc_time, description="The timestamp when the object was created.")

    # validate that run_id is set
    # @model_validator(mode="after")
    # def validate_run_id(self):
    #    if self.run_id is None:
    #        raise ValueError("Run ID is required")
    #    return self

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        roles = ["system", "assistant", "user", "tool", "approval"]
        assert v in roles, f"Role must be one of {roles}"
        return v

    def to_json(self):
        json_message = vars(self)
        if json_message["tool_calls"] is not None:
            json_message["tool_calls"] = [vars(tc) for tc in json_message["tool_calls"]]
        # turn datetime to ISO format
        # also if the created_at is missing a timezone, add UTC
        if not is_utc_datetime(self.created_at):
            self.created_at = self.created_at.replace(tzinfo=timezone.utc)
        json_message["created_at"] = self.created_at.isoformat()
        json_message.pop("is_err", None)  # make sure we don't include this debugging information
        return json_message

    @staticmethod
    def generate_otid():
        return str(uuid.uuid4())

    @staticmethod
    def to_letta_messages_from_list(
        messages: List[Message],
        use_assistant_message: bool = True,
        assistant_message_tool_name: str = DEFAULT_MESSAGE_TOOL,
        assistant_message_tool_kwarg: str = DEFAULT_MESSAGE_TOOL_KWARG,
        reverse: bool = True,
        include_err: Optional[bool] = None,
        text_is_assistant_message: bool = False,
    ) -> List[LettaMessage]:
        if use_assistant_message:
            message_ids_to_remove = []
            assistant_messages_by_tool_call = {
                tool_call.id: msg
                for msg in messages
                if msg.role == MessageRole.assistant and msg.tool_calls
                for tool_call in msg.tool_calls
            }
            for message in messages:
                if (
                    message.role == MessageRole.tool
                    and message.tool_call_id in assistant_messages_by_tool_call
                    and assistant_messages_by_tool_call[message.tool_call_id].tool_calls
                    and assistant_message_tool_name
                    in [tool_call.function.name for tool_call in assistant_messages_by_tool_call[message.tool_call_id].tool_calls]
                ):
                    message_ids_to_remove.append(message.id)

            messages = [msg for msg in messages if msg.id not in message_ids_to_remove]

        # Convert messages to LettaMessages
        return [
            msg
            for m in messages
            for msg in m.to_letta_messages(
                use_assistant_message=use_assistant_message,
                assistant_message_tool_name=assistant_message_tool_name,
                assistant_message_tool_kwarg=assistant_message_tool_kwarg,
                reverse=reverse,
                include_err=include_err,
                text_is_assistant_message=text_is_assistant_message,
            )
        ]

    def to_letta_messages(
        self,
        use_assistant_message: bool = False,
        assistant_message_tool_name: str = DEFAULT_MESSAGE_TOOL,
        assistant_message_tool_kwarg: str = DEFAULT_MESSAGE_TOOL_KWARG,
        reverse: bool = True,
        include_err: Optional[bool] = None,
        text_is_assistant_message: bool = False,
    ) -> List[LettaMessage]:
        """Convert message object (in DB format) to the style used by the original Letta API"""

        messages = []
        if self.role == MessageRole.assistant:
            if self.content:
                messages.extend(self._convert_reasoning_messages(text_is_assistant_message=text_is_assistant_message))

            if self.tool_calls is not None:
                messages.extend(
                    self._convert_tool_call_messages(
                        current_message_count=len(messages),
                        use_assistant_message=use_assistant_message,
                        assistant_message_tool_name=assistant_message_tool_name,
                        assistant_message_tool_kwarg=assistant_message_tool_kwarg,
                    ),
                )
        elif self.role == MessageRole.tool:
            messages.append(self._convert_tool_return_message())
        elif self.role == MessageRole.user:
            messages.append(self._convert_user_message())
        elif self.role == MessageRole.system:
            messages.append(self._convert_system_message())
        elif self.role == MessageRole.approval:
            if self.content:
                messages.extend(self._convert_reasoning_messages(text_is_assistant_message=text_is_assistant_message))
            if self.tool_calls is not None:
                messages.append(self._convert_approval_request_message())
            else:
                if self.approvals:
                    first_approval = [a for a in self.approvals if isinstance(a, ApprovalReturn)]

                    def maybe_convert_tool_return_message(maybe_tool_return):
                        if isinstance(maybe_tool_return, ToolReturn):
                            parsed_data = self._parse_tool_response(maybe_tool_return.func_response)
                            return LettaToolReturn(
                                tool_call_id=maybe_tool_return.tool_call_id,
                                status=maybe_tool_return.status,
                                tool_return=parsed_data["message"],
                                stdout=maybe_tool_return.stdout,
                                stderr=maybe_tool_return.stderr,
                            )
                        return maybe_tool_return

                    approval_response_message = ApprovalResponseMessage(
                        id=self.id,
                        date=self.created_at,
                        otid=self.otid,
                        approvals=[maybe_convert_tool_return_message(approval) for approval in self.approvals],
                        run_id=self.run_id,
                        # TODO: temporary populate these fields for backwards compatibility
                        approve=first_approval[0].approve if first_approval else None,
                        approval_request_id=first_approval[0].tool_call_id if first_approval else None,
                        reason=first_approval[0].reason if first_approval else None,
                    )
                else:
                    approval_response_message = ApprovalResponseMessage(
                        id=self.id,
                        date=self.created_at,
                        otid=self.otid,
                        approve=self.approve,
                        approval_request_id=self.approval_request_id,
                        reason=self.denial_reason,
                        approvals=[
                            # TODO: temporary workaround to populate from legacy fields
                            ApprovalReturn(
                                tool_call_id=self.approval_request_id,
                                approve=self.approve,
                                reason=self.denial_reason,
                            )
                        ],
                        run_id=self.run_id,
                    )
                messages.append(approval_response_message)
        else:
            raise ValueError(f"Unknown role: {self.role}")

        return messages[::-1] if reverse else messages

    def _convert_reasoning_messages(
        self,
        current_message_count: int = 0,
        text_is_assistant_message: bool = False,  # For v3 loop, set to True
    ) -> List[LettaMessage]:
        messages = []

        for content_part in self.content:
            otid = Message.generate_otid_from_id(self.id, current_message_count + len(messages))

            if isinstance(content_part, TextContent):
                if text_is_assistant_message:
                    # .content is assistant message
                    if messages and messages[-1].message_type == MessageType.assistant_message:
                        messages[-1].content += content_part.text
                    else:
                        messages.append(
                            AssistantMessage(
                                id=self.id,
                                date=self.created_at,
                                content=content_part.text,
                                name=self.name,
                                otid=otid,
                                sender_id=self.sender_id,
                                step_id=self.step_id,
                                is_err=self.is_err,
                                run_id=self.run_id,
                            )
                        )
                else:
                    # .content is COT
                    messages.append(
                        ReasoningMessage(
                            id=self.id,
                            date=self.created_at,
                            reasoning=content_part.text,
                            name=self.name,
                            otid=otid,
                            sender_id=self.sender_id,
                            step_id=self.step_id,
                            is_err=self.is_err,
                            run_id=self.run_id,
                        )
                    )

            elif isinstance(content_part, ReasoningContent):
                # "native" COT
                if messages and messages[-1].message_type == MessageType.reasoning_message:
                    messages[-1].reasoning += content_part.reasoning
                else:
                    messages.append(
                        ReasoningMessage(
                            id=self.id,
                            date=self.created_at,
                            reasoning=content_part.reasoning,
                            source="reasoner_model",  # TODO do we want to tag like this?
                            signature=content_part.signature,
                            name=self.name,
                            otid=otid,
                            step_id=self.step_id,
                            is_err=self.is_err,
                            run_id=self.run_id,
                        )
                    )

            elif isinstance(content_part, SummarizedReasoningContent):
                # TODO remove the cast and just return the native type
                casted_content_part = content_part.to_reasoning_content()
                if casted_content_part is not None:
                    messages.append(
                        ReasoningMessage(
                            id=self.id,
                            date=self.created_at,
                            reasoning=casted_content_part.reasoning,
                            source="reasoner_model",  # TODO do we want to tag like this?
                            signature=casted_content_part.signature,
                            name=self.name,
                            otid=otid,
                            step_id=self.step_id,
                            is_err=self.is_err,
                            run_id=self.run_id,
                        )
                    )

            elif isinstance(content_part, RedactedReasoningContent):
                # "native" redacted/hidden COT
                messages.append(
                    HiddenReasoningMessage(
                        id=self.id,
                        date=self.created_at,
                        state="redacted",
                        hidden_reasoning=content_part.data,
                        name=self.name,
                        otid=otid,
                        sender_id=self.sender_id,
                        step_id=self.step_id,
                        is_err=self.is_err,
                        run_id=self.run_id,
                    )
                )

            elif isinstance(content_part, OmittedReasoningContent):
                # Special case for "hidden reasoning" models like o1/o3
                # NOTE: we also have to think about how to return this during streaming
                messages.append(
                    HiddenReasoningMessage(
                        id=self.id,
                        date=self.created_at,
                        state="omitted",
                        name=self.name,
                        otid=otid,
                        step_id=self.step_id,
                        is_err=self.is_err,
                        run_id=self.run_id,
                    )
                )

            else:
                logger.warning(f"Unrecognized content part in assistant message: {content_part}")

        return messages

    def _convert_assistant_message(
        self,
    ) -> AssistantMessage:
        if self.content and len(self.content) == 1 and isinstance(self.content[0], TextContent):
            text_content = self.content[0].text
        else:
            raise ValueError(f"Invalid assistant message (no text object on message): {self.content}")

        return AssistantMessage(
            id=self.id,
            date=self.created_at,
            content=text_content,
            name=self.name,
            otid=self.otid,
            sender_id=self.sender_id,
            step_id=self.step_id,
            # is_err=self.is_err,
            run_id=self.run_id,
        )

    def _convert_tool_call_messages(
        self,
        current_message_count: int = 0,
        use_assistant_message: bool = False,
        assistant_message_tool_name: str = DEFAULT_MESSAGE_TOOL,
        assistant_message_tool_kwarg: str = DEFAULT_MESSAGE_TOOL_KWARG,
    ) -> List[LettaMessage]:
        messages = []

        # If assistant mode is off, just create one ToolCallMessage with all tool calls
        if not use_assistant_message:
            all_tool_call_objs = [
                ToolCall(
                    name=tool_call.function.name,
                    arguments=tool_call.function.arguments,
                    tool_call_id=tool_call.id,
                )
                for tool_call in self.tool_calls
            ]

            if all_tool_call_objs:
                otid = Message.generate_otid_from_id(self.id, current_message_count)
                messages.append(
                    ToolCallMessage(
                        id=self.id,
                        date=self.created_at,
                        # use first tool call for the deprecated field
                        tool_call=all_tool_call_objs[0],
                        tool_calls=all_tool_call_objs,
                        name=self.name,
                        otid=otid,
                        sender_id=self.sender_id,
                        step_id=self.step_id,
                        is_err=self.is_err,
                        run_id=self.run_id,
                    )
                )
            return messages

        collected_tool_calls = []

        for tool_call in self.tool_calls:
            otid = Message.generate_otid_from_id(self.id, current_message_count + len(messages))

            if tool_call.function.name == assistant_message_tool_name:
                if collected_tool_calls:
                    tool_call_message = ToolCallMessage(
                        id=self.id,
                        date=self.created_at,
                        # use first tool call for the deprecated field
                        tool_call=collected_tool_calls[0],
                        tool_calls=collected_tool_calls.copy(),
                        name=self.name,
                        otid=Message.generate_otid_from_id(self.id, current_message_count + len(messages)),
                        sender_id=self.sender_id,
                        step_id=self.step_id,
                        is_err=self.is_err,
                        run_id=self.run_id,
                    )
                    messages.append(tool_call_message)
                    collected_tool_calls = []  # reset the collection

                try:
                    func_args = parse_json(tool_call.function.arguments)
                    message_string = validate_function_response(func_args[assistant_message_tool_kwarg], 0, truncate=False)
                except KeyError:
                    raise ValueError(f"Function call {tool_call.function.name} missing {assistant_message_tool_kwarg} argument")
                messages.append(
                    AssistantMessage(
                        id=self.id,
                        date=self.created_at,
                        content=message_string,
                        name=self.name,
                        otid=otid,
                        sender_id=self.sender_id,
                        step_id=self.step_id,
                        is_err=self.is_err,
                        run_id=self.run_id,
                    )
                )
            else:
                # non-assistant tool call, collect it
                tool_call_obj = ToolCall(
                    name=tool_call.function.name,
                    arguments=tool_call.function.arguments,
                    tool_call_id=tool_call.id,
                )
                collected_tool_calls.append(tool_call_obj)

        # flush any remaining collected tool calls
        if collected_tool_calls:
            tool_call_message = ToolCallMessage(
                id=self.id,
                date=self.created_at,
                # use first tool call for the deprecated field
                tool_call=collected_tool_calls[0],
                tool_calls=collected_tool_calls,
                name=self.name,
                otid=Message.generate_otid_from_id(self.id, current_message_count + len(messages)),
                sender_id=self.sender_id,
                step_id=self.step_id,
                is_err=self.is_err,
                run_id=self.run_id,
            )
            messages.append(tool_call_message)

        return messages

    def _convert_tool_return_message(self) -> ToolReturnMessage:
        """Convert tool role message to ToolReturnMessage.

        The tool return is packaged as follows:
            packaged_message = {
                "status": "OK" if was_success else "Failed",
                "message": response_string,
                "time": formatted_time,
            }

        Returns:
            ToolReturnMessage: Converted tool return message

        Raises:
            ValueError: If message role is not 'tool', parsing fails, or no valid content exists
        """
        if self.role != MessageRole.tool:
            raise ValueError(f"Cannot convert message of type {self.role} to ToolReturnMessage")

        # This is a very special buggy case during the double writing period
        # where there is no tool call id on the tool return object, but it exists top level
        # This is meant to be a short term patch - this can happen when people are using old agent files that were exported
        # during a specific migration state
        if len(self.tool_returns) == 1 and self.tool_call_id and not self.tool_returns[0].tool_call_id:
            self.tool_returns[0].tool_call_id = self.tool_call_id

        if self.tool_returns:
            return self._convert_explicit_tool_returns()

        return self._convert_legacy_tool_return()

    def _convert_explicit_tool_returns(self) -> ToolReturnMessage:
        """Convert explicit tool returns to a single ToolReturnMessage."""
        # build list of all tool return objects
        all_tool_returns = []
        for tool_return in self.tool_returns:
            parsed_data = self._parse_tool_response(tool_return.func_response)

            tool_return_obj = LettaToolReturn(
                tool_return=parsed_data["message"],
                status=parsed_data["status"],
                tool_call_id=tool_return.tool_call_id,
                stdout=tool_return.stdout,
                stderr=tool_return.stderr,
            )
            all_tool_returns.append(tool_return_obj)

        if not all_tool_returns:
            # this should not happen if tool_returns is non-empty, but handle gracefully
            raise ValueError("No tool returns to convert")

        first_tool_return = all_tool_returns[0]

        return ToolReturnMessage(
            id=self.id,
            date=self.created_at,
            # deprecated top-level fields populated from first tool return
            tool_return=first_tool_return.tool_return,
            status=first_tool_return.status,
            tool_call_id=first_tool_return.tool_call_id,
            stdout=first_tool_return.stdout,
            stderr=first_tool_return.stderr,
            tool_returns=all_tool_returns,
            name=self.name,
            otid=Message.generate_otid_from_id(self.id, 0),
            sender_id=self.sender_id,
            step_id=self.step_id,
            is_err=self.is_err,
            run_id=self.run_id,
        )

    def _convert_legacy_tool_return(self) -> ToolReturnMessage:
        """Convert legacy single text content to ToolReturnMessage."""
        if not self._has_single_text_content():
            raise ValueError(f"No valid tool returns to convert: {self}")

        text_content = self.content[0].text
        parsed_data = self._parse_tool_response(text_content)

        return self._create_tool_return_message(
            message_text=parsed_data["message"],
            status=parsed_data["status"],
            tool_call_id=self.tool_call_id,
            stdout=None,
            stderr=None,
            otid_index=0,
        )

    def _has_single_text_content(self) -> bool:
        """Check if message has exactly one text content item."""
        return self.content and len(self.content) == 1 and isinstance(self.content[0], TextContent)

    def _parse_tool_response(self, response_text: str) -> dict:
        """Parse tool response JSON and extract message and status.

        Args:
            response_text: Raw JSON response text

        Returns:
            Dictionary with 'message' and 'status' keys

        Raises:
            ValueError: If JSON parsing fails
        """
        try:
            function_return = parse_json(response_text)
            return {
                "message": str(function_return.get("message", response_text)),
                "status": self._parse_tool_status(function_return.get("status", "OK")),
            }
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to decode function return: {response_text}") from e

    def _create_tool_return_message(
        self,
        message_text: str,
        status: str,
        tool_call_id: Optional[str],
        stdout: Optional[str],
        stderr: Optional[str],
        otid_index: int,
    ) -> ToolReturnMessage:
        """Create a ToolReturnMessage with common attributes.

        Args:
            message_text: The tool return message text
            status: Tool execution status
            tool_call_id: Optional tool call identifier
            stdout: Optional standard output
            stderr: Optional standard error
            otid_index: Index for OTID generation

        Returns:
            Configured ToolReturnMessage instance
        """
        tool_return_obj = LettaToolReturn(
            tool_return=message_text,
            status=status,
            tool_call_id=tool_call_id,
            stdout=stdout,
            stderr=stderr,
        )

        return ToolReturnMessage(
            id=self.id,
            date=self.created_at,
            tool_return=message_text,
            status=status,
            tool_call_id=tool_call_id,
            stdout=stdout,
            stderr=stderr,
            tool_returns=[tool_return_obj],
            name=self.name,
            otid=Message.generate_otid_from_id(self.id, otid_index),
            sender_id=self.sender_id,
            step_id=self.step_id,
            is_err=self.is_err,
            run_id=self.run_id,
        )

    @staticmethod
    def _parse_tool_status(status: str) -> Literal["success", "error"]:
        """Convert tool status string to enum value"""
        if status == "OK":
            return "success"
        elif status == "Failed":
            return "error"
        else:
            raise ValueError(f"Invalid status: {status}")

    def _convert_approval_request_message(self) -> ApprovalRequestMessage:
        """Convert approval request message to ApprovalRequestMessage"""

        def _convert_tool_call(tool_call):
            return ToolCall(
                name=tool_call.function.name,
                arguments=tool_call.function.arguments,
                tool_call_id=tool_call.id,
            )

        return ApprovalRequestMessage(
            id=self.id,
            date=self.created_at,
            otid=self.otid,
            sender_id=self.sender_id,
            step_id=self.step_id,
            run_id=self.run_id,
            tool_call=_convert_tool_call(self.tool_calls[0]),  # backwards compatibility
            tool_calls=[_convert_tool_call(tc) for tc in self.tool_calls],
            name=self.name,
        )

    def _convert_user_message(self) -> UserMessage:
        """Convert user role message to UserMessage"""
        # Extract text content
        if self.content and len(self.content) == 1 and isinstance(self.content[0], TextContent):
            text_content = self.content[0].text
        elif self.content:
            text_content = self.content
        else:
            raise ValueError(f"Invalid user message (no text object on message): {self.content}")

        message = unpack_message(text_content)

        return UserMessage(
            id=self.id,
            date=self.created_at,
            content=message,
            name=self.name,
            otid=self.otid,
            sender_id=self.sender_id,
            step_id=self.step_id,
            is_err=self.is_err,
            run_id=self.run_id,
        )

    def _convert_system_message(self) -> SystemMessage:
        """Convert system role message to SystemMessage"""
        if self.content and len(self.content) == 1 and isinstance(self.content[0], TextContent):
            text_content = self.content[0].text
        else:
            raise ValueError(f"Invalid system message (no text object on system): {self.content}")

        return SystemMessage(
            id=self.id,
            date=self.created_at,
            content=text_content,
            name=self.name,
            otid=self.otid,
            sender_id=self.sender_id,
            step_id=self.step_id,
            run_id=self.run_id,
        )

    @staticmethod
    def dict_to_message(
        agent_id: str,
        openai_message_dict: dict,
        model: Optional[str] = None,  # model used to make function call
        allow_functions_style: bool = False,  # allow deprecated functions style?
        created_at: Optional[datetime] = None,
        id: Optional[str] = None,
        name: Optional[str] = None,
        group_id: Optional[str] = None,
        tool_returns: Optional[List[ToolReturn]] = None,
        run_id: Optional[str] = None,
    ) -> Message:
        """Convert a ChatCompletion message object into a Message object (synced to DB)"""
        if not created_at:
            # timestamp for creation
            created_at = get_utc_time()

        assert "role" in openai_message_dict, openai_message_dict
        assert "content" in openai_message_dict, openai_message_dict

        # TODO(caren) implicit support for only non-parts/list content types
        if openai_message_dict["content"] is not None and type(openai_message_dict["content"]) is not str:
            raise ValueError(f"Invalid content type: {type(openai_message_dict['content'])}")
        content: List[LettaMessageContentUnion] = (
            [TextContent(text=openai_message_dict["content"])] if openai_message_dict["content"] else []
        )

        # This is really hacky and this interface is poorly designed, we should auto derive tool_returns instead of passing it in
        if not tool_returns:
            tool_returns = []
            if "tool_returns" in openai_message_dict:
                tool_returns = [ToolReturn(**tr) for tr in openai_message_dict["tool_returns"]]

        # TODO(caren) bad assumption here that "reasoning_content" always comes before "redacted_reasoning_content"
        if "reasoning_content" in openai_message_dict and openai_message_dict["reasoning_content"]:
            content.append(
                ReasoningContent(
                    reasoning=openai_message_dict["reasoning_content"],
                    is_native=True,
                    signature=(
                        str(openai_message_dict["reasoning_content_signature"])
                        if "reasoning_content_signature" in openai_message_dict
                        else None
                    ),
                ),
            )
        if "redacted_reasoning_content" in openai_message_dict and openai_message_dict["redacted_reasoning_content"]:
            content.append(
                RedactedReasoningContent(
                    data=str(openai_message_dict["redacted_reasoning_content"]),
                ),
            )
        if "omitted_reasoning_content" in openai_message_dict and openai_message_dict["omitted_reasoning_content"]:
            content.append(
                OmittedReasoningContent(),
            )

        # If we're going from deprecated function form
        if openai_message_dict["role"] == "function":
            if not allow_functions_style:
                raise DeprecationWarning(openai_message_dict)
            assert "tool_call_id" in openai_message_dict, openai_message_dict

            # Convert from 'function' response to a 'tool' response
            if id is not None:
                return Message(
                    agent_id=agent_id,
                    model=model,
                    # standard fields expected in an OpenAI ChatCompletion message object
                    role=MessageRole.tool,  # NOTE
                    content=content,
                    name=name,
                    tool_calls=openai_message_dict["tool_calls"] if "tool_calls" in openai_message_dict else None,
                    tool_call_id=openai_message_dict["tool_call_id"] if "tool_call_id" in openai_message_dict else None,
                    created_at=created_at,
                    id=str(id),
                    tool_returns=tool_returns,
                    group_id=group_id,
                    run_id=run_id,
                )
            else:
                return Message(
                    agent_id=agent_id,
                    model=model,
                    # standard fields expected in an OpenAI ChatCompletion message object
                    role=MessageRole.tool,  # NOTE
                    content=content,
                    name=name,
                    tool_calls=openai_message_dict["tool_calls"] if "tool_calls" in openai_message_dict else None,
                    tool_call_id=openai_message_dict["tool_call_id"] if "tool_call_id" in openai_message_dict else None,
                    created_at=created_at,
                    tool_returns=tool_returns,
                    group_id=group_id,
                    run_id=run_id,
                )

        elif "function_call" in openai_message_dict and openai_message_dict["function_call"] is not None:
            if not allow_functions_style:
                raise DeprecationWarning(openai_message_dict)
            assert openai_message_dict["role"] == "assistant", openai_message_dict
            assert "tool_call_id" in openai_message_dict, openai_message_dict

            # Convert a function_call (from an assistant message) into a tool_call
            # NOTE: this does not conventionally include a tool_call_id (ToolCall.id), it's on the caster to provide it
            tool_calls = [
                OpenAIToolCall(
                    id=openai_message_dict["tool_call_id"],  # NOTE: unconventional source, not to spec
                    type="function",
                    function=OpenAIFunction(
                        name=openai_message_dict["function_call"]["name"],
                        arguments=openai_message_dict["function_call"]["arguments"],
                    ),
                )
            ]

            if id is not None:
                return Message(
                    agent_id=agent_id,
                    model=model,
                    # standard fields expected in an OpenAI ChatCompletion message object
                    role=MessageRole(openai_message_dict["role"]),
                    content=content,
                    name=name,
                    tool_calls=tool_calls,
                    tool_call_id=None,  # NOTE: None, since this field is only non-null for role=='tool'
                    created_at=created_at,
                    id=str(id),
                    tool_returns=tool_returns,
                    group_id=group_id,
                    run_id=run_id,
                )
            else:
                return Message(
                    agent_id=agent_id,
                    model=model,
                    # standard fields expected in an OpenAI ChatCompletion message object
                    role=MessageRole(openai_message_dict["role"]),
                    content=content,
                    name=openai_message_dict["name"] if "name" in openai_message_dict else None,
                    tool_calls=tool_calls,
                    tool_call_id=None,  # NOTE: None, since this field is only non-null for role=='tool'
                    created_at=created_at,
                    tool_returns=tool_returns,
                    group_id=group_id,
                    run_id=run_id,
                )

        else:
            # Basic sanity check
            if openai_message_dict["role"] == "tool":
                assert "tool_call_id" in openai_message_dict and openai_message_dict["tool_call_id"] is not None, openai_message_dict
            else:
                if "tool_call_id" in openai_message_dict:
                    assert openai_message_dict["tool_call_id"] is None, openai_message_dict

            if "tool_calls" in openai_message_dict and openai_message_dict["tool_calls"] is not None:
                assert openai_message_dict["role"] == "assistant", openai_message_dict

                tool_calls = [
                    OpenAIToolCall(id=tool_call["id"], type=tool_call["type"], function=tool_call["function"])
                    for tool_call in openai_message_dict["tool_calls"]
                ]
            else:
                tool_calls = None

            # If we're going from tool-call style
            if id is not None:
                return Message(
                    agent_id=agent_id,
                    model=model,
                    # standard fields expected in an OpenAI ChatCompletion message object
                    role=MessageRole(openai_message_dict["role"]),
                    content=content,
                    name=openai_message_dict["name"] if "name" in openai_message_dict else name,
                    tool_calls=tool_calls,
                    tool_call_id=openai_message_dict["tool_call_id"] if "tool_call_id" in openai_message_dict else None,
                    created_at=created_at,
                    id=str(id),
                    tool_returns=tool_returns,
                    group_id=group_id,
                    run_id=run_id,
                )
            else:
                return Message(
                    agent_id=agent_id,
                    model=model,
                    # standard fields expected in an OpenAI ChatCompletion message object
                    role=MessageRole(openai_message_dict["role"]),
                    content=content,
                    name=openai_message_dict["name"] if "name" in openai_message_dict else name,
                    tool_calls=tool_calls,
                    tool_call_id=openai_message_dict["tool_call_id"] if "tool_call_id" in openai_message_dict else None,
                    created_at=created_at,
                    tool_returns=tool_returns,
                    group_id=group_id,
                    run_id=run_id,
                )

    def to_openai_dict_search_results(self, max_tool_id_length: int = TOOL_CALL_ID_MAX_LEN) -> dict:
        result_json = self.to_openai_dict()
        search_result_json = {"timestamp": self.created_at, "message": {"content": result_json["content"], "role": result_json["role"]}}
        return search_result_json

    def to_openai_dict(
        self,
        max_tool_id_length: int = TOOL_CALL_ID_MAX_LEN,
        put_inner_thoughts_in_kwargs: bool = False,
        use_developer_message: bool = False,
        # if true, then treat the content field as AssistantMessage
        native_content: bool = False,
        strip_request_heartbeat: bool = False,
        tool_return_truncation_chars: Optional[int] = None,
    ) -> dict | None:
        """Go from Message class to ChatCompletion message object"""
        assert not (native_content and put_inner_thoughts_in_kwargs), "native_content and put_inner_thoughts_in_kwargs cannot both be true"

        if self.role == "approval" and self.tool_calls is None:
            return None

        # TODO change to pydantic casting, eg `return SystemMessageModel(self)`
        # If we only have one content part and it's text, treat it as COT
        parse_content_parts = False
        if self.content and len(self.content) == 1 and isinstance(self.content[0], TextContent):
            text_content = self.content[0].text
        elif self.content and len(self.content) == 1 and isinstance(self.content[0], ToolReturnContent):
            text_content = self.content[0].content
        elif self.content and len(self.content) == 1 and isinstance(self.content[0], ImageContent):
            text_content = "[Image Here]"
        # Otherwise, check if we have TextContent and multiple other parts
        elif self.content and len(self.content) > 1:
            text_parts = [content for content in self.content if isinstance(content, TextContent)]
            # assert len(text) == 1, f"multiple text content parts found in a single message: {self.content}"
            text_content = "\n\n".join([t.text for t in text_parts])
            # Summarizer transcripts use this OpenAI-style dict; include a compact image placeholder
            image_count = len([c for c in self.content if isinstance(c, ImageContent)])
            if image_count > 0:
                placeholder = "[Image omitted]" if image_count == 1 else f"[{image_count} images omitted]"
                text_content = (text_content + (" " if text_content else "")) + placeholder
            parse_content_parts = True
        else:
            text_content = None

        # TODO(caren) we should eventually support multiple content parts here?
        # ie, actually make dict['content'] type list
        # But for now, it's OK until we support multi-modal,
        # since the only "parts" we have are for supporting various COT

        if self.role == "system":
            openai_message = {
                "content": text_content,
                "role": "developer" if use_developer_message else self.role,
            }

        elif self.role == "user":
            assert text_content is not None, vars(self)
            openai_message = {
                "content": text_content,
                "role": self.role,
            }

        elif self.role == "assistant" or self.role == "approval":
            try:
                assert self.tool_calls is not None or text_content is not None, vars(self)
            except AssertionError as e:
                # relax check if this message only contains reasoning content
                if self.content is not None and len(self.content) > 0:
                    # Check if all non-empty content is reasoning-related
                    all_reasoning = all(
                        isinstance(c, (ReasoningContent, SummarizedReasoningContent, OmittedReasoningContent, RedactedReasoningContent))
                        for c in self.content
                    )
                    if all_reasoning:
                        return None
                raise e

            # if native content, then put it directly inside the content
            if native_content:
                openai_message = {
                    # TODO support listed content (if it's possible for role assistant?)
                    # "content": self.content,
                    "content": text_content,  # here content is not reasoning, it's assistant message
                    "role": "assistant",
                }
            # otherwise, if inner_thoughts_in_kwargs, hold it for the tool calls
            else:
                openai_message = {
                    "content": None if (put_inner_thoughts_in_kwargs and self.tool_calls is not None) else text_content,
                    "role": "assistant",
                }

            if self.tool_calls is not None:
                if put_inner_thoughts_in_kwargs:
                    # put the inner thoughts inside the tool call before casting to a dict
                    openai_message["tool_calls"] = [
                        add_inner_thoughts_to_tool_call(
                            tool_call,
                            inner_thoughts=text_content,
                            inner_thoughts_key=INNER_THOUGHTS_KWARG,
                        ).model_dump()
                        for tool_call in self.tool_calls
                    ]
                else:
                    openai_message["tool_calls"] = [tool_call.model_dump() for tool_call in self.tool_calls]

                if strip_request_heartbeat:
                    for tool_call_dict in openai_message["tool_calls"]:
                        tool_call_dict.pop(REQUEST_HEARTBEAT_PARAM, None)

                if max_tool_id_length:
                    for tool_call_dict in openai_message["tool_calls"]:
                        tool_call_dict["id"] = tool_call_dict["id"][:max_tool_id_length]

        elif self.role == "tool":
            # Handle tool returns - if tool_returns exists, use the first one
            if self.tool_returns and len(self.tool_returns) > 0:
                tool_return = self.tool_returns[0]
                if not tool_return.tool_call_id:
                    raise TypeError("OpenAI API requires tool_call_id to be set.")
                func_response = truncate_tool_return(tool_return.func_response, tool_return_truncation_chars)
                openai_message = {
                    "content": func_response,
                    "role": self.role,
                    "tool_call_id": tool_return.tool_call_id[:max_tool_id_length] if max_tool_id_length else tool_return.tool_call_id,
                }
            else:
                # Legacy fallback for old message format
                assert self.tool_call_id is not None, vars(self)
                legacy_content = truncate_tool_return(text_content, tool_return_truncation_chars)
                openai_message = {
                    "content": legacy_content,
                    "role": self.role,
                    "tool_call_id": self.tool_call_id[:max_tool_id_length] if max_tool_id_length else self.tool_call_id,
                }

        else:
            raise ValueError(self.role)

        # Optional field, do not include if null or invalid
        if self.name is not None:
            if bool(re.match(r"^[^\s<|\\/>]+$", self.name)):
                openai_message["name"] = self.name
            else:
                logger.warning(f"Using OpenAI with invalid 'name' field (name={self.name} role={self.role}).")

        if parse_content_parts and self.content is not None:
            for content in self.content:
                if isinstance(content, ReasoningContent):
                    openai_message["reasoning_content"] = content.reasoning
                    if content.signature:
                        openai_message["reasoning_content_signature"] = content.signature
                if isinstance(content, RedactedReasoningContent):
                    openai_message["redacted_reasoning_content"] = content.data

        return openai_message

    @staticmethod
    def to_openai_dicts_from_list(
        messages: List[Message],
        max_tool_id_length: int = TOOL_CALL_ID_MAX_LEN,
        put_inner_thoughts_in_kwargs: bool = False,
        use_developer_message: bool = False,
        tool_return_truncation_chars: Optional[int] = None,
    ) -> List[dict]:
        messages = Message.filter_messages_for_llm_api(messages)
        result: List[dict] = []

        for m in messages:
            # Special case: OpenAI Chat Completions requires a separate tool message per tool_call_id
            # If we have multiple explicit tool_returns on a single Message, expand into one dict per return
            if m.role == MessageRole.tool and m.tool_returns and len(m.tool_returns) > 0:
                for tr in m.tool_returns:
                    if not tr.tool_call_id:
                        raise TypeError("ToolReturn came back without a tool_call_id.")
                    # Ensure explicit tool_returns are truncated for Chat Completions
                    func_response = truncate_tool_return(tr.func_response, tool_return_truncation_chars)
                    result.append(
                        {
                            "content": func_response,
                            "role": "tool",
                            "tool_call_id": tr.tool_call_id[:max_tool_id_length] if max_tool_id_length else tr.tool_call_id,
                        }
                    )
                continue

            d = m.to_openai_dict(
                max_tool_id_length=max_tool_id_length,
                put_inner_thoughts_in_kwargs=put_inner_thoughts_in_kwargs,
                use_developer_message=use_developer_message,
                tool_return_truncation_chars=tool_return_truncation_chars,
            )
            if d is not None:
                result.append(d)

        return result

    def to_openai_responses_dicts(
        self,
        max_tool_id_length: int = TOOL_CALL_ID_MAX_LEN,
        tool_return_truncation_chars: Optional[int] = None,
    ) -> List[dict]:
        """Go from Message class to ChatCompletion message object"""

        if self.role == "approval" and self.tool_calls is None:
            return []

        message_dicts = []

        if self.role == "system":
            assert len(self.content) == 1 and isinstance(self.content[0], TextContent), vars(self)
            message_dicts.append(
                {
                    "role": "developer",
                    "content": self.content[0].text,
                }
            )

        elif self.role == "user":
            # TODO do we need to do a swap to placeholder text here for images?
            assert all([isinstance(c, TextContent) or isinstance(c, ImageContent) for c in self.content]), vars(self)

            user_dict = {
                "role": self.role.value if hasattr(self.role, "value") else self.role,
                # TODO support multi-modal
                "content": self.content[0].text,
            }

            # Optional field, do not include if null or invalid
            if self.name is not None:
                if bool(re.match(r"^[^\s<|\\/>]+$", self.name)):
                    user_dict["name"] = self.name
                else:
                    logger.warning(f"Using OpenAI with invalid 'name' field (name={self.name} role={self.role}).")

            message_dicts.append(user_dict)

        elif self.role == "assistant" or self.role == "approval":
            assert self.tool_calls is not None or (self.content is not None and len(self.content) > 0)

            # A few things may be in here, firstly reasoning content, secondly assistant messages, thirdly tool calls
            # TODO check if OpenAI Responses is capable of R->A->T like Anthropic?

            if self.content is not None:
                for content_part in self.content:
                    if isinstance(content_part, SummarizedReasoningContent):
                        message_dicts.append(
                            {
                                "type": "reasoning",
                                "id": content_part.id,
                                "summary": [{"type": "summary_text", "text": s.text} for s in content_part.summary],
                                "encrypted_content": content_part.encrypted_content,
                            }
                        )
                    elif isinstance(content_part, TextContent):
                        message_dicts.append(
                            {
                                "role": "assistant",
                                "content": content_part.text,
                            }
                        )
                    # else skip

            if self.tool_calls is not None:
                for tool_call in self.tool_calls:
                    message_dicts.append(
                        {
                            "type": "function_call",
                            "call_id": tool_call.id[:max_tool_id_length] if max_tool_id_length else tool_call.id,
                            "name": tool_call.function.name,
                            "arguments": tool_call.function.arguments,
                            "status": "completed",  # TODO check if needed?
                        }
                    )

        elif self.role == "tool":
            # Handle tool returns - similar pattern to Anthropic
            if self.tool_returns:
                for tool_return in self.tool_returns:
                    if not tool_return.tool_call_id:
                        raise TypeError("OpenAI Responses API requires tool_call_id to be set.")
                    func_response = truncate_tool_return(tool_return.func_response, tool_return_truncation_chars)
                    message_dicts.append(
                        {
                            "type": "function_call_output",
                            "call_id": tool_return.tool_call_id[:max_tool_id_length] if max_tool_id_length else tool_return.tool_call_id,
                            "output": func_response,
                        }
                    )
            else:
                # Legacy fallback for old message format
                assert self.tool_call_id is not None, vars(self)
                assert len(self.content) == 1 and isinstance(self.content[0], TextContent), vars(self)
                legacy_output = truncate_tool_return(self.content[0].text, tool_return_truncation_chars)
                message_dicts.append(
                    {
                        "type": "function_call_output",
                        "call_id": self.tool_call_id[:max_tool_id_length] if max_tool_id_length else self.tool_call_id,
                        "output": legacy_output,
                    }
                )

        else:
            raise ValueError(self.role)

        return message_dicts

    @staticmethod
    def to_openai_responses_dicts_from_list(
        messages: List[Message],
        max_tool_id_length: int = TOOL_CALL_ID_MAX_LEN,
        tool_return_truncation_chars: Optional[int] = None,
    ) -> List[dict]:
        messages = Message.filter_messages_for_llm_api(messages)
        result = []
        for message in messages:
            result.extend(
                message.to_openai_responses_dicts(
                    max_tool_id_length=max_tool_id_length, tool_return_truncation_chars=tool_return_truncation_chars
                )
            )
        return result

    def to_anthropic_dict(
        self,
        current_model: str,
        inner_thoughts_xml_tag="thinking",
        put_inner_thoughts_in_kwargs: bool = False,
        # if true, then treat the content field as AssistantMessage
        native_content: bool = False,
        strip_request_heartbeat: bool = False,
        tool_return_truncation_chars: Optional[int] = None,
    ) -> dict | None:
        """
        Convert to an Anthropic message dictionary

        Args:
            inner_thoughts_xml_tag (str): The XML tag to wrap around inner thoughts
        """
        assert not (native_content and put_inner_thoughts_in_kwargs), "native_content and put_inner_thoughts_in_kwargs cannot both be true"

        if self.role == "approval" and self.tool_calls is None:
            return None

        # Check for COT
        if self.content and len(self.content) == 1 and isinstance(self.content[0], TextContent):
            text_content = self.content[0].text
        else:
            text_content = None

        def add_xml_tag(string: str, xml_tag: Optional[str]):
            # NOTE: Anthropic docs recommends using <thinking> tag when using CoT + tool use
            if f"<{xml_tag}>" in string and f"</{xml_tag}>" in string:
                # don't nest if tags already exist
                return string
            return f"<{xml_tag}>{string}</{xml_tag}" if xml_tag else string

        if self.role == "system":
            # NOTE: this is not for system instructions, but instead system "events"

            assert text_content is not None, vars(self)
            # Two options here, we would use system.package_system_message,
            # or use a more Anthropic-specific packaging ie xml tags
            user_system_event = add_xml_tag(string=f"SYSTEM ALERT: {text_content}", xml_tag="event")
            anthropic_message = {
                "content": user_system_event,
                "role": "user",
            }

        elif self.role == "user":
            # special case for text-only message
            if text_content is not None:
                anthropic_message = {
                    "content": text_content,
                    "role": self.role,
                }
            else:
                content_parts = []
                for content in self.content:
                    if isinstance(content, TextContent):
                        content_parts.append({"type": "text", "text": content.text})
                    elif isinstance(content, ImageContent):
                        content_parts.append(
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "data": content.source.data,
                                    "media_type": content.source.media_type,
                                },
                            }
                        )
                    else:
                        raise ValueError(f"Unsupported content type: {content.type}")

                anthropic_message = {
                    "content": content_parts,
                    "role": self.role,
                }

        elif self.role == "assistant" or self.role == "approval":
            # assert self.tool_calls is not None or text_content is not None, vars(self)
            assert self.tool_calls is not None or len(self.content) > 0
            anthropic_message = {
                "role": "assistant",
            }
            content = []
            if native_content:
                # No special handling for TextContent
                if self.content is not None:
                    for content_part in self.content:
                        # TextContent, ImageContent, ToolCallContent, ToolReturnContent, ReasoningContent, RedactedReasoningContent, OmittedReasoningContent
                        if isinstance(content_part, ReasoningContent):
                            if current_model == self.model:
                                content.append(
                                    {
                                        "type": "thinking",
                                        "thinking": content_part.reasoning,
                                        "signature": content_part.signature,
                                    }
                                )
                        elif isinstance(content_part, RedactedReasoningContent):
                            if current_model == self.model:
                                content.append(
                                    {
                                        "type": "redacted_thinking",
                                        "data": content_part.data,
                                    }
                                )
                        elif isinstance(content_part, TextContent):
                            content.append(
                                {
                                    "type": "text",
                                    "text": content_part.text,
                                }
                            )
                        else:
                            # Skip unsupported types eg OmmitedReasoningContent
                            pass

            else:
                # COT / reasoning / thinking
                if self.content is not None and len(self.content) >= 1:
                    for content_part in self.content:
                        if isinstance(content_part, ReasoningContent):
                            if current_model == self.model:
                                content.append(
                                    {
                                        "type": "thinking",
                                        "thinking": content_part.reasoning,
                                        "signature": content_part.signature,
                                    }
                                )
                        if isinstance(content_part, RedactedReasoningContent):
                            if current_model == self.model:
                                content.append(
                                    {
                                        "type": "redacted_thinking",
                                        "data": content_part.data,
                                    }
                                )
                        if isinstance(content_part, TextContent):
                            content.append(
                                {
                                    "type": "text",
                                    "text": content_part.text,
                                }
                            )
                elif text_content is not None:
                    content.append(
                        {
                            "type": "text",
                            "text": add_xml_tag(string=text_content, xml_tag=inner_thoughts_xml_tag),
                        }
                    )
            # Tool calling
            if self.tool_calls is not None:
                for tool_call in self.tool_calls:
                    if put_inner_thoughts_in_kwargs:
                        tool_call_input = add_inner_thoughts_to_tool_call(
                            tool_call,
                            inner_thoughts=text_content,
                            inner_thoughts_key=INNER_THOUGHTS_KWARG,
                        ).model_dump()
                    else:
                        tool_call_input = parse_json(tool_call.function.arguments)

                    if strip_request_heartbeat:
                        tool_call_input.pop(REQUEST_HEARTBEAT_PARAM, None)

                    content.append(
                        {
                            "type": "tool_use",
                            "id": tool_call.id,
                            "name": tool_call.function.name,
                            "input": tool_call_input,
                        }
                    )

            anthropic_message["content"] = content

        elif self.role == "tool":
            # NOTE: Anthropic uses role "user" for "tool" responses
            content = []
            for tool_return in self.tool_returns:
                if not tool_return.tool_call_id:
                    from letta.log import get_logger

                    logger = get_logger(__name__)
                    logger.error(
                        f"Missing tool_call_id in tool return. "
                        f"Message ID: {self.id}, "
                        f"Tool name: {getattr(tool_return, 'name', 'unknown')}, "
                        f"Tool return: {tool_return}"
                    )
                    raise TypeError(
                        f"Anthropic API requires tool_use_id to be set. "
                        f"Message ID: {self.id}, Tool: {getattr(tool_return, 'name', 'unknown')}"
                    )
                func_response = truncate_tool_return(tool_return.func_response, tool_return_truncation_chars)
                content.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": tool_return.tool_call_id,
                        "content": func_response,
                    }
                )
            if content:
                anthropic_message = {
                    "role": "user",
                    "content": content,
                }
            else:
                if not self.tool_call_id:
                    raise TypeError("Anthropic API requires tool_use_id to be set.")

                # This is for legacy reasons
                legacy_content = truncate_tool_return(text_content, tool_return_truncation_chars)
                anthropic_message = {
                    "role": "user",  # NOTE: diff
                    "content": [
                        # TODO support error types etc
                        {
                            "type": "tool_result",
                            "tool_use_id": self.tool_call_id,
                            "content": legacy_content,
                        }
                    ],
                }

        else:
            raise ValueError(self.role)

        return anthropic_message

    @staticmethod
    def to_anthropic_dicts_from_list(
        messages: List[Message],
        current_model: str,
        inner_thoughts_xml_tag: str = "thinking",
        put_inner_thoughts_in_kwargs: bool = False,
        # if true, then treat the content field as AssistantMessage
        native_content: bool = False,
        strip_request_heartbeat: bool = False,
        tool_return_truncation_chars: Optional[int] = None,
    ) -> List[dict]:
        messages = Message.filter_messages_for_llm_api(messages)
        result = [
            m.to_anthropic_dict(
                current_model=current_model,
                inner_thoughts_xml_tag=inner_thoughts_xml_tag,
                put_inner_thoughts_in_kwargs=put_inner_thoughts_in_kwargs,
                native_content=native_content,
                strip_request_heartbeat=strip_request_heartbeat,
                tool_return_truncation_chars=tool_return_truncation_chars,
            )
            for m in messages
        ]
        result = [m for m in result if m is not None]
        return result

    def to_google_dict(
        self,
        current_model: str,
        put_inner_thoughts_in_kwargs: bool = True,
        # if true, then treat the content field as AssistantMessage
        native_content: bool = False,
        strip_request_heartbeat: bool = False,
        tool_return_truncation_chars: Optional[int] = None,
    ) -> dict | None:
        """
        Go from Message class to Google AI REST message object
        """
        assert not (native_content and put_inner_thoughts_in_kwargs), "native_content and put_inner_thoughts_in_kwargs cannot both be true"

        if self.role == "approval" and self.tool_calls is None:
            return None

        # type Content: https://ai.google.dev/api/rest/v1/Content / https://ai.google.dev/api/rest/v1beta/Content
        #     parts[]: Part
        #     role: str ('user' or 'model')
        if self.content and len(self.content) == 1 and isinstance(self.content[0], TextContent):
            text_content = self.content[0].text
        elif self.content and len(self.content) == 1 and isinstance(self.content[0], ToolReturnContent):
            text_content = self.content[0].content
        else:
            text_content = None

        if self.role != "tool" and self.name is not None:
            logger.warning(f"Using Google AI with non-null 'name' field (name={self.name} role={self.role}), not yet supported.")

        if self.role == "system":
            # NOTE: Gemini API doesn't have a 'system' role, use 'user' instead
            # https://www.reddit.com/r/Bard/comments/1b90i8o/does_gemini_have_a_system_prompt_option_while/
            google_ai_message = {
                "role": "user",  # NOTE: no 'system'
                "parts": [{"text": text_content}],
            }

        elif self.role == "user":
            assert self.content, vars(self)

            content_parts = []
            for content in self.content:
                if isinstance(content, TextContent):
                    content_parts.append({"text": content.text})
                elif isinstance(content, ImageContent):
                    content_parts.append(
                        {
                            "inline_data": {
                                "data": content.source.data,
                                "mime_type": content.source.media_type,
                            }
                        }
                    )
                else:
                    raise ValueError(f"Unsupported content type: {content.type}")

            google_ai_message = {
                "role": "user",
                "parts": content_parts,
            }

        elif self.role == "assistant" or self.role == "approval":
            assert self.tool_calls is not None or text_content is not None or len(self.content) > 1
            google_ai_message = {
                "role": "model",  # NOTE: different
            }

            # NOTE: Google AI API doesn't allow non-null content + function call
            # To get around this, just two a two part message, inner thoughts first then
            parts = []

            if native_content and text_content is not None:
                # TODO support multi-part assistant content
                parts.append({"text": text_content})

            elif not put_inner_thoughts_in_kwargs and text_content is not None:
                # NOTE: ideally we do multi-part for CoT / inner thoughts + function call, but Google AI API doesn't allow it
                raise NotImplementedError
                parts.append({"text": text_content})

            if self.tool_calls is not None:
                # NOTE: implied support for multiple calls
                for tool_call in self.tool_calls:
                    function_name = tool_call.function.name
                    function_args = tool_call.function.arguments
                    try:
                        # NOTE: Google AI wants actual JSON objects, not strings
                        function_args = parse_json(function_args)
                    except:
                        raise UserWarning(f"Failed to parse JSON function args: {function_args}")
                        function_args = {"args": function_args}

                    if put_inner_thoughts_in_kwargs and text_content is not None:
                        assert INNER_THOUGHTS_KWARG not in function_args, function_args
                        assert len(self.tool_calls) == 1
                        function_args[INNER_THOUGHTS_KWARG_VERTEX] = text_content

                    if strip_request_heartbeat:
                        function_args.pop(REQUEST_HEARTBEAT_PARAM, None)

                    parts.append(
                        {
                            "functionCall": {
                                "name": function_name,
                                "args": function_args,
                            }
                        }
                    )
            else:
                if not native_content:
                    assert text_content is not None
                    parts.append({"text": text_content})

            if self.content and len(self.content) > 1:
                native_google_content_parts = []
                for content in self.content:
                    if isinstance(content, TextContent):
                        native_part = {"text": content.text}
                        if content.signature and current_model == self.model:
                            native_part["thought_signature"] = content.signature
                        native_google_content_parts.append(native_part)
                    elif isinstance(content, ReasoningContent):
                        if current_model == self.model:
                            native_google_content_parts.append({"text": content.reasoning, "thought": True})
                    elif isinstance(content, ToolCallContent):
                        native_part = {
                            "function_call": {
                                "name": content.name,
                                "args": content.input,
                            },
                        }
                        if content.signature and current_model == self.model:
                            native_part["thought_signature"] = content.signature
                        native_google_content_parts.append(native_part)
                    else:
                        # silently drop other content types
                        pass
                if native_google_content_parts:
                    parts = native_google_content_parts

            google_ai_message["parts"] = parts

        elif self.role == "tool":
            # NOTE: Significantly different tool calling format, more similar to function calling format

            # Handle tool returns - similar pattern to Anthropic
            if self.tool_returns:
                parts = []
                for tool_return in self.tool_returns:
                    if not tool_return.tool_call_id:
                        raise TypeError("Google AI API requires tool_call_id to be set.")

                    # Use the function name if available, otherwise use tool_call_id
                    function_name = self.name if self.name else tool_return.tool_call_id

                    # Truncate the tool return if needed
                    func_response = truncate_tool_return(tool_return.func_response, tool_return_truncation_chars)

                    # NOTE: Google AI API wants the function response as JSON only, no string
                    try:
                        function_response = parse_json(func_response)
                    except:
                        function_response = {"function_response": func_response}

                    parts.append(
                        {
                            "functionResponse": {
                                "name": function_name,
                                "response": {
                                    "name": function_name,  # NOTE: name twice... why?
                                    "content": function_response,
                                },
                            }
                        }
                    )

                google_ai_message = {
                    "role": "function",
                    "parts": parts,
                }
            else:
                # Legacy fallback for old message format
                assert self.tool_call_id is not None, vars(self)

                if self.name is None:
                    logger.warning("Couldn't find function name on tool call, defaulting to tool ID instead.")
                    function_name = self.tool_call_id
                else:
                    function_name = self.name

                # Truncate the legacy content if needed
                legacy_content = truncate_tool_return(text_content, tool_return_truncation_chars)

                # NOTE: Google AI API wants the function response as JSON only, no string
                try:
                    function_response = parse_json(legacy_content)
                except:
                    function_response = {"function_response": legacy_content}

                google_ai_message = {
                    "role": "function",
                    "parts": [
                        {
                            "functionResponse": {
                                "name": function_name,
                                "response": {
                                    "name": function_name,  # NOTE: name twice... why?
                                    "content": function_response,
                                },
                            }
                        }
                    ],
                }

        else:
            raise ValueError(self.role)

        # Validate that parts is never empty before returning
        if "parts" not in google_ai_message or not google_ai_message["parts"]:
            # If parts is empty, add a default text part
            google_ai_message["parts"] = [{"text": "empty message"}]
            logger.warning(
                f"Empty 'parts' detected in message with role '{self.role}'. Added default empty text part. Full message:\n{vars(self)}"
            )

        return google_ai_message

    @staticmethod
    def to_google_dicts_from_list(
        messages: List[Message],
        current_model: str,
        put_inner_thoughts_in_kwargs: bool = True,
        native_content: bool = False,
        tool_return_truncation_chars: Optional[int] = None,
    ):
        messages = Message.filter_messages_for_llm_api(messages)
        result = [
            m.to_google_dict(
                current_model=current_model,
                put_inner_thoughts_in_kwargs=put_inner_thoughts_in_kwargs,
                native_content=native_content,
                tool_return_truncation_chars=tool_return_truncation_chars,
            )
            for m in messages
        ]
        result = [m for m in result if m is not None]
        return result

    def is_approval_request(self) -> bool:
        return self.role == "approval" and self.tool_calls is not None and len(self.tool_calls) > 0

    def is_approval_response(self) -> bool:
        return self.role == "approval" and self.tool_calls is None and self.approve is not None

    def is_summarization_message(self) -> bool:
        return (
            self.role == "user"
            and self.content is not None
            and len(self.content) == 1
            and isinstance(self.content[0], TextContent)
            and "system_alert" in self.content[0].text
        )

    @staticmethod
    def filter_messages_for_llm_api(
        messages: List[Message],
    ) -> List[Message]:
        messages = [m for m in messages if m is not None]
        if len(messages) == 0:
            return []
        # Add special handling for legacy bug where summarization triggers in the middle of hitl
        messages_to_filter = []
        for i in range(len(messages) - 1):
            first_message_is_approval = messages[i].is_approval_request()
            second_message_is_summary = messages[i + 1].is_summarization_message()
            third_message_is_optional_approval = i + 2 >= len(messages) or messages[i + 2].is_approval_response()
            if first_message_is_approval and second_message_is_summary and third_message_is_optional_approval:
                messages_to_filter.append(messages[i])
        for idx in reversed(messages_to_filter):  # reverse to avoid index shift
            messages.remove(idx)

        # Filter last message if it is a lone approval request without a response - this only occurs for token counting
        if messages[-1].role == "approval" and messages[-1].tool_calls is not None and len(messages[-1].tool_calls) > 0:
            messages.remove(messages[-1])
            # Also filter pending tool call message if this turn invoked parallel tool calling
            if messages and messages[-1].role == "assistant" and messages[-1].tool_calls is not None and len(messages[-1].tool_calls) > 0:
                messages.remove(messages[-1])

        # Filter last message if it is a lone reasoning message without assistant message or tool call
        if (
            messages[-1].role == "assistant"
            and messages[-1].tool_calls is None
            and (not messages[-1].content or all(not isinstance(content_part, TextContent) for content_part in messages[-1].content))
        ):
            messages.remove(messages[-1])

        # Collapse adjacent tool call and approval messages
        messages = Message.collapse_tool_call_messages_for_llm_api(messages)

        # Dedupe duplicate tool-return payloads across tool messages so downstream providers
        # never see the same tool_call_id's result twice in a single request
        messages = Message.dedupe_tool_messages_for_llm_api(messages)

        # Dedupe duplicate tool calls within assistant messages so a single assistant message
        # cannot emit multiple tool_use blocks with the same id (Anthropic requirement)
        messages = Message.dedupe_tool_calls_for_llm_api(messages)

        return messages

    @staticmethod
    def collapse_tool_call_messages_for_llm_api(
        messages: List[Message],
    ) -> List[Message]:
        adjacent_tool_call_approval_messages = []
        for i in range(len(messages) - 1):
            if (
                messages[i].role == MessageRole.assistant
                and messages[i].tool_calls is not None
                and messages[i + 1].role == MessageRole.approval
                and messages[i + 1].tool_calls is not None
            ):
                adjacent_tool_call_approval_messages.append(i)
        for i in reversed(adjacent_tool_call_approval_messages):
            messages[i].content = messages[i].content + messages[i + 1].content
            messages[i].tool_calls = messages[i].tool_calls + messages[i + 1].tool_calls
            messages.remove(messages[i + 1])
        return messages

    @staticmethod
    def dedupe_tool_messages_for_llm_api(messages: List[Message]) -> List[Message]:
        """Dedupe duplicate tool returns across tool-role messages by tool_call_id.

        - For explicit tool_returns arrays: keep the first occurrence of each tool_call_id,
          drop subsequent duplicates within the request.
        - For legacy single tool_call_id + content messages: keep the first, drop duplicates.
        - If a tool message has neither unique tool_returns nor content, drop it.

        This runs prior to provider-specific formatting to reduce duplicate tool_result blocks downstream.
        """
        if not messages:
            return messages

        from letta.log import get_logger

        logger = get_logger(__name__)

        seen_ids: set[str] = set()
        removed_tool_msgs = 0
        removed_tool_returns = 0
        result: List[Message] = []

        for m in messages:
            if m.role != MessageRole.tool:
                result.append(m)
                continue

            # Prefer explicit tool_returns when present
            if m.tool_returns and len(m.tool_returns) > 0:
                unique_returns = []
                for tr in m.tool_returns:
                    tcid = getattr(tr, "tool_call_id", None)
                    if tcid and tcid in seen_ids:
                        removed_tool_returns += 1
                        continue
                    if tcid:
                        seen_ids.add(tcid)
                    unique_returns.append(tr)

                if unique_returns:
                    # Replace with unique set; keep message
                    m.tool_returns = unique_returns
                    result.append(m)
                else:
                    # No unique returns left; if legacy content exists, fall back to legacy handling below
                    if m.tool_call_id and m.content and len(m.content) > 0:
                        tcid = m.tool_call_id
                        if tcid in seen_ids:
                            removed_tool_msgs += 1
                            continue
                        seen_ids.add(tcid)
                        result.append(m)
                    else:
                        removed_tool_msgs += 1
                        continue

            else:
                # Legacy single-response path
                tcid = getattr(m, "tool_call_id", None)
                if tcid:
                    if tcid in seen_ids:
                        removed_tool_msgs += 1
                        continue
                    seen_ids.add(tcid)
                result.append(m)

        if removed_tool_msgs or removed_tool_returns:
            logger.error(
                "[Message] Deduped duplicate tool messages for request: removed_messages=%d, removed_returns=%d",
                removed_tool_msgs,
                removed_tool_returns,
            )

        return result

    @staticmethod
    def dedupe_tool_calls_for_llm_api(messages: List[Message]) -> List[Message]:
        """Ensure each assistant message contains unique tool_calls by id.

        Anthropic requires tool_use ids to be unique within a single assistant message. When
        collapsing adjacent assistant/approval messages, duplicates can sneak in. This pass keeps
        the first occurrence per id and drops subsequent duplicates.
        """
        if not messages:
            return messages

        from letta.log import get_logger

        logger = get_logger(__name__)

        removed_counts_total = 0
        for m in messages:
            if m.role != MessageRole.assistant or not m.tool_calls:
                continue
            seen: set[str] = set()
            unique_tool_calls = []
            removed = 0
            for tc in m.tool_calls:
                tcid = getattr(tc, "id", None)
                if tcid and tcid in seen:
                    removed += 1
                    continue
                if tcid:
                    seen.add(tcid)
                unique_tool_calls.append(tc)
            if removed:
                m.tool_calls = unique_tool_calls
                removed_counts_total += removed
        if removed_counts_total:
            logger.error("[Message] Deduped duplicate tool_calls in assistant messages: removed=%d", removed_counts_total)
        return messages

    @staticmethod
    def generate_otid_from_id(message_id: str, index: int) -> str:
        """
        Convert message id to bits and change the list bit to the index
        """
        if index == -1:
            return message_id

        if not 0 <= index < 128:
            raise ValueError("Index must be between 0 and 127")

        message_uuid = message_id.replace("message-", "")
        uuid_int = int(message_uuid.replace("-", ""), 16)

        # Clear last 7 bits and set them to index; supports up to 128 unique indices
        uuid_int = (uuid_int & ~0x7F) | (index & 0x7F)

        hex_str = f"{uuid_int:032x}"
        return f"{hex_str[:8]}-{hex_str[8:12]}-{hex_str[12:16]}-{hex_str[16:20]}-{hex_str[20:]}"


class ToolReturn(BaseModel):
    tool_call_id: Optional[Any] = Field(None, description="The ID for the tool call")
    status: Literal["success", "error"] = Field(..., description="The status of the tool call")
    stdout: Optional[List[str]] = Field(default=None, description="Captured stdout (e.g. prints, logs) from the tool invocation")
    stderr: Optional[List[str]] = Field(default=None, description="Captured stderr from the tool invocation")
    func_response: Optional[str] = Field(None, description="The function response string")


class MessageSearchRequest(BaseModel):
    """Request model for searching messages across the organization"""

    query: Optional[str] = Field(None, description="Text query for full-text search")
    search_mode: Literal["vector", "fts", "hybrid"] = Field("hybrid", description="Search mode to use")
    roles: Optional[List[MessageRole]] = Field(None, description="Filter messages by role")
    project_id: Optional[str] = Field(None, description="Filter messages by project ID")
    template_id: Optional[str] = Field(None, description="Filter messages by template ID")
    limit: int = Field(50, description="Maximum number of results to return", ge=1, le=100)
    start_date: Optional[datetime] = Field(None, description="Filter messages created after this date")
    end_date: Optional[datetime] = Field(None, description="Filter messages created on or before this date")


class MessageSearchResult(BaseModel):
    """Result from a message search operation with scoring details."""

    embedded_text: str = Field(..., description="The embedded content (LLM-friendly)")
    message: Message = Field(..., description="The raw message object")
    fts_rank: Optional[int] = Field(None, description="Full-text search rank position if FTS was used")
    vector_rank: Optional[int] = Field(None, description="Vector search rank position if vector search was used")
    rrf_score: float = Field(..., description="Reciprocal Rank Fusion combined score")
