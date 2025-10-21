import re
from typing import Annotated

from fastapi import Path

from letta.schemas.agent import AgentState
from letta.schemas.archive import ArchiveBase
from letta.schemas.block import BaseBlock
from letta.schemas.file import FileMetadataBase
from letta.schemas.folder import BaseFolder
from letta.schemas.group import GroupBase
from letta.schemas.identity import IdentityBase
from letta.schemas.job import JobBase
from letta.schemas.message import BaseMessage
from letta.schemas.providers import ProviderBase
from letta.schemas.run import RunBase
from letta.schemas.sandbox_config import SandboxConfigBase
from letta.schemas.source import BaseSource
from letta.schemas.step import StepBase
from letta.schemas.tool import BaseTool

# TODO: extract this list from routers/v1/__init__.py and ROUTERS
primitives = [
    AgentState.__id_prefix__,
    BaseMessage.__id_prefix__,
    RunBase.__id_prefix__,
    JobBase.__id_prefix__,
    GroupBase.__id_prefix__,
    BaseBlock.__id_prefix__,
    FileMetadataBase.__id_prefix__,
    BaseFolder.__id_prefix__,
    BaseSource.__id_prefix__,
    BaseTool.__id_prefix__,
    ArchiveBase.__id_prefix__,
    ProviderBase.__id_prefix__,
    SandboxConfigBase.__id_prefix__,
    StepBase.__id_prefix__,
    IdentityBase.__id_prefix__,
]


PRIMITIVE_ID_PATTERNS = {
    # f-string interpolation gets confused because of the regex's required curly braces {}
    primitive: re.compile("^" + primitive + "-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
    for primitive in primitives
}


def _create_path_validator_factory(primitive: str):
    """
    Creates a factory function that returns a fresh Path validator.

    This avoids shared state issues when the same validator is used
    across multiple endpoints with different parameter names.
    """

    def factory():
        return Path(
            description=f"The ID of the {primitive} in the format '{primitive}-<uuid4>'",
            pattern=PRIMITIVE_ID_PATTERNS[primitive].pattern,
            examples=[f"{primitive}-123e4567-e89b-42d3-8456-426614174000"],
            min_length=len(primitive) + 1 + 36,
            max_length=len(primitive) + 1 + 36,
        )

    return factory


# PATH_VALIDATORS now contains factory functions, not Path objects
# Usage: folder_id: str = PATH_VALIDATORS[BaseFolder.__id_prefix__]()
PATH_VALIDATORS = {primitive: _create_path_validator_factory(primitive) for primitive in primitives}


def is_valid_id(primitive: str, id: str) -> bool:
    return PRIMITIVE_ID_PATTERNS[primitive].match(id) is not None


# Type aliases for common ID types
# These can be used directly in route handler signatures for cleaner code
AgentId = Annotated[str, PATH_VALIDATORS[AgentState.__id_prefix__]()]
ToolId = Annotated[str, PATH_VALIDATORS[BaseTool.__id_prefix__]()]
SourceId = Annotated[str, PATH_VALIDATORS[BaseSource.__id_prefix__]()]
BlockId = Annotated[str, PATH_VALIDATORS[BaseBlock.__id_prefix__]()]
MessageId = Annotated[str, PATH_VALIDATORS[BaseMessage.__id_prefix__]()]
RunId = Annotated[str, PATH_VALIDATORS[RunBase.__id_prefix__]()]
JobId = Annotated[str, PATH_VALIDATORS[JobBase.__id_prefix__]()]
GroupId = Annotated[str, PATH_VALIDATORS[GroupBase.__id_prefix__]()]
FileId = Annotated[str, PATH_VALIDATORS[FileMetadataBase.__id_prefix__]()]
FolderId = Annotated[str, PATH_VALIDATORS[BaseFolder.__id_prefix__]()]
ArchiveId = Annotated[str, PATH_VALIDATORS[ArchiveBase.__id_prefix__]()]
ProviderId = Annotated[str, PATH_VALIDATORS[ProviderBase.__id_prefix__]()]
SandboxConfigId = Annotated[str, PATH_VALIDATORS[SandboxConfigBase.__id_prefix__]()]
StepId = Annotated[str, PATH_VALIDATORS[StepBase.__id_prefix__]()]
IdentityId = Annotated[str, PATH_VALIDATORS[IdentityBase.__id_prefix__]()]
