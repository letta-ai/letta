from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field

from letta.helpers.datetime_helpers import get_utc_time
from letta.schemas.enums import PrimitiveType
from letta.schemas.letta_base import OrmMetadataBase


class BaseProviderTrace(OrmMetadataBase):
    __id_prefix__ = PrimitiveType.PROVIDER_TRACE.value


class ProviderTraceCreate(BaseModel):
    """Request to create a provider trace"""

    request_json: dict[str, Any] = Field(..., description="JSON content of the provider request")
    response_json: dict[str, Any] = Field(..., description="JSON content of the provider response")
    step_id: str = Field(None, description="ID of the step that this trace is associated with")


class ProviderTrace(BaseProviderTrace):
    """
    Letta's internal representation of a provider trace.

    Attributes:
        id (str): The unique identifier of the provider trace.
        request_json (Dict[str, Any]): JSON content of the provider request.
        response_json (Dict[str, Any]): JSON content of the provider response.
        step_id (str): ID of the step that this trace is associated with.
        organization_id (str): The unique identifier of the organization.
        created_at (datetime): The timestamp when the object was created.
    """

    id: str = BaseProviderTrace.generate_id_field()
    request_json: Dict[str, Any] = Field(..., description="JSON content of the provider request")
    response_json: Dict[str, Any] = Field(..., description="JSON content of the provider response")
    step_id: Optional[str] = Field(None, description="ID of the step that this trace is associated with")
    created_at: datetime = Field(default_factory=get_utc_time, description="The timestamp when the object was created.")
