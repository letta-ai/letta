'use server';
import {
  db,
  organizations,
  organizationUsers,
} from '@letta-cloud/service-database';
import { and, eq, sql, not } from 'drizzle-orm';
import { swapUserOrganization } from '$web/server/auth/lib/swapUserOrganization/swapUserOrganization';
import { AdminService } from '@letta-cloud/sdk-core';

export async function deleteOrganization(organizationId: string) {
  if (!organizationId) {
    return;
  }

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });

  if (!organization) {
    return;
  }

  // find users in organization
  const organizationUsersInOrg = await db.execute<{
    user_id: string;
    organization_id: string;
    core_user_id: string;
    core_organization_id: string;
  }>(sql`SELECT DISTINCT ou1.user_id,
                         ou1.organization_id,
                         u.letta_agents_id as core_user_id,
                         o.letta_agents_id as core_organization_id
         FROM organization_users ou1
                  JOIN users u ON ou1.user_id = u.id
                  JOIN organizations o ON ou1.organization_id = o.id
         WHERE ou1.organization_id = ${organizationId}
           AND EXISTS (SELECT 1
                       FROM organization_users ou2
                       WHERE ou2.user_id = ou1.user_id
                         AND ou2.organization_id != ou1.organization_id);`);

  await Promise.all(
    organizationUsersInOrg.map(async (orgUser) => {
      // find a different organization for the user
      const otherOrganization = await db.query.organizationUsers.findFirst({
        where: and(
          not(eq(organizationUsers.organizationId, orgUser.organization_id)),
          eq(organizationUsers.userId, orgUser.user_id),
        ),
        with: {
          organization: {
            columns: {
              lettaAgentsId: true,
            },
          },
        },
      });

      if (!otherOrganization) {
        throw new Error('No other organization found for user');
      }

      await swapUserOrganization({
        userId: orgUser.user_id,
        coreUserId: orgUser.core_user_id,
        organizationId: orgUser.organization_id,
        coreOrganizationId: otherOrganization.organization.lettaAgentsId,
      });
    }),
  );

  // delete organization
  await db.delete(organizations).where(eq(organizations.id, organizationId));
  await AdminService.deleteOrganizationById({
    orgId: organization.lettaAgentsId,
  });
}
