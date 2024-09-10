import { db, lettaAPIKeys } from '@letta-web/database';
import { getUserOrganizationIdOrThrow } from '$letta/server/auth';
import type { ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '$letta/web-api/contracts';
import { eq } from 'drizzle-orm';

type GetCurrentOrganizationResponse = ServerInferResponses<
  typeof contracts.organizations.getCurrentOrganization
>;

export async function getCurrentOrganization(): Promise<GetCurrentOrganizationResponse> {
  const organizationId = await getUserOrganizationIdOrThrow();

  const organization = await db.query.organizations.findFirst({
    where: eq(lettaAPIKeys.id, organizationId),
  });

  if (!organization) {
    throw new Error('Organization not found');
  }

  return {
    status: 200,
    body: {
      id: organization.id,
      name: organization.name,
      isAdmin: organization.isAdmin,
      createdAt: organization.createdAt.toISOString(),
      updatedAt: organization.updatedAt.toISOString(),
    },
  };
}
