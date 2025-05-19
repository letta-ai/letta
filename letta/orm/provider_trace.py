import uuid

from sqlalchemy import JSON, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from letta.orm.mixins import OrganizationMixin
from letta.orm.sqlalchemy_base import SqlalchemyBase
from letta.schemas.provider_trace import ProviderTrace as PydanticProviderTrace


class ProviderTrace(SqlalchemyBase, OrganizationMixin):
    """Defines data model for storing provider trace information"""

    __tablename__ = "provider_traces"
    __pydantic_model__ = PydanticProviderTrace
    __table_args__ = (Index("ix_step_id", "step_id"),)

    id: Mapped[str] = mapped_column(
        primary_key=True, doc="Unique provider trace identifier", default=lambda: f"provider_trace-{uuid.uuid4()}"
    )
    request_json: Mapped[dict] = mapped_column(JSON, doc="JSON content of the provider request")
    response_json: Mapped[dict] = mapped_column(JSON, doc="JSON content of the provider response")
    step_id: Mapped[str] = mapped_column(String, nullable=True, doc="ID of the step that this trace is associated with")

    # Relationships
    organization: Mapped["Organization"] = relationship("Organization", lazy="selectin")
