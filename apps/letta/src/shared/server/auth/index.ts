'use server';
import type { ProviderUserPayload } from '$letta/types';
import { db, organizations, users } from '@letta-web/database';
import { eq } from 'drizzle-orm';
import type { UserSession } from '$letta/types/user';

export async function createUserAndOrganization(
  userData: ProviderUserPayload
): Promise<UserSession> {
  const [createdOrg] = await db
    .insert(organizations)
    .values({
      name: `${userData.name}'s organization`,
    })
    .returning({ organizationId: organizations.id });

  const [createdUser] = await db
    .insert(users)
    .values({
      organizationId: createdOrg.organizationId,
      name: userData.name,
      imageUrl: userData.imageUrl,
      email: userData.email,
      providerId: userData.uniqueId,
      signupMethod: userData.provider,
    })
    .returning({ userId: users.id });

  return {
    email: userData.email,
    name: userData.name,
    imageUrl: userData.imageUrl,
    id: createdUser.userId,
    organizationId: createdOrg.organizationId,
  };
}

export async function findOrCreateUserAndOrganizationFromProviderLogin(
  userData: ProviderUserPayload
): Promise<UserSession> {
  const user = await db.query.users.findFirst({
    where: eq(users.providerId, userData.uniqueId),
  });

  if (!user) {
    return createUserAndOrganization(userData);
  }

  return {
    email: user.email,
    id: user.id,
    organizationId: user.organizationId,
    imageUrl: user.imageUrl,
    name: user.name,
  };
}
