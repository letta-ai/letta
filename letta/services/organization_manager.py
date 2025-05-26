from typing import List, Optional

from letta.orm.errors import NoResultFound
from letta.orm.organization import Organization as OrganizationModel
from letta.schemas.organization import Organization as PydanticOrganization
from letta.schemas.organization import OrganizationUpdate
from letta.server.db import db_registry
from letta.tracing import trace_method
from letta.utils import enforce_types


class OrganizationManager:
    """Manager class to handle business logic related to Organizations."""

    DEFAULT_ORG_ID = "org-00000000-0000-4000-8000-000000000000"
    DEFAULT_ORG_NAME = "default_org"

    @enforce_types
    @trace_method
    def get_default_organization(self) -> PydanticOrganization:
        """Fetch the default organization."""
        return self.get_organization_by_id(self.DEFAULT_ORG_ID)

    @enforce_types
    @trace_method
    def get_organization_by_id(self, org_id: str) -> Optional[PydanticOrganization]:
        """Fetch an organization by ID."""
        with db_registry.session() as session:
            organization = OrganizationModel.read(db_session=session, identifier=org_id)
            return organization.to_pydantic()

    @enforce_types
    @trace_method
    def create_organization(self, pydantic_org: PydanticOrganization) -> PydanticOrganization:
        """Create a new organization."""
        try:
            org = self.get_organization_by_id(pydantic_org.id)
            return org
        except NoResultFound:
            return self._create_organization(pydantic_org=pydantic_org)

    @enforce_types
    @trace_method
    def _create_organization(self, pydantic_org: PydanticOrganization) -> PydanticOrganization:
        with db_registry.session() as session:
            org = OrganizationModel(**pydantic_org.model_dump(to_orm=True))
            org.create(session)
            return org.to_pydantic()

    @enforce_types
    @trace_method
    def create_default_organization(self) -> PydanticOrganization:
        """Create the default organization."""
        return self.create_organization(PydanticOrganization(name=self.DEFAULT_ORG_NAME, id=self.DEFAULT_ORG_ID))

    @enforce_types
    @trace_method
    def update_organization_name_using_id(self, org_id: str, name: Optional[str] = None) -> PydanticOrganization:
        """Update an organization."""
        with db_registry.session() as session:
            org = OrganizationModel.read(db_session=session, identifier=org_id)
            if name:
                org.name = name
            org.update(session)
            return org.to_pydantic()

    @enforce_types
    @trace_method
    def update_organization(self, org_id: str, org_update: OrganizationUpdate) -> PydanticOrganization:
        """Update an organization."""
        with db_registry.session() as session:
            org = OrganizationModel.read(db_session=session, identifier=org_id)
            if org_update.name:
                org.name = org_update.name
            if org_update.privileged_tools:
                org.privileged_tools = org_update.privileged_tools
            org.update(session)
            return org.to_pydantic()

    @enforce_types
    @trace_method
    def delete_organization_by_id(self, org_id: str):
        """Delete an organization by marking it as deleted."""
        with db_registry.session() as session:
            organization = OrganizationModel.read(db_session=session, identifier=org_id)
            organization.hard_delete(session)

    @enforce_types
    @trace_method
    def list_organizations(self, after: Optional[str] = None, limit: Optional[int] = 50) -> List[PydanticOrganization]:
        """List all organizations with optional pagination."""
        with db_registry.session() as session:
            organizations = OrganizationModel.list(
                db_session=session,
                after=after,
                limit=limit,
            )
            return [org.to_pydantic() for org in organizations]
