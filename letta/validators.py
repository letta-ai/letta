import re

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

PATH_VALIDATORS = {}
for primitive in primitives:
    PATH_VALIDATORS[primitive] = Path(
        description=f"The ID of the {primitive} in the format '{primitive}-<uuid4>'",
        pattern=PRIMITIVE_ID_PATTERNS[primitive].pattern,
        examples=[f"{primitive}-123e4567-e89b-42d3-8456-426614174000"],
        # len(agent) + len("-") + len(uuid4)
        min_length=len(primitive) + 1 + 36,
        max_length=len(primitive) + 1 + 36,
    )


def is_valid_id(primitive: str, id: str) -> bool:
    return PRIMITIVE_ID_PATTERNS[primitive].match(id) is not None
