import { db, organizationUsers } from '@letta-cloud/service-database';
import { and, eq } from 'drizzle-orm';

export function getOrganizationUser(userId: string, orgId: string) {
  return db.query.organizationUsers.findFirst({
    where: and(
      eq(organizationUsers.userId, userId),
      eq(organizationUsers.organizationId, orgId),
    ),
  });
}
