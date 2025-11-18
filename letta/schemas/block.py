from datetime import datetime
from typing import Any, Optional

from pydantic import ConfigDict, Field, model_validator

from letta.constants import CORE_MEMORY_BLOCK_CHAR_LIMIT, DEFAULT_HUMAN_BLOCK_DESCRIPTION, DEFAULT_PERSONA_BLOCK_DESCRIPTION
from letta.schemas.enums import PrimitiveType
from letta.schemas.letta_base import LettaBase

# block of the LLM context


class BaseBlock(LettaBase, validate_assignment=True):
    """Base block of the LLM context"""

    __id_prefix__ = PrimitiveType.BLOCK.value

    # data value
    value: str = Field(..., description="Value of the block.")
    limit: int = Field(CORE_MEMORY_BLOCK_CHAR_LIMIT, description="Character limit of the block.")

    project_id: Optional[str] = Field(None, description="The associated project id.")
    # template data (optional)
    template_name: Optional[str] = Field(None, description="Name of the block if it is a template.")
    is_template: bool = Field(False, description="Whether the block is a template (e.g. saved human/persona options).")
    template_id: Optional[str] = Field(None, description="The id of the template.")
    base_template_id: Optional[str] = Field(None, description="The base template id of the block.")
    deployment_id: Optional[str] = Field(None, description="The id of the deployment.")
    entity_id: Optional[str] = Field(None, description="The id of the entity within the template.")
    preserve_on_migration: Optional[bool] = Field(False, description="Preserve the block on template migration.")

    # context window label
    label: Optional[str] = Field(None, description="Label of the block (e.g. 'human', 'persona') in the context window.")

    # permissions of the agent
    read_only: bool = Field(False, description="Whether the agent has read-only access to the block.")

    # metadata
    description: Optional[str] = Field(None, description="Description of the block.")
    metadata: Optional[dict] = Field({}, description="Metadata of the block.")
    hidden: Optional[bool] = Field(
        None,
        description="If set to True, the block will be hidden.",
    )

    # def __len__(self):
    #     return len(self.value)

    model_config = ConfigDict(extra="ignore")  # Ignores extra fields

    @model_validator(mode="before")
    @classmethod
    def verify_char_limit(cls, data: Any) -> Any:
        """Validate the character limit before model instantiation.

        Notes:
        - Runs on raw input; do not mutate input.
        - For update schemas (e.g., BlockUpdate), `value` and `limit` may be absent.
          In that case, only validate when both are provided.
        """
        if isinstance(data, dict):
            limit = data.get("limit")
            value = data.get("value")

            # Only enforce the char limit when both are present.
            # Pydantic will separately enforce required fields where applicable.
            if limit is not None and value is not None and isinstance(value, str):
                if len(value) > limit:
                    error_msg = f"Edit failed: Exceeds {limit} character limit (requested {len(value)})"
                    raise ValueError(error_msg)

        return data

    def __setattr__(self, name, value):
        """Run validation if self.value is updated"""
        super().__setattr__(name, value)
        if name == "value":
            # run validation
            self.__class__.model_validate(self.model_dump(exclude_unset=True))


class Block(BaseBlock):
    """A Block represents a reserved section of the LLM's context window."""

    id: str = BaseBlock.generate_id_field()

    # default orm fields
    created_by_id: Optional[str] = Field(None, description="The id of the user that made this Block.")
    last_updated_by_id: Optional[str] = Field(None, description="The id of the user that last updated this Block.")


class BlockResponse(Block):
    id: str = Field(
        ...,
        description="The id of the block.",
    )
    template_name: Optional[str] = Field(
        None, description="(Deprecated) The name of the block template (if it is a template).", deprecated=True
    )
    template_id: Optional[str] = Field(None, description="(Deprecated) The id of the template.", deprecated=True)
    base_template_id: Optional[str] = Field(None, description="(Deprecated) The base template id of the block.", deprecated=True)
    deployment_id: Optional[str] = Field(None, description="(Deprecated) The id of the deployment.", deprecated=True)
    entity_id: Optional[str] = Field(None, description="(Deprecated) The id of the entity within the template.", deprecated=True)
    preserve_on_migration: Optional[bool] = Field(
        False, description="(Deprecated) Preserve the block on template migration.", deprecated=True
    )
    read_only: bool = Field(False, description="(Deprecated) Whether the agent has read-only access to the block.", deprecated=True)
    hidden: Optional[bool] = Field(None, description="(Deprecated) If set to True, the block will be hidden.", deprecated=True)


class FileBlock(Block):
    file_id: str = Field(..., description="Unique identifier of the file.")
    source_id: str = Field(..., description="Unique identifier of the source.")
    is_open: bool = Field(..., description="True if the agent currently has the file open.")
    last_accessed_at: Optional[datetime] = Field(
        None,
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
    template_name: Optional[str] = Field(None, description="Name of the block if it is a template.")

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


class InternalTemplateBlockCreate(CreateBlock):
    """Used for Letta Cloud"""

    base_template_id: str = Field(..., description="The id of the base template.")
    template_id: str = Field(..., description="The id of the template.")
    deployment_id: str = Field(..., description="The id of the deployment.")
    entity_id: str = Field(..., description="The id of the entity within the template.")
