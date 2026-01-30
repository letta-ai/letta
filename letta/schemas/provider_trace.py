from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import Field

from letta.helpers.datetime_helpers import get_utc_time
from letta.schemas.enums import PrimitiveType
from letta.schemas.letta_base import OrmMetadataBase


class BaseProviderTrace(OrmMetadataBase):
    __id_prefix__ = PrimitiveType.PROVIDER_TRACE.value


class ProviderTrace(BaseProviderTrace):
    """
    Letta's internal representation of a provider trace.

    Attributes:
        id (str): The unique identifier of the provider trace.
        request_json (Dict[str, Any]): JSON content of the provider request.
        response_json (Dict[str, Any]): JSON content of the provider response.
        step_id (str): ID of the step that this trace is associated with.
        agent_id (str): ID of the agent that generated this trace.
        agent_tags (list[str]): Tags associated with the agent for filtering.
        call_type (str): Type of call (agent_step, summarization, etc.).
        run_id (str): ID of the run this trace is associated with.
        source (str): Source service that generated this trace (memgpt-server, lettuce-py).
        organization_id (str): The unique identifier of the organization.
        user_id (str): The unique identifier of the user who initiated the request.
        compaction_settings (Dict[str, Any]): Compaction/summarization settings (only for summarization calls).
        llm_config (Dict[str, Any]): LLM configuration used for this call (only for non-summarization calls).
        created_at (datetime): The timestamp when the object was created.
    """

    id: str = BaseProviderTrace.generate_id_field()
    request_json: Dict[str, Any] = Field(..., description="JSON content of the provider request")
    response_json: Dict[str, Any] = Field(..., description="JSON content of the provider response")
    step_id: Optional[str] = Field(None, description="ID of the step that this trace is associated with")

    # Telemetry context fields
    agent_id: Optional[str] = Field(None, description="ID of the agent that generated this trace")
    agent_tags: Optional[list[str]] = Field(None, description="Tags associated with the agent for filtering")
    call_type: Optional[str] = Field(None, description="Type of call (agent_step, summarization, etc.)")
    run_id: Optional[str] = Field(None, description="ID of the run this trace is associated with")
    source: Optional[str] = Field(None, description="Source service that generated this trace (memgpt-server, lettuce-py)")

    # v2 protocol fields
    org_id: Optional[str] = Field(None, description="ID of the organization")
    user_id: Optional[str] = Field(None, description="ID of the user who initiated the request")
    compaction_settings: Optional[Dict[str, Any]] = Field(None, description="Compaction/summarization settings (summarization calls only)")
    llm_config: Optional[Dict[str, Any]] = Field(None, description="LLM configuration used for this call (non-summarization calls only)")

    created_at: datetime = Field(default_factory=get_utc_time, description="The timestamp when the object was created.")


class ProviderTraceMetadata(BaseProviderTrace):
    """Metadata-only representation of a provider trace (no request/response JSON)."""

    id: str = BaseProviderTrace.generate_id_field()
    step_id: Optional[str] = Field(None, description="ID of the step that this trace is associated with")

    # Telemetry context fields
    agent_id: Optional[str] = Field(None, description="ID of the agent that generated this trace")
    agent_tags: Optional[list[str]] = Field(None, description="Tags associated with the agent for filtering")
    call_type: Optional[str] = Field(None, description="Type of call (agent_step, summarization, etc.)")
    run_id: Optional[str] = Field(None, description="ID of the run this trace is associated with")
    source: Optional[str] = Field(None, description="Source service that generated this trace (memgpt-server, lettuce-py)")

    # v2 protocol fields
    org_id: Optional[str] = Field(None, description="ID of the organization")
    user_id: Optional[str] = Field(None, description="ID of the user who initiated the request")

    created_at: datetime = Field(default_factory=get_utc_time, description="The timestamp when the object was created.")
