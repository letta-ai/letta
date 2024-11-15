import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '$letta/web-api/contracts';
import { db, organizations } from '@letta-web/database';
import { eq, like } from 'drizzle-orm';

/* Get Organizations */
type GetOrganizationsResponse = ServerInferResponses<
  typeof contracts.admin.organizations.getOrganizations
>;

type GetOrganizationsQuery = ServerInferRequest<
  typeof contracts.admin.organizations.getOrganizations
>;

async function getOrganizations(
  req: GetOrganizationsQuery
): Promise<GetOrganizationsResponse> {
  const { offset, limit = 10, search } = req.query;
  const where = search ? like(organizations.name, search) : undefined;

  const response = await db.query.organizations.findMany({
    offset,
    limit: limit + 1,
    where: where,
  });

  return {
    status: 200,
    body: {
      organizations: response.slice(0, limit).map((organization) => ({
        id: organization.id,
        name: organization.name,
        createdAt: organization.createdAt.toISOString(),
        updatedAt: organization.updatedAt.toISOString(),
      })),
      hasNextPage: response.length > limit,
    },
  };
}

/* Get Organization */
type GetOrganizationResponse = ServerInferResponses<
  typeof contracts.admin.organizations.getOrganization
>;

type GetOrganizationRequest = ServerInferRequest<
  typeof contracts.admin.organizations.getOrganization
>;

async function getOrganization(
  req: GetOrganizationRequest
): Promise<GetOrganizationResponse> {
  const { organizationId } = req.params;

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });

  if (!organization) {
    return {
      status: 404,
      body: {
        message: 'Organization not found',
      },
    };
  }

  return {
    status: 200,
    body: {
      id: organization.id,
      name: organization.name,
      lettaAgentsId: organization.lettaAgentsId,
      enabledCloudAt: organization.enabledCloudAt?.toISOString() ?? null,
      createdAt: organization.createdAt.toISOString(),
      updatedAt: organization.updatedAt.toISOString(),
    },
  };
}

/* Toggle Cloud for Organization */
type ToggleCloudOrganizationRequest = ServerInferRequest<
  typeof contracts.admin.organizations.toggleCloudOrganization
>;

type ToggleCloudOrganizationResponse = ServerInferResponses<
  typeof contracts.admin.organizations.toggleCloudOrganization
>;

async function toggleCloudOrganization(
  req: ToggleCloudOrganizationRequest
): Promise<ToggleCloudOrganizationResponse> {
  const { organizationId } = req.params;
  const { enabledCloud } = req.body;

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });

  if (!organization) {
    return {
      status: 404,
      body: {
        message: 'Organization not found',
      },
    };
  }

  await db
    .update(organizations)
    .set({
      enabledCloudAt: enabledCloud ? new Date() : null,
    })
    .where(eq(organizations.id, organizationId));

  return {
    status: 200,
    body: {
      id: organization.id,
      name: organization.name,
      lettaAgentsId: organization.lettaAgentsId,
      enabledCloudAt: enabledCloud ? new Date().toISOString() : null,
      createdAt: organization.createdAt.toISOString(),
      updatedAt: organization.updatedAt.toISOString(),
    },
  };
}


export const adminOrganizationsRouter = {
  getOrganizations,
  getOrganization,
  toggleCloudOrganization,
};
