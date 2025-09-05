from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, Field, field_validator

from openai import ResponseInputTextParam

class TextInputTypes(ResponseInputTextParam):
    pass

class FileInputTypes(ResponseInputFileParam): 
    pass

class ImageInputType(ResponseInputImageParam):
    pass

class AudioInputType(ResponseInputAudioParam):
    pass

class SystemMessage(BaseModel):
    content: str
    role: str = "system"
    name: Optional[str] = None


class UserMessage(BaseModel):
    content: Union[str, List[Message]]
    role: str = "user"
    name: Optional[str] = None


class DeveloperMessage(BaseModel):
    content: Union[str, List[Message]]
    role: str = "developer"
    name: Optional[str] = None



class AssistantMessage(Response):
    type: str
    id: str
    status: str
    content: Optional[str] = None
    role: str = "assistant"
    name: Optional[str] = None
    tool_calls: Optional[List[ToolCall]] = None




InputMessage = Union[]
InputTypes = Union[TextInputTypes | ImageInputType | FileInputType | AudioInputType]

class ChatCompletionRequest(BaseModel):
    # https://platform.openai.com/docs/api-reference/responses/create -> for docs

    background: Optional(Union[ bool | None]) = Field(default = false) # https://platform.openai.com/docs/guides/background
    conversation: Optional(Union[str | dict ] ) = Field(default = None ) # prob need to type dict ot be conversaiton history in response format
    include: Optional(Union[[] | None]) = Field(default = None)
    input:  Optional(Union[str | []]) #protected will this work? -> type this with all defined types
    # might need to update MessageContentType -> to support new params or message types in convo history




# role user is assumed if input is just a string -> where should i define this logic? prob in client