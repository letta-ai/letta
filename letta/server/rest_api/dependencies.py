from typing import TYPE_CHECKING, Optional

from fastapi import Header
from pydantic import BaseModel

from letta.errors import LettaInvalidArgumentError
from letta.otel.tracing import tracer
from letta.schemas.enums import PrimitiveType
from letta.schemas.provider_trace import BillingContext
from letta.validators import PRIMITIVE_ID_PATTERNS

if TYPE_CHECKING:
    from letta.server.server import SyncServer


class ExperimentalParams(BaseModel):
    """Experimental parameters used across REST API endpoints."""

    message_async: Optional[bool] = None
    letta_v1_agent: Optional[bool] = None
    letta_v1_agent_message_async: Optional[bool] = None
    modal_sandbox: Optional[bool] = None


class HeaderParams(BaseModel):
    """Common header parameters used across REST API endpoints."""

    actor_id: Optional[str] = None
    user_agent: Optional[str] = None
    project_id: Optional[str] = None
    letta_source: Optional[str] = None
    sdk_version: Optional[str] = None
    experimental_params: Optional[ExperimentalParams] = None
    billing_context: Optional[BillingContext] = None


def get_headers(
    actor_id: Optional[str] = Header(None, alias="user_id"),
    user_agent: Optional[str] = Header(None, alias="User-Agent"),
    project_id: Optional[str] = Header(None, alias="X-Project-Id"),
    letta_source: Optional[str] = Header(None, alias="X-Letta-Source", include_in_schema=False),
    sdk_version: Optional[str] = Header(None, alias="X-Stainless-Package-Version", include_in_schema=False),
    message_async: Optional[str] = Header(None, alias="X-Experimental-Message-Async", include_in_schema=False),
    letta_v1_agent: Optional[str] = Header(None, alias="X-Experimental-Letta-V1-Agent", include_in_schema=False),
    letta_v1_agent_message_async: Optional[str] = Header(
        None, alias="X-Experimental-Letta-V1-Agent-Message-Async", include_in_schema=False
    ),
    modal_sandbox: Optional[str] = Header(None, alias="X-Experimental-Modal-Sandbox", include_in_schema=False),
    billing_plan_type: Optional[str] = Header(None, alias="X-Billing-Plan-Type", include_in_schema=False),
    billing_cost_source: Optional[str] = Header(None, alias="X-Billing-Cost-Source", include_in_schema=False),
    billing_customer_id: Optional[str] = Header(None, alias="X-Billing-Customer-Id", include_in_schema=False),
) -> HeaderParams:
    """Dependency injection function to extract common headers from requests."""
    with tracer.start_as_current_span("dependency.get_headers"):
        if actor_id is not None and PRIMITIVE_ID_PATTERNS[PrimitiveType.USER.value].match(actor_id) is None:
            raise LettaInvalidArgumentError(
                message=(f"Invalid user ID format: {actor_id}. Expected format: '{PrimitiveType.USER.value}-<uuid4>'"),
                argument_name="user_id",
            )

        return HeaderParams(
            actor_id=actor_id,
            user_agent=user_agent,
            project_id=project_id,
            letta_source=letta_source,
            sdk_version=sdk_version,
            experimental_params=ExperimentalParams(
                message_async=(message_async == "true") if message_async else None,
                letta_v1_agent=(letta_v1_agent == "true") if letta_v1_agent else None,
                letta_v1_agent_message_async=(letta_v1_agent_message_async == "true") if letta_v1_agent_message_async else None,
                modal_sandbox=(modal_sandbox == "true") if modal_sandbox else None,
            ),
            billing_context=BillingContext(
                plan_type=billing_plan_type,
                cost_source=billing_cost_source,
                customer_id=billing_customer_id,
            )
            if any([billing_plan_type, billing_cost_source, billing_customer_id])
            else None,
        )


# TODO: why does this double up the interface?
async def get_letta_server() -> "SyncServer":
    with tracer.start_as_current_span("dependency.get_letta_server"):
        # Check if a global server is already instantiated
        from letta.server.rest_api.app import server

        # assert isinstance(server, SyncServer)
        return server
