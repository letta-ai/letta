from datetime import datetime
from typing import Optional

from pydantic import ConfigDict, Field, model_validator
from typing_extensions import Self

from letta.constants import CORE_MEMORY_BLOCK_CHAR_LIMIT, DEFAULT_HUMAN_BLOCK_DESCRIPTION, DEFAULT_PERSONA_BLOCK_DESCRIPTION
from letta.schemas.letta_base import LettaBase

# block of the LLM context


class BaseBlock(LettaBase, validate_assignment=True):
    """Base block of the LLM context"""

    __id_prefix__ = "block"

    # data value
    value: str = Field(..., description="Value of the block.")
    limit: int = Field(CORE_MEMORY_BLOCK_CHAR_LIMIT, description="Character limit of the block.")

    project_id: Optional[str] = Field(None, description="The associated project id.")
    # template data (optional)
    template_name: Optional[str] = Field(None, description="Name of the block if it is a template.", alias="name")
    is_template: bool = Field(False, description="Whether the block is a template (e.g. saved human/persona options).")
    preserve_on_migration: Optional[bool] = Field(False, description="Preserve the block on template migration.")

    # context window label
    label: Optional[str] = Field(None, description="Label of the block (e.g. 'human', 'persona') in the context window.")

    # permissions of the agent
    read_only: bool = Field(False, description="Whether the agent has read-only access to the block.")

    # metadata
    description: Optional[str] = Field(None, description="Description of the block.")
    metadata: Optional[dict] = Field({}, description="Metadata of the block.")

    # def __len__(self):
    #     return len(self.value)

    model_config = ConfigDict(extra="ignore")  # Ignores extra fields

    @model_validator(mode="after")
    def verify_char_limit(self) -> Self:
        # self.limit can be None from
        if self.limit is not None and self.value and len(self.value) > self.limit:
            error_msg = f"Edit failed: Exceeds {self.limit} character limit (requested {len(self.value)}) - {str(self)}."
            raise ValueError(error_msg)

        return self

    def __setattr__(self, name, value):
        """Run validation if self.value is updated"""
        super().__setattr__(name, value)
        if name == "value":
            # run validation
            self.__class__.model_validate(self.model_dump(exclude_unset=True))


class Block(BaseBlock):
    """
    A Block represents a reserved section of the LLM's context window which is editable. `Block` objects contained in the `Memory` object, which is able to edit the Block values.

    Parameters:
        label (str): The label of the block (e.g. 'human', 'persona'). This defines a category for the block.
        value (str): The value of the block. This is the string that is represented in the context window.
        limit (int): The character limit of the block.
        is_template (bool): Whether the block is a template (e.g. saved human/persona options). Non-template blocks are not stored in the database and are ephemeral, while templated blocks are stored in the database.
        label (str): The label of the block (e.g. 'human', 'persona'). This defines a category for the block.
        template_name (str): The name of the block template (if it is a template).
        description (str): Description of the block.
        metadata (Dict): Metadata of the block.
        user_id (str): The unique identifier of the user associated with the block.
    """

    id: str = BaseBlock.generate_id_field()

    # default orm fields
    created_by_id: Optional[str] = Field(None, description="The id of the user that made this Block.")
    last_updated_by_id: Optional[str] = Field(None, description="The id of the user that last updated this Block.")


class FileBlock(Block):
    file_id: str = Field(..., description="Unique identifier of the file.")
    source_id: str = Field(..., description="Unique identifier of the source.")
    is_open: bool = Field(..., description="True if the agent currently has the file open.")
    last_accessed_at: Optional[datetime] = Field(
        default_factory=datetime.utcnow,
        description="UTC timestamp of the agent’s most recent access to this file. Any operations from the open, close, or search tools will update this field.",
    )


class Human(Block):
    """Human block of the LLM context"""

    label: str = "human"
    description: Optional[str] = Field(DEFAULT_HUMAN_BLOCK_DESCRIPTION, description="Description of the block.")


class Persona(Block):
    """Persona block of the LLM context"""

    label: str = "persona"
    description: Optional[str] = Field(DEFAULT_PERSONA_BLOCK_DESCRIPTION, description="Description of the block.")


DEFAULT_BLOCKS = [Human(value=""), Persona(value="")]


class BlockUpdate(BaseBlock):
    """Update a block"""

    limit: Optional[int] = Field(None, description="Character limit of the block.")
    value: Optional[str] = Field(None, description="Value of the block.")
    project_id: Optional[str] = Field(None, description="The associated project id.")

    model_config = ConfigDict(extra="ignore")  # Ignores extra fields


class CreateBlock(BaseBlock):
    """Create a block"""

    label: str = Field(..., description="Label of the block.")
    limit: int = Field(CORE_MEMORY_BLOCK_CHAR_LIMIT, description="Character limit of the block.")
    value: str = Field(..., description="Value of the block.")

    project_id: Optional[str] = Field(None, description="The associated project id.")
    # block templates
    is_template: bool = False
    template_name: Optional[str] = Field(None, description="Name of the block if it is a template.", alias="name")

    @model_validator(mode="before")
    @classmethod
    def ensure_value_is_string(cls, data):
        """Convert None value to empty string"""
        if data and isinstance(data, dict) and data.get("value") is None:
            data["value"] = ""
        return data


class CreateHuman(CreateBlock):
    """Create a human block"""

    label: str = "human"


class CreatePersona(CreateBlock):
    """Create a persona block"""

    label: str = "persona"


class CreateBlockTemplate(CreateBlock):
    """Create a block template"""

    is_template: bool = True


class CreateHumanBlockTemplate(CreateHuman):
    """Create a human block template"""

    is_template: bool = True
    label: str = "human"


class CreatePersonaBlockTemplate(CreatePersona):
    """Create a persona block template"""

    is_template: bool = True
    label: str = "persona"
