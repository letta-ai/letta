from pydantic import Field

from letta.schemas.letta_base import OrmMetadataBase


class Prompt(OrmMetadataBase):
    id: str = Field(..., description="The id of the agent. Assigned by the database.")
    project_id: str | None = Field(None, description="The associated project id.")
    prompt: str = Field(..., description="The string contents of the prompt.")
