from typing import Optional

from pydantic import Field, model_validator
from typing_extensions import Self

from letta.schemas.letta_base import LettaBase

# block of the LLM context


class BaseBlock(LettaBase, validate_assignment=True):
    """Base block of the LLM context"""

    __id_prefix__ = "block"

    # data value
    value: str = Field(..., description="Value of the block.")
    limit: int = Field(2000, description="Character limit of the block.")

    # template data (optional)
    template_name: Optional[str] = Field(None, description="Name of the block if it is a template.", alias="name")
    is_template: bool = Field(False, description="Whether the block is a template (e.g. saved human/persona options).")

    # context window label
    label: Optional[str] = Field(None, description="Label of the block (e.g. 'human', 'persona') in the context window.")

    # metadata
    description: Optional[str] = Field(None, description="Description of the block.")
    metadata_: Optional[dict] = Field({}, description="Metadata of the block.")

    @model_validator(mode="after")
    def verify_char_limit(self) -> Self:
        try:
            assert len(self) <= self.limit
        except AssertionError:
            error_msg = f"Edit failed: Exceeds {self.limit} character limit (requested {len(self)}) - {str(self)}."
            raise ValueError(error_msg)
        except Exception as e:
            raise e
        return self

    def __len__(self):
        return len(self.value)

    def __setattr__(self, name, value):
        """Run validation if self.value is updated"""
        super().__setattr__(name, value)
        if name == "value":
            # run validation
            self.__class__.model_validate(self.model_dump(exclude_unset=True))

    class Config:
        extra = "ignore"  # Ignores extra fields


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
        metadata_ (Dict): Metadata of the block.
        user_id (str): The unique identifier of the user associated with the block.
    """

    id: str = BaseBlock.generate_id_field()

    # associated user/agent
    organization_id: Optional[str] = Field(None, description="The unique identifier of the organization associated with the block.")

    # default orm fields
    created_by_id: Optional[str] = Field(None, description="The id of the user that made this Block.")
    last_updated_by_id: Optional[str] = Field(None, description="The id of the user that last updated this Block.")


class Human(Block):
    """Human block of the LLM context"""

    label: str = "human"


class Persona(Block):
    """Persona block of the LLM context"""

    label: str = "persona"


class BlockCreate(BaseBlock):
    """Create a block"""

    is_template: bool = True
    label: str = Field(..., description="Label of the block.")


class CreatePersona(BlockCreate):
    """Create a persona block"""

    label: str = "persona"


class CreateHuman(BlockCreate):
    """Create a human block"""

    label: str = "human"


class BlockUpdate(BaseBlock):
    """Update a block"""

    limit: Optional[int] = Field(2000, description="Character limit of the block.")
    value: Optional[str] = Field(None, description="Value of the block.")

    class Config:
        extra = "ignore"  # Ignores extra fields


class UpdatePersona(BlockUpdate):
    """Update a persona block"""

    label: str = "persona"


class UpdateHuman(BlockUpdate):
    """Update a human block"""

    label: str = "human"
