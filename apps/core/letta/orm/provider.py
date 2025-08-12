from typing import TYPE_CHECKING

from sqlalchemy import UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from letta.orm.mixins import OrganizationMixin
from letta.orm.sqlalchemy_base import SqlalchemyBase
from letta.schemas.providers import Provider as PydanticProvider

if TYPE_CHECKING:
    from letta.orm.organization import Organization


class Provider(SqlalchemyBase, OrganizationMixin):
    """Provider ORM class"""

    __tablename__ = "providers"
    __pydantic_model__ = PydanticProvider
    __table_args__ = (
        UniqueConstraint(
            "name",
            "organization_id",
            name="unique_name_organization_id",
        ),
    )

    name: Mapped[str] = mapped_column(nullable=False, doc="The name of the provider")
    provider_type: Mapped[str] = mapped_column(nullable=True, doc="The type of the provider")
    provider_category: Mapped[str] = mapped_column(nullable=True, doc="The category of the provider (base or byok)")
    api_key: Mapped[str] = mapped_column(nullable=True, doc="API key or secret key used for requests to the provider.")
    base_url: Mapped[str] = mapped_column(nullable=True, doc="Base URL for the provider.")
    access_key: Mapped[str] = mapped_column(nullable=True, doc="Access key used for requests to the provider.")
    region: Mapped[str] = mapped_column(nullable=True, doc="Region used for requests to the provider.")
    api_version: Mapped[str] = mapped_column(nullable=True, doc="API version used for requests to the provider.")

    # relationships
    organization: Mapped["Organization"] = relationship("Organization", back_populates="providers")
