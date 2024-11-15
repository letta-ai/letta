'use server';
import {
  db,
  organizations,
  organizationUsers,
  users,
} from '@letta-web/database';
import { eq } from 'drizzle-orm';

export async function deleteUser(userId: string) {
  if (!userId) {
    return;
  }

  const organizationsThisUserIsIn = await db.query.organizationUsers.findMany({
    where: eq(organizationUsers.userId, userId),
  });

  // return organizations where user is sole member
  const organizationsIdsToDelete = [];

  for (const org of organizationsThisUserIsIn) {
    const orgUsers = await db.query.organizationUsers.findMany({
      where: eq(organizationUsers.organizationId, org.organizationId),
      limit: 2,
    });

    if (orgUsers.length === 1) {
      organizationsIdsToDelete.push(org.organizationId);
    }
  }

  // delete organizations
  await Promise.all(
    organizationsIdsToDelete.map(async (orgId) => {
      await db.delete(organizations).where(eq(organizations.id, orgId));
    })
  );

  // delete user
  await db.delete(users).where(eq(users.id, userId));
}
