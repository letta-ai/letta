from __future__ import annotations

import copy
import json
import warnings
from collections import OrderedDict
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional, Union

from openai.types.chat.chat_completion_message_tool_call import ChatCompletionMessageToolCall as OpenAIToolCall
from openai.types.chat.chat_completion_message_tool_call import Function as OpenAIFunction
from pydantic import BaseModel, Field, field_validator

from letta.constants import DEFAULT_MESSAGE_TOOL, DEFAULT_MESSAGE_TOOL_KWARG, TOOL_CALL_ID_MAX_LEN
from letta.helpers.datetime_helpers import get_utc_time, is_utc_datetime
from letta.helpers.json_helpers import json_dumps
from letta.local_llm.constants import INNER_THOUGHTS_KWARG
from letta.schemas.enums import MessageRole
from letta.schemas.letta_base import OrmMetadataBase
from letta.schemas.letta_message import (
    AssistantMessage,
    LettaMessage,
    ReasoningMessage,
    SystemMessage,
    ToolCall,
    ToolCallMessage,
    ToolReturnMessage,
    UserMessage,
)
from letta.schemas.letta_message_content import LettaMessageContentUnion, TextContent, get_letta_message_content_union_str_json_schema
from letta.system import unpack_message


def add_inner_thoughts_to_tool_call(
    tool_call: OpenAIToolCall,
    inner_thoughts: str,
    inner_thoughts_key: str,
) -> OpenAIToolCall:
    """Add inner thoughts (arg + value) to a tool call"""
    try:
        # load the args list
        func_args = json.loads(tool_call.function.arguments)
        # create new ordered dict with inner thoughts first
        ordered_args = OrderedDict({inner_thoughts_key: inner_thoughts})
        # update with remaining args
        ordered_args.update(func_args)
        # create the updated tool call (as a string)
        updated_tool_call = copy.deepcopy(tool_call)
        updated_tool_call.function.arguments = json_dumps(ordered_args)
        return updated_tool_call
    except json.JSONDecodeError as e:
        warnings.warn(f"Failed to put inner thoughts in kwargs: {e}")
        raise e


class BaseMessage(OrmMetadataBase):
    __id_prefix__ = "message"


class MessageCreate(BaseModel):
    """Request to create a message"""

    # In the simplified format, only allow simple roles
    role: Literal[
        MessageRole.user,
        MessageRole.system,
    ] = Field(..., description="The role of the participant.")
    content: Union[str, List[LettaMessageContentUnion]] = Field(
        ...,
        description="The content of the message.",
        json_schema_extra=get_letta_message_content_union_str_json_schema(),
    )
    name: Optional[str] = Field(None, description="The name of the participant.")

    def model_dump(self, to_orm: bool = False, **kwargs) -> Dict[str, Any]:
        data = super().model_dump(**kwargs)
        if to_orm and "content" in data:
            if isinstance(data["content"], str):
                data["content"] = [TextContent(text=data["content"])]
        return data


class MessageUpdate(BaseModel):
    """Request to update a message"""

    role: Optional[MessageRole] = Field(None, description="The role of the participant.")
    content: Optional[Union[str, List[LettaMessageContentUnion]]] = Field(
        None,
        description="The content of the message.",
        json_schema_extra=get_letta_message_content_union_str_json_schema(),
    )
    # NOTE: probably doesn't make sense to allow remapping user_id or agent_id (vs creating a new message)
    # user_id: Optional[str] = Field(None, description="The unique identifier of the user.")
    # agent_id: Optional[str] = Field(None, description="The unique identifier of the agent.")
    # NOTE: we probably shouldn't allow updating the model field, otherwise this loses meaning
    # model: Optional[str] = Field(None, description="The model used to make the function call.")
    name: Optional[str] = Field(None, description="The name of the participant.")
    # NOTE: we probably shouldn't allow updating the created_at field, right?
    # created_at: Optional[datetime] = Field(None, description="The time the message was created.")
    tool_calls: Optional[List[OpenAIToolCall,]] = Field(None, description="The list of tool calls requested.")
    tool_call_id: Optional[str] = Field(None, description="The id of the tool call.")

    def model_dump(self, to_orm: bool = False, **kwargs) -> Dict[str, Any]:
        data = super().model_dump(**kwargs)
        if to_orm and "content" in data:
            if isinstance(data["content"], str):
                data["content"] = [TextContent(text=data["content"])]
        return data


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

    """

    id: str = BaseMessage.generate_id_field()
    role: MessageRole = Field(..., description="The role of the participant.")
    content: Optional[List[LettaMessageContentUnion]] = Field(None, description="The content of the message.")
    organization_id: Optional[str] = Field(None, description="The unique identifier of the organization.")
    agent_id: Optional[str] = Field(None, description="The unique identifier of the agent.")
    model: Optional[str] = Field(None, description="The model used to make the function call.")
    name: Optional[str] = Field(None, description="The name of the participant.")
    tool_calls: Optional[List[OpenAIToolCall]] = Field(None, description="The list of tool calls requested.")
    tool_call_id: Optional[str] = Field(None, description="The id of the tool call.")
    step_id: Optional[str] = Field(None, description="The id of the step that this message was created in.")
    otid: Optional[str] = Field(None, description="The offline threading id associated with this message")
    tool_returns: Optional[List[ToolReturn]] = Field(None, description="Tool execution return information for prior tool calls")
    group_id: Optional[str] = Field(None, description="The multi-agent group that the message was sent in")

    # This overrides the optional base orm schema, created_at MUST exist on all messages objects
    created_at: datetime = Field(default_factory=get_utc_time, description="The timestamp when the object was created.")

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        roles = ["system", "assistant", "user", "tool"]
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
        return json_message

    @staticmethod
    def to_letta_messages_from_list(
        messages: List[Message],
        use_assistant_message: bool = True,
        assistant_message_tool_name: str = DEFAULT_MESSAGE_TOOL,
        assistant_message_tool_kwarg: str = DEFAULT_MESSAGE_TOOL_KWARG,
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
            for msg in m.to_letta_message(
                use_assistant_message=use_assistant_message,
                assistant_message_tool_name=assistant_message_tool_name,
                assistant_message_tool_kwarg=assistant_message_tool_kwarg,
            )
        ]

    def to_letta_message(
        self,
        use_assistant_message: bool = False,
        assistant_message_tool_name: str = DEFAULT_MESSAGE_TOOL,
        assistant_message_tool_kwarg: str = DEFAULT_MESSAGE_TOOL_KWARG,
    ) -> List[LettaMessage]:
        """Convert message object (in DB format) to the style used by the original Letta API"""
        if self.content and len(self.content) == 1 and isinstance(self.content[0], TextContent):
            text_content = self.content[0].text
        else:
            text_content = None

        messages = []

        if self.role == MessageRole.assistant:
            if text_content is not None:
                # This is type InnerThoughts
                messages.append(
                    ReasoningMessage(
                        id=self.id,
                        date=self.created_at,
                        reasoning=text_content,
                    )
                )
            if self.tool_calls is not None:
                # This is type FunctionCall
                for tool_call in self.tool_calls:
                    # If we're supporting using assistant message,
                    # then we want to treat certain function calls as a special case
                    if use_assistant_message and tool_call.function.name == assistant_message_tool_name:
                        # We need to unpack the actual message contents from the function call
                        try:
                            func_args = json.loads(tool_call.function.arguments)
                            message_string = func_args[assistant_message_tool_kwarg]
                        except KeyError:
                            raise ValueError(f"Function call {tool_call.function.name} missing {assistant_message_tool_kwarg} argument")
                        messages.append(
                            AssistantMessage(
                                id=self.id,
                                date=self.created_at,
                                content=message_string,
                            )
                        )
                    else:
                        messages.append(
                            ToolCallMessage(
                                id=self.id,
                                date=self.created_at,
                                tool_call=ToolCall(
                                    name=tool_call.function.name,
                                    arguments=tool_call.function.arguments,
                                    tool_call_id=tool_call.id,
                                ),
                            )
                        )
        elif self.role == MessageRole.tool:
            # This is type ToolReturnMessage
            # Try to interpret the function return, recall that this is how we packaged:
            # def package_function_response(was_success, response_string, timestamp=None):
            #     formatted_time = get_local_time() if timestamp is None else timestamp
            #     packaged_message = {
            #         "status": "OK" if was_success else "Failed",
            #         "message": response_string,
            #         "time": formatted_time,
            #     }
            assert text_content is not None, self
            try:
                function_return = json.loads(text_content)
                status = function_return["status"]
                if status == "OK":
                    status_enum = "success"
                elif status == "Failed":
                    status_enum = "error"
                else:
                    raise ValueError(f"Invalid status: {status}")
            except json.JSONDecodeError:
                raise ValueError(f"Failed to decode function return: {text_content}")
            assert self.tool_call_id is not None
            messages.append(
                # TODO make sure this is what the API returns
                # function_return may not match exactly...
                ToolReturnMessage(
                    id=self.id,
                    date=self.created_at,
                    tool_return=text_content,
                    status=self.tool_returns[0].status if self.tool_returns else status_enum,
                    tool_call_id=self.tool_call_id,
                    stdout=self.tool_returns[0].stdout if self.tool_returns else None,
                    stderr=self.tool_returns[0].stderr if self.tool_returns else None,
                )
            )
        elif self.role == MessageRole.user:
            # This is type UserMessage
            assert text_content is not None, self
            message_str = unpack_message(text_content)
            messages.append(
                UserMessage(
                    id=self.id,
                    date=self.created_at,
                    content=message_str or text_content,
                )
            )
        elif self.role == MessageRole.system:
            # This is type SystemMessage
            assert text_content is not None, self
            messages.append(
                SystemMessage(
                    id=self.id,
                    date=self.created_at,
                    content=text_content,
                )
            )
        else:
            raise ValueError(self.role)

        return messages

    @staticmethod
    def dict_to_message(
        user_id: str,
        agent_id: str,
        openai_message_dict: dict,
        model: Optional[str] = None,  # model used to make function call
        allow_functions_style: bool = False,  # allow deprecated functions style?
        created_at: Optional[datetime] = None,
        id: Optional[str] = None,
        tool_returns: Optional[List[ToolReturn]] = None,
    ):
        """Convert a ChatCompletion message object into a Message object (synced to DB)"""
        if not created_at:
            # timestamp for creation
            created_at = get_utc_time()

        assert "role" in openai_message_dict, openai_message_dict
        assert "content" in openai_message_dict, openai_message_dict

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
                    content=[TextContent(text=openai_message_dict["content"])] if openai_message_dict["content"] else [],
                    name=openai_message_dict["name"] if "name" in openai_message_dict else None,
                    tool_calls=openai_message_dict["tool_calls"] if "tool_calls" in openai_message_dict else None,
                    tool_call_id=openai_message_dict["tool_call_id"] if "tool_call_id" in openai_message_dict else None,
                    created_at=created_at,
                    id=str(id),
                    tool_returns=tool_returns,
                )
            else:
                return Message(
                    agent_id=agent_id,
                    model=model,
                    # standard fields expected in an OpenAI ChatCompletion message object
                    role=MessageRole.tool,  # NOTE
                    content=[TextContent(text=openai_message_dict["content"])] if openai_message_dict["content"] else [],
                    name=openai_message_dict["name"] if "name" in openai_message_dict else None,
                    tool_calls=openai_message_dict["tool_calls"] if "tool_calls" in openai_message_dict else None,
                    tool_call_id=openai_message_dict["tool_call_id"] if "tool_call_id" in openai_message_dict else None,
                    created_at=created_at,
                    tool_returns=tool_returns,
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
                    content=[TextContent(text=openai_message_dict["content"])] if openai_message_dict["content"] else [],
                    name=openai_message_dict["name"] if "name" in openai_message_dict else None,
                    tool_calls=tool_calls,
                    tool_call_id=None,  # NOTE: None, since this field is only non-null for role=='tool'
                    created_at=created_at,
                    id=str(id),
                    tool_returns=tool_returns,
                )
            else:
                return Message(
                    agent_id=agent_id,
                    model=model,
                    # standard fields expected in an OpenAI ChatCompletion message object
                    role=MessageRole(openai_message_dict["role"]),
                    content=[TextContent(text=openai_message_dict["content"])] if openai_message_dict["content"] else [],
                    name=openai_message_dict["name"] if "name" in openai_message_dict else None,
                    tool_calls=tool_calls,
                    tool_call_id=None,  # NOTE: None, since this field is only non-null for role=='tool'
                    created_at=created_at,
                    tool_returns=tool_returns,
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
                    content=[TextContent(text=openai_message_dict["content"])] if openai_message_dict["content"] else [],
                    name=openai_message_dict["name"] if "name" in openai_message_dict else None,
                    tool_calls=tool_calls,
                    tool_call_id=openai_message_dict["tool_call_id"] if "tool_call_id" in openai_message_dict else None,
                    created_at=created_at,
                    id=str(id),
                    tool_returns=tool_returns,
                )
            else:
                return Message(
                    agent_id=agent_id,
                    model=model,
                    # standard fields expected in an OpenAI ChatCompletion message object
                    role=MessageRole(openai_message_dict["role"]),
                    content=[TextContent(text=openai_message_dict["content"])] if openai_message_dict["content"] else [],
                    name=openai_message_dict["name"] if "name" in openai_message_dict else None,
                    tool_calls=tool_calls,
                    tool_call_id=openai_message_dict["tool_call_id"] if "tool_call_id" in openai_message_dict else None,
                    created_at=created_at,
                    tool_returns=tool_returns,
                )

    def to_openai_dict_search_results(self, max_tool_id_length: int = TOOL_CALL_ID_MAX_LEN) -> dict:
        result_json = self.to_openai_dict()
        search_result_json = {"timestamp": self.created_at, "message": {"content": result_json["content"], "role": result_json["role"]}}
        return search_result_json

    def to_openai_dict(
        self,
        max_tool_id_length: int = TOOL_CALL_ID_MAX_LEN,
        put_inner_thoughts_in_kwargs: bool = False,
    ) -> dict:
        """Go from Message class to ChatCompletion message object"""

        # TODO change to pydantic casting, eg `return SystemMessageModel(self)`
        if self.content and len(self.content) == 1 and isinstance(self.content[0], TextContent):
            text_content = self.content[0].text
        else:
            text_content = None

        if self.role == "system":
            assert all([v is not None for v in [self.role]]), vars(self)
            openai_message = {
                "content": text_content,
                "role": self.role,
            }
            # Optional field, do not include if null
            if self.name is not None:
                openai_message["name"] = self.name

        elif self.role == "user":
            assert all([v is not None for v in [text_content, self.role]]), vars(self)
            openai_message = {
                "content": text_content,
                "role": self.role,
            }
            # Optional field, do not include if null
            if self.name is not None:
                openai_message["name"] = self.name

        elif self.role == "assistant":
            assert self.tool_calls is not None or text_content is not None
            openai_message = {
                "content": None if put_inner_thoughts_in_kwargs else text_content,
                "role": self.role,
            }
            # Optional fields, do not include if null
            if self.name is not None:
                openai_message["name"] = self.name
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
                if max_tool_id_length:
                    for tool_call_dict in openai_message["tool_calls"]:
                        tool_call_dict["id"] = tool_call_dict["id"][:max_tool_id_length]

        elif self.role == "tool":
            assert all([v is not None for v in [self.role, self.tool_call_id]]), vars(self)
            openai_message = {
                "content": text_content,
                "role": self.role,
                "tool_call_id": self.tool_call_id[:max_tool_id_length] if max_tool_id_length else self.tool_call_id,
            }

        else:
            raise ValueError(self.role)

        return openai_message

    def to_anthropic_dict(
        self,
        inner_thoughts_xml_tag="thinking",
        put_inner_thoughts_in_kwargs: bool = False,
    ) -> dict:
        """
        Convert to an Anthropic message dictionary

        Args:
            inner_thoughts_xml_tag (str): The XML tag to wrap around inner thoughts
        """
        if self.content and len(self.content) == 1 and isinstance(self.content[0], TextContent):
            text_content = self.content[0].text
        else:
            text_content = None

        def add_xml_tag(string: str, xml_tag: Optional[str]):
            # NOTE: Anthropic docs recommends using <thinking> tag when using CoT + tool use
            return f"<{xml_tag}>{string}</{xml_tag}" if xml_tag else string

        if self.role == "system":
            # NOTE: this is not for system instructions, but instead system "events"

            assert all([v is not None for v in [text_content, self.role]]), vars(self)
            # Two options here, we would use system.package_system_message,
            # or use a more Anthropic-specific packaging ie xml tags
            user_system_event = add_xml_tag(string=f"SYSTEM ALERT: {text_content}", xml_tag="event")
            anthropic_message = {
                "content": user_system_event,
                "role": "user",
            }

        elif self.role == "user":
            assert all([v is not None for v in [text_content, self.role]]), vars(self)
            anthropic_message = {
                "content": text_content,
                "role": self.role,
            }

        elif self.role == "assistant":
            assert self.tool_calls is not None or text_content is not None
            anthropic_message = {
                "role": self.role,
            }
            content = []
            # COT / reasoning / thinking
            if text_content is not None and not put_inner_thoughts_in_kwargs:
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
                        tool_call_input = json.loads(tool_call.function.arguments)

                    content.append(
                        {
                            "type": "tool_use",
                            "id": tool_call.id,
                            "name": tool_call.function.name,
                            "input": tool_call_input,
                        }
                    )

            # If the only content was text, unpack it back into a singleton
            # TODO support multi-modal
            anthropic_message["content"] = content

        elif self.role == "tool":
            # NOTE: Anthropic uses role "user" for "tool" responses
            assert all([v is not None for v in [self.role, self.tool_call_id]]), vars(self)
            anthropic_message = {
                "role": "user",  # NOTE: diff
                "content": [
                    # TODO support error types etc
                    {
                        "type": "tool_result",
                        "tool_use_id": self.tool_call_id,
                        "content": text_content,
                    }
                ],
            }

        else:
            raise ValueError(self.role)

        return anthropic_message

    def to_google_ai_dict(self, put_inner_thoughts_in_kwargs: bool = True) -> dict:
        """
        Go from Message class to Google AI REST message object
        """
        # type Content: https://ai.google.dev/api/rest/v1/Content / https://ai.google.dev/api/rest/v1beta/Content
        #     parts[]: Part
        #     role: str ('user' or 'model')
        if self.content and len(self.content) == 1 and isinstance(self.content[0], TextContent):
            text_content = self.content[0].text
        else:
            text_content = None

        if self.role != "tool" and self.name is not None:
            warnings.warn(f"Using Google AI with non-null 'name' field ({self.name}) not yet supported.")

        if self.role == "system":
            # NOTE: Gemini API doesn't have a 'system' role, use 'user' instead
            # https://www.reddit.com/r/Bard/comments/1b90i8o/does_gemini_have_a_system_prompt_option_while/
            google_ai_message = {
                "role": "user",  # NOTE: no 'system'
                "parts": [{"text": text_content}],
            }

        elif self.role == "user":
            assert all([v is not None for v in [text_content, self.role]]), vars(self)
            google_ai_message = {
                "role": "user",
                "parts": [{"text": text_content}],
            }

        elif self.role == "assistant":
            assert self.tool_calls is not None or text_content is not None
            google_ai_message = {
                "role": "model",  # NOTE: different
            }

            # NOTE: Google AI API doesn't allow non-null content + function call
            # To get around this, just two a two part message, inner thoughts first then
            parts = []
            if not put_inner_thoughts_in_kwargs and text_content is not None:
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
                        function_args = json.loads(function_args)
                    except:
                        raise UserWarning(f"Failed to parse JSON function args: {function_args}")
                        function_args = {"args": function_args}

                    if put_inner_thoughts_in_kwargs and text_content is not None:
                        assert "inner_thoughts" not in function_args, function_args
                        assert len(self.tool_calls) == 1
                        function_args[INNER_THOUGHTS_KWARG] = text_content

                    parts.append(
                        {
                            "functionCall": {
                                "name": function_name,
                                "args": function_args,
                            }
                        }
                    )
            else:
                assert text_content is not None
                parts.append({"text": text_content})
            google_ai_message["parts"] = parts

        elif self.role == "tool":
            # NOTE: Significantly different tool calling format, more similar to function calling format
            assert all([v is not None for v in [self.role, self.tool_call_id]]), vars(self)

            if self.name is None:
                warnings.warn(f"Couldn't find function name on tool call, defaulting to tool ID instead.")
                function_name = self.tool_call_id
            else:
                function_name = self.name

            # NOTE: Google AI API wants the function response as JSON only, no string
            try:
                function_response = json.loads(text_content)
            except:
                function_response = {"function_response": text_content}

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
            warnings.warn(f"Empty 'parts' detected in message with role '{self.role}'. Added default empty text part.")

        return google_ai_message

    def to_cohere_dict(
        self,
        function_call_role: Optional[str] = "SYSTEM",
        function_call_prefix: Optional[str] = "[CHATBOT called function]",
        function_response_role: Optional[str] = "SYSTEM",
        function_response_prefix: Optional[str] = "[CHATBOT function returned]",
        inner_thoughts_as_kwarg: Optional[bool] = False,
    ) -> List[dict]:
        """
        Cohere chat_history dicts only have 'role' and 'message' fields
        """

        # NOTE: returns a list of dicts so that we can convert:
        #  assistant [cot]: "I'll send a message"
        #  assistant [func]: send_message("hi")
        #  tool: {'status': 'OK'}
        # to:
        #  CHATBOT.text: "I'll send a message"
        #  SYSTEM.text: [CHATBOT called function] send_message("hi")
        #  SYSTEM.text: [CHATBOT function returned] {'status': 'OK'}

        # TODO: update this prompt style once guidance from Cohere on
        # embedded function calls in multi-turn conversation become more clear
        if self.content and len(self.content) == 1 and isinstance(self.content[0], TextContent):
            text_content = self.content[0].text
        else:
            text_content = None
        if self.role == "system":
            """
            The chat_history parameter should not be used for SYSTEM messages in most cases.
            Instead, to add a SYSTEM role message at the beginning of a conversation, the preamble parameter should be used.
            """
            raise UserWarning(f"role 'system' messages should go in 'preamble' field for Cohere API")

        elif self.role == "user":
            assert all([v is not None for v in [text_content, self.role]]), vars(self)
            cohere_message = [
                {
                    "role": "USER",
                    "message": text_content,
                }
            ]

        elif self.role == "assistant":
            # NOTE: we may break this into two message - an inner thought and a function call
            # Optionally, we could just make this a function call with the inner thought inside
            assert self.tool_calls is not None or text_content is not None

            if text_content and self.tool_calls:
                if inner_thoughts_as_kwarg:
                    raise NotImplementedError
                cohere_message = [
                    {
                        "role": "CHATBOT",
                        "message": text_content,
                    },
                ]
                for tc in self.tool_calls:
                    function_name = tc.function["name"]
                    function_args = json.loads(tc.function["arguments"])
                    function_args_str = ",".join([f"{k}={v}" for k, v in function_args.items()])
                    function_call_text = f"{function_name}({function_args_str})"
                    cohere_message.append(
                        {
                            "role": function_call_role,
                            "message": f"{function_call_prefix} {function_call_text}",
                        }
                    )
            elif not text_content and self.tool_calls:
                cohere_message = []
                for tc in self.tool_calls:
                    # TODO better way to pack?
                    function_call_text = json_dumps(tc.to_dict())
                    cohere_message.append(
                        {
                            "role": function_call_role,
                            "message": f"{function_call_prefix} {function_call_text}",
                        }
                    )
            elif text_content and not self.tool_calls:
                cohere_message = [
                    {
                        "role": "CHATBOT",
                        "message": text_content,
                    }
                ]
            else:
                raise ValueError("Message does not have content nor tool_calls")

        elif self.role == "tool":
            assert all([v is not None for v in [self.role, self.tool_call_id]]), vars(self)
            function_response_text = text_content
            cohere_message = [
                {
                    "role": function_response_role,
                    "message": f"{function_response_prefix} {function_response_text}",
                }
            ]

        else:
            raise ValueError(self.role)

        return cohere_message


class ToolReturn(BaseModel):
    status: Literal["success", "error"] = Field(..., description="The status of the tool call")
    stdout: Optional[List[str]] = Field(None, description="Captured stdout (e.g. prints, logs) from the tool invocation")
    stderr: Optional[List[str]] = Field(None, description="Captured stderr from the tool invocation")
