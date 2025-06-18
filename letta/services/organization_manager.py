from typing import List, Optional

from letta.constants import DEFAULT_ORG_ID, DEFAULT_ORG_NAME
from letta.orm.errors import NoResultFound
from letta.orm.organization import Organization as OrganizationModel
from letta.otel.tracing import trace_method
from letta.schemas.organization import Organization as PydanticOrganization
from letta.schemas.organization import OrganizationUpdate
from letta.server.db import db_registry
from letta.utils import enforce_types


class OrganizationManager:
    """Manager class to handle business logic related to Organizations."""

    @enforce_types
    @trace_method
    async def get_default_organization_async(self) -> PydanticOrganization:
        """Fetch the default organization."""
        return await self.get_organization_by_id_async(DEFAULT_ORG_ID)

    @enforce_types
    @trace_method
    def get_organization_by_id(self, org_id: str) -> Optional[PydanticOrganization]:
        """Fetch an organization by ID."""
        with db_registry.session() as session:
            organization = OrganizationModel.read(db_session=session, identifier=org_id)
            return organization.to_pydantic()

    @enforce_types
    @trace_method
    async def get_organization_by_id_async(self, org_id: str) -> Optional[PydanticOrganization]:
        """Fetch an organization by ID."""
        async with db_registry.async_session() as session:
            organization = await OrganizationModel.read_async(db_session=session, identifier=org_id)
            return organization.to_pydantic()

    @enforce_types
    @trace_method
    def create_organization(self, pydantic_org: PydanticOrganization) -> PydanticOrganization:
        """Create the default organization."""
        with db_registry.session() as session:
            try:
                organization = OrganizationModel.read(db_session=session, identifier=pydantic_org.id)
                return organization.to_pydantic()
            except:
                organization = OrganizationModel(**pydantic_org.model_dump(to_orm=True))
                organization = organization.create(session)
                return organization.to_pydantic()

    @enforce_types
    @trace_method
    async def create_organization_async(self, pydantic_org: PydanticOrganization) -> PydanticOrganization:
        """Create a new organization."""
        try:
            org = await self.get_organization_by_id_async(pydantic_org.id)
            return org
        except NoResultFound:
            return await self._create_organization_async(pydantic_org=pydantic_org)

    @enforce_types
    @trace_method
    async def _create_organization_async(self, pydantic_org: PydanticOrganization) -> PydanticOrganization:
        async with db_registry.async_session() as session:
            org = OrganizationModel(**pydantic_org.model_dump(to_orm=True))
            await org.create_async(session)
            return org.to_pydantic()

    @enforce_types
    @trace_method
    def create_default_organization(self) -> PydanticOrganization:
        """Create the default organization."""
        pydantic_org = PydanticOrganization(name=DEFAULT_ORG_NAME, id=DEFAULT_ORG_ID)
        return self.create_organization(pydantic_org)

    @enforce_types
    @trace_method
    async def create_default_organization_async(self) -> PydanticOrganization:
        """Create the default organization."""
        return await self.create_organization_async(PydanticOrganization(name=DEFAULT_ORG_NAME, id=DEFAULT_ORG_ID))

    @enforce_types
    @trace_method
    async def update_organization_name_using_id_async(self, org_id: str, name: Optional[str] = None) -> PydanticOrganization:
        """Update an organization."""
        async with db_registry.async_session() as session:
            org = await OrganizationModel.read_async(db_session=session, identifier=org_id)
            if name:
                org.name = name
            await org.update_async(session)
            return org.to_pydantic()

    @enforce_types
    @trace_method
    async def update_organization_async(self, org_id: str, org_update: OrganizationUpdate) -> PydanticOrganization:
        """Update an organization."""
        async with db_registry.async_session() as session:
            org = await OrganizationModel.read_async(db_session=session, identifier=org_id)
            if org_update.name:
                org.name = org_update.name
            if org_update.privileged_tools:
                org.privileged_tools = org_update.privileged_tools
            await org.update_async(session)
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
    async def delete_organization_by_id_async(self, org_id: str):
        """Delete an organization by marking it as deleted."""
        async with db_registry.async_session() as session:
            organization = await OrganizationModel.read_async(db_session=session, identifier=org_id)
            await organization.hard_delete_async(session)

    @enforce_types
    @trace_method
    async def list_organizations_async(self, after: Optional[str] = None, limit: Optional[int] = 50) -> List[PydanticOrganization]:
        """List all organizations with optional pagination."""
        async with db_registry.async_session() as session:
            organizations = await OrganizationModel.list_async(
                db_session=session,
                after=after,
                limit=limit,
            )
            return [org.to_pydantic() for org in organizations]
