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
import { LoginErrorsEnum } from '$letta/errors';
import {
  trackServerSideEvent,
  trackUserOnServer,
} from '@letta-web/analytics/server';
import { AnalyticsEvent } from '@letta-web/analytics';
import { jwtDecode } from 'jwt-decode';
import { AdminService } from '@letta-web/letta-agents-api';

function isLettaEmail(email: string) {
  return email.endsWith('@letta.com') || email.endsWith('@memgpt.ai');
}

async function handleLettaUserCreation() {
  // lookup letta admin organization
  const lettaOrg = await db.query.organizations.findFirst({
    where: eq(organizations.isAdmin, true),
  });

  let organizationId = lettaOrg?.id;
  let lettaOrganizationId = lettaOrg?.lettaAgentsId;

  if (!organizationId || !lettaOrganizationId) {
    const lettaAgentsOrganization = await AdminService.createOrganization({
      requestBody: {
        name: 'Letta',
      },
    });

    if (!lettaAgentsOrganization?.id) {
      throw new Error(
        'Failed to create organization from Letta Agents Service'
      );
    }

    // create letta admin organization
    const [{ organizationId: madeOrgId, lettaAgentsId: madeAgentOrgId }] =
      await db
        .insert(organizations)
        .values({
          name: 'Letta',
          isAdmin: true,
          lettaAgentsId: lettaAgentsOrganization.id,
        })
        .returning({
          organizationId: organizations.id,
          lettaAgentsId: organizations.lettaAgentsId,
        });

    organizationId = madeOrgId;
    lettaOrganizationId = madeAgentOrgId;
  }

  return {
    organizationId,
    lettaOrganizationId,
  };
}

async function createUserAndOrganization(
  userData: ProviderUserPayload
): Promise<UserSession> {
  let organizationId = '';
  let lettaOrganizationId = '';
  let isNewOrganization = false;

  if (isLettaEmail(userData.email)) {
    const createdLettaUser = await handleLettaUserCreation();

    organizationId = createdLettaUser.organizationId;
    lettaOrganizationId = createdLettaUser.lettaOrganizationId;
  } else {
    const organizationName = `${userData.name}'s organization`;

    const lettaAgentsOrganization = await AdminService.createOrganization({
      requestBody: {
        name: organizationName,
      },
    });

    if (!lettaAgentsOrganization?.id) {
      throw new Error(
        'Failed to create organization from Letta Agents Service'
      );
    }

    const [createdOrg] = await db
      .insert(organizations)
      .values({
        name: organizationName,
        lettaAgentsId: lettaAgentsOrganization.id,
      })
      .returning({ organizationId: organizations.id });

    isNewOrganization = true;
    organizationId = createdOrg.organizationId;
  }

  const lettaAgentsUser = await AdminService.createUser({
    requestBody: {
      name: userData.name,
      org_id: lettaOrganizationId,
    },
  });

  if (!lettaAgentsUser?.id) {
    // delete organization if user creation fails
    await Promise.all([
      AdminService.deleteOrganization({
        orgId: lettaOrganizationId,
      }),
      db.delete(organizations).where(eq(organizations.id, organizationId)),
    ]);

    throw new Error('Failed to create user from Letta Agents Service');
  }

  const apiKey = await generateAPIKey(organizationId);

  const [[createdUser]] = await Promise.all([
    db
      .insert(users)
      .values({
        organizationId,
        name: userData.name,
        lettaAgentsId: lettaAgentsUser.id,
        imageUrl: userData.imageUrl,
        email: userData.email,
        providerId: userData.uniqueId,
        signupMethod: userData.provider,
      })
      .returning({ userId: users.id }),
  ]);

  if (isNewOrganization) {
    await Promise.all([
      db.insert(lettaAPIKeys).values({
        name: 'Default API key',
        organizationId,
        userId: createdUser.userId,
        apiKey,
      }),
      db.insert(projects).values({
        organizationId,
        name: 'My first project',
      }),
    ]);
  }

  return {
    email: userData.email,
    name: userData.name,
    imageUrl: userData.imageUrl,
    id: createdUser.userId,
    organizationId: organizationId,
  };
}

async function findExistingUser(
  userData: ProviderUserPayload
): Promise<UserSession | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.providerId, userData.uniqueId),
  });

  if (!user) {
    return null;
  }

  return {
    email: user.email,
    id: user.id,
    organizationId: user.organizationId,
    imageUrl: user.imageUrl,
    name: user.name,
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

  let isNewUser = false;
  let user = await findExistingUser(userData);

  if (!user) {
    isNewUser = true;
    user = await createUserAndOrganization(userData);
  }

  trackUserOnServer({
    userId: user.id,
    name: user.name,
    email: user.email,
  });

  if (isNewUser) {
    trackServerSideEvent(AnalyticsEvent.USER_CREATED, {
      userId: user.id,
    });
  } else {
    trackServerSideEvent(AnalyticsEvent.USER_LOGGED_IN, {
      userId: user.id,
    });
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
    columns: {
      organizationId: true,
      id: true,
      lettaAgentsId: true,
      email: true,
      imageUrl: true,
      name: true,
    },
  });

  if (!userFromDb) {
    redirect('/signout');
    return;
  }

  return userFromDb;
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

interface GoogleJWTResponse {
  iss: string;
  azp: string;
  aud: string;
  sub: string;
  hd: string;
  email: string;
  email_verified: boolean;
  at_hash: string;
  name: string;
  picture: string;
  given_name: string;
  family_name: string;
  iat: number;
  exp: number;
}

export async function extractGoogleIdTokenData(
  idToken: string
): Promise<ProviderUserPayload> {
  const decodedData = jwtDecode<GoogleJWTResponse>(idToken);

  return {
    email: decodedData.email,
    uniqueId: `google-${decodedData.sub}`,
    provider: 'google',
    imageUrl: decodedData.picture,
    name: decodedData.name,
  };
}
