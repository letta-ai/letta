'use server';
import type { ProviderUserPayload } from '$letta/types';
import {
  db,
  emailWhitelist,
  lettaAPIKeys,
  organizations,
  projects,
  users,
} from '@letta-web/database';
import { and, eq } from 'drizzle-orm';
import type { UserSession } from '$letta/types/user';
import { deleteCookie, getCookie, setCookie } from '$letta/server/cookies';
import { deleteRedisData, getRedisData, setRedisData } from '@letta-web/redis';
import { CookieNames } from '$letta/server/cookies/types';
import { redirect } from 'next/navigation';
import { LoginErrorsEnum } from '$letta/any/errors';
import { TsRestResponse } from '@ts-rest/serverless/next.cjs';

function isLettaEmail(email: string) {
  return email.endsWith('@letta.com') || email.endsWith('@memgpt.ai');
}

async function handleLettaUserCreation() {
  // lookup letta admin organization
  const lettaOrg = await db.query.organizations.findFirst({
    where: eq(organizations.isAdmin, true),
  });

  let organizationId = lettaOrg?.id;

  if (!organizationId) {
    // create letta admin organization
    const [{ organizationId: madeOrgId }] = await db
      .insert(organizations)
      .values({
        name: 'Letta',
        isAdmin: true,
      })
      .returning({ organizationId: organizations.id });

    organizationId = madeOrgId;
  }

  return organizationId;
}

async function createUserAndOrganization(
  userData: ProviderUserPayload
): Promise<UserSession> {
  let organizationId = '';

  if (isLettaEmail(userData.email)) {
    organizationId = await handleLettaUserCreation();
  } else {
    const [createdOrg] = await db
      .insert(organizations)
      .values({
        name: `${userData.name}'s organization`,
      })
      .returning({ organizationId: organizations.id });

    organizationId = createdOrg.organizationId;
  }

  const apiKey = await generateAPIKey(organizationId);

  const [[createdUser]] = await Promise.all([
    db
      .insert(users)
      .values({
        organizationId,
        name: userData.name,
        imageUrl: userData.imageUrl,
        email: userData.email,
        providerId: userData.uniqueId,
        signupMethod: userData.provider,
      })
      .returning({ userId: users.id }),
    db.insert(projects).values({
      organizationId,
      name: 'My first project',
    }),
  ]);

  await db.insert(lettaAPIKeys).values({
    name: 'Default API key',
    organizationId,
    userId: createdUser.userId,
    apiKey,
  });

  return {
    email: userData.email,
    name: userData.name,
    imageUrl: userData.imageUrl,
    id: createdUser.userId,
    organizationId: organizationId,
  };
}

async function isUserInWhitelist(email: string) {
  // some hardcoding to allow letta and memgpt.ai emails bypass the whitelist
  if (isLettaEmail(email)) {
    return true;
  }

  const exists = await db.query.emailWhitelist.findFirst({
    where: eq(emailWhitelist.email, email),
  });

  return !!exists;
}

async function findOrCreateUserAndOrganizationFromProviderLogin(
  userData: ProviderUserPayload
): Promise<UserSession> {
  if (!(await isUserInWhitelist(userData.email))) {
    throw new Error(LoginErrorsEnum.USER_NOT_IN_WHITELIST);
  }

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

export async function getOrganizationFromOrganizationId(
  organizationId: string
) {
  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });

  return organization;
}

export async function getUser() {
  const session = await getCookie(CookieNames.LETTA_SESSION);

  if (!session) {
    return null;
  }

  const user = await getRedisData('userSession', session.sessionId);

  if (!user) {
    redirect('/signout');
    return null;
  }

  const userFromDb = await db.query.users.findFirst({
    where: eq(users.id, user.id),
  });

  if (!userFromDb) {
    redirect('/signout');
    return;
  }

  return user;
}

export async function getUserOrganizationIdOrThrow() {
  const user = await getUser();

  if (!user) {
    throw new Error('User not found');
  }

  return user.organizationId;
}

export async function generateAPIKey(organizationId: string) {
  const apiKey = crypto.randomUUID();

  return btoa(`${organizationId}:${apiKey}`);
}

export async function parseAccessToken(accessToken: string) {
  const [organizationId, accessPassword] = atob(accessToken).split(':');

  return {
    organizationId,
    accessPassword,
  };
}

export async function verifyAndReturnAPIKeyDetails(apiKey?: string) {
  if (!apiKey) {
    return null;
  }

  const { organizationId } = await parseAccessToken(apiKey);

  const key = await db.query.lettaAPIKeys.findFirst({
    where: and(
      eq(lettaAPIKeys.apiKey, apiKey),
      eq(lettaAPIKeys.organizationId, organizationId)
    ),
    columns: {
      organizationId: true,
      userId: true,
    },
  });

  if (!key) {
    return null;
  }

  return key;
}
