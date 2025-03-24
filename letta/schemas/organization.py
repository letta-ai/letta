from datetime import datetime
from typing import Optional

from pydantic import Field

from letta.helpers.datetime_helpers import get_utc_time
from letta.schemas.letta_base import LettaBase
from letta.utils import create_random_username


class OrganizationBase(LettaBase):
    __id_prefix__ = "org"


class Organization(OrganizationBase):
    id: str = OrganizationBase.generate_id_field()
    name: str = Field(create_random_username(), description="The name of the organization.", json_schema_extra={"default": "SincereYogurt"})
    created_at: Optional[datetime] = Field(default_factory=get_utc_time, description="The creation date of the organization.")
    privileged_tools: bool = Field(False, description="Whether the organization has access to privileged tools.")


class OrganizationCreate(OrganizationBase):
    name: Optional[str] = Field(None, description="The name of the organization.")
    privileged_tools: Optional[bool] = Field(False, description="Whether the organization has access to privileged tools.")


class OrganizationUpdate(OrganizationBase):
    name: Optional[str] = Field(None, description="The name of the organization.")
    privileged_tools: Optional[bool] = Field(False, description="Whether the organization has access to privileged tools.")
