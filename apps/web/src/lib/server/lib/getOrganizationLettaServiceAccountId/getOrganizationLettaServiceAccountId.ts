import { db, organizations } from '@letta-cloud/service-database';
import { eq } from 'drizzle-orm';
import { AdminService } from '@letta-cloud/sdk-core';

export async function getOrganizationLettaServiceAccountId(
  organizationId: string,
) {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
    columns: {
      lettaServiceAccountId: true,
      lettaAgentsId: true,
    },
  });

  if (!org) {
    throw new Error('Organization not found');
  }

  if (!org.lettaServiceAccountId) {
    const account = await AdminService.createUser({
      requestBody: {
        organization_id: org.lettaAgentsId,
        name: 'Service Account',
      },
    });

    await db
      .update(organizations)
      .set({
        lettaServiceAccountId: account.id,
      })
      .where(eq(organizations.id, organizationId));

    return account.id;
  }

  return org.lettaServiceAccountId;
}
