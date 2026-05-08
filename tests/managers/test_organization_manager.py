import pytest

# Import shared fixtures and constants from conftest
from letta.constants import (
    DEFAULT_ORG_NAME,
)
from letta.schemas.organization import Organization as PydanticOrganization, OrganizationUpdate
from letta.server.server import SyncServer


# ======================================================================================================================
# Organization Manager Tests
# ======================================================================================================================
@pytest.mark.asyncio
async def test_list_organizations(server: SyncServer):
    # Create a new org and confirm that it is created correctly
    org_name = "test"
    org = await server.organization_manager.create_organization_async(pydantic_org=PydanticOrganization(name=org_name))

    orgs = await server.organization_manager.list_organizations_async()
    assert len(orgs) == 1
    assert orgs[0].name == org_name

    # Delete it after
    await server.organization_manager.delete_organization_by_id_async(org.id)
    orgs = await server.organization_manager.list_organizations_async()
    assert len(orgs) == 0


@pytest.mark.asyncio
async def test_create_default_organization(server: SyncServer):
    await server.organization_manager.create_default_organization_async()
    retrieved = await server.organization_manager.get_default_organization_async()
    assert retrieved.name == DEFAULT_ORG_NAME


@pytest.mark.asyncio
async def test_update_organization_name(server: SyncServer):
    org_name_a = "a"
    org_name_b = "b"
    org = await server.organization_manager.create_organization_async(pydantic_org=PydanticOrganization(name=org_name_a))
    assert org.name == org_name_a
    org = await server.organization_manager.update_organization_name_using_id_async(org_id=org.id, name=org_name_b)
    assert org.name == org_name_b


@pytest.mark.asyncio
async def test_update_organization_privileged_tools(server: SyncServer):
    org_name = "test"
    org = await server.organization_manager.create_organization_async(pydantic_org=PydanticOrganization(name=org_name))
    assert org.privileged_tools == False
    org = await server.organization_manager.update_organization_async(org_id=org.id, org_update=OrganizationUpdate(privileged_tools=True))
    assert org.privileged_tools == True


@pytest.mark.asyncio
async def test_list_organizations_pagination(server: SyncServer):
    await server.organization_manager.create_organization_async(pydantic_org=PydanticOrganization(name="a"))
    await server.organization_manager.create_organization_async(pydantic_org=PydanticOrganization(name="b"))

    orgs_x = await server.organization_manager.list_organizations_async(limit=1)
    assert len(orgs_x) == 1

    orgs_y = await server.organization_manager.list_organizations_async(after=orgs_x[0].id, limit=1)
    assert len(orgs_y) == 1
    assert orgs_y[0].name != orgs_x[0].name

    orgs = await server.organization_manager.list_organizations_async(after=orgs_y[0].id, limit=1)
    assert len(orgs) == 0
