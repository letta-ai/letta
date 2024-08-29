'use server';
import type { ProviderUserPayload } from '$letta/types';
import { db, organizations, users } from '@letta-web/database';
import { eq } from 'drizzle-orm';
import type { UserSession } from '$letta/types/user';
import { deleteCookie, getCookie, setCookie } from '$letta/server/cookies';
import { deleteRedisData, getRedisData, setRedisData } from '@letta-web/redis';
import { CookieNames } from '$letta/server/cookies/types';

async function createUserAndOrganization(
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

async function findOrCreateUserAndOrganizationFromProviderLogin(
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

const SESSION_EXPIRY_MS = 31536000000; // one year

export async function signInUserFromProviderLogin(
  userData: ProviderUserPayload
) {
  const user = await findOrCreateUserAndOrganizationFromProviderLogin(userData);

  const sessionId = crypto.randomUUID();
  const expires = Date.now() + SESSION_EXPIRY_MS;

  await setCookie(CookieNames.LETTA_SESSION, {
    sessionId,
    expires,
  });

  await setRedisData('userSession', sessionId, {
    expiresAt: expires,
    data: user,
  });
}

export async function signOutUser() {
  const session = await getCookie(CookieNames.LETTA_SESSION);

  if (!session) {
    return;
  }

  await deleteCookie(CookieNames.LETTA_SESSION);

  await deleteRedisData('userSession', session.sessionId);
}

export async function getUser() {
  const session = await getCookie(CookieNames.LETTA_SESSION);

  if (!session) {
    return null;
  }

  const user = await getRedisData('userSession', session.sessionId);

  if (!user) {
    await signOutUser();
    return null;
  }

  return user;
}
