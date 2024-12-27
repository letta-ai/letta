import { db, organizations } from '@letta-web/database';
import { and, eq, isNull } from 'drizzle-orm';

export async function getOrganizationFromOrganizationId(
  organizationId: string,
) {
  const organization = await db.query.organizations.findFirst({
    where: and(
      eq(organizations.id, organizationId),
      isNull(organizations.deletedAt),
    ),
  });

  return organization;
}
