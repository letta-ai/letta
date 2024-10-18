'use server';
import type { ProviderUserPayload } from '$letta/types';
import { AgentRecipeVariant } from '$letta/types';
import {
  adePreferences,
  db,
  emailWhitelist,
  lettaAPIKeys,
  organizationPreferences,
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
import { createAgent, versionAgentTemplate } from '$letta/sdk';
import { generateSlug } from '$letta/server';
import { generateDefaultADELayout } from '$letta/utils';
import { cookies } from 'next/headers';

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

    await db.insert(organizationPreferences).values({
      organizationId: madeOrgId,
    });

    organizationId = madeOrgId;
    lettaOrganizationId = madeAgentOrgId;
  }

  return {
    organizationId,
    lettaOrganizationId,
  };
}

interface CreateUserAndOrganizationResponse {
  user: UserSession;
  firstProjectSlug: string;
  firstCreatedAgentName: string;
}

async function createUserAndOrganization(
  userData: ProviderUserPayload
): Promise<CreateUserAndOrganizationResponse> {
  let organizationId = '';
  let lettaOrganizationId = '';

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

    await db.insert(organizationPreferences).values({
      organizationId: createdOrg.organizationId,
    });

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
        name: userData.name || 'New User',
        lettaAgentsId: lettaAgentsUser.id,
        imageUrl: userData.imageUrl,
        email: userData.email,
        providerId: userData.uniqueId,
        signupMethod: userData.provider,
      })
      .returning({ userId: users.id }),
  ]);

  const userFullName = userData.name;

  const projectName = `${userFullName}'s Project`;

  const [project] = await Promise.all([
    db
      .insert(projects)
      .values({
        slug: generateSlug(projectName),
        organizationId,
        name: projectName,
      })
      .returning({
        projectId: projects.id,
        slug: projects.slug,
      }),
    db.insert(lettaAPIKeys).values({
      name: `${userFullName}'s API Key`,
      organizationId,
      userId: createdUser.userId,
      apiKey,
    }),
  ]);

  const firstProjectSlug = project[0].slug;

  const createdAgentTemplate = await createAgent(
    {
      body: {
        template: true,
        project_id: project[0].projectId,
        from_template: AgentRecipeVariant.CUSTOMER_SUPPORT,
      },
    },
    {
      request: {
        lettaAgentsUserId: lettaAgentsUser.id,
        userId: createdUser.userId,
        organizationId,
      },
    }
  );

  if (createdAgentTemplate.status !== 201 || !createdAgentTemplate.body.id) {
    throw new Error(JSON.stringify(createdAgentTemplate.body, null, 2));
  }

  const [versionedAgentTemplate] = await Promise.all([
    await versionAgentTemplate(
      {
        params: {
          agent_id: createdAgentTemplate.body.id,
        },
        query: {},
      },
      {
        request: {
          userId: createdUser.userId,
          organizationId,
          lettaAgentsUserId: lettaAgentsUser.id,
        },
      }
    ),
    db.insert(adePreferences).values({
      userId: createdUser.userId,
      displayConfig: generateDefaultADELayout().displayConfig,
      agentId: createdAgentTemplate.body.id,
    }),
  ]);

  if (versionedAgentTemplate.status !== 201) {
    throw new Error('Failed to create source agent');
  }

  await createAgent(
    {
      body: {
        from_template: versionedAgentTemplate.body.version,
        name: `${createdAgentTemplate.body.name}-deployed-1`,
      },
    },
    {
      request: {
        organizationId,
        userId: createdUser.userId,
        lettaAgentsUserId: lettaAgentsUser.id,
      },
    }
  );

  return {
    user: {
      email: userData.email,
      theme: 'light',
      name: userData.name,
      imageUrl: userData.imageUrl,
      id: createdUser.userId,
      organizationId: organizationId,
    },
    firstCreatedAgentName: createdAgentTemplate.body.name,
    firstProjectSlug: firstProjectSlug,
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
    theme: user.theme || 'light',
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

interface NewUserDetails {
  firstProjectSlug: string;
  firstCreatedAgentName: string;
}

interface FindOrCreateUserAndOrganizationFromProviderLoginResponse {
  user: UserSession;
  newUserDetails: NewUserDetails | undefined;
}

async function findOrCreateUserAndOrganizationFromProviderLogin(
  userData: ProviderUserPayload
): Promise<FindOrCreateUserAndOrganizationFromProviderLoginResponse> {
  if (!(await isUserInWhitelist(userData.email))) {
    throw new Error(LoginErrorsEnum.USER_NOT_IN_WHITELIST);
  }

  let newUserDetails: NewUserDetails | undefined;
  let user = await findExistingUser(userData);

  if (!user) {
    const res = await createUserAndOrganization(userData);

    newUserDetails = {
      firstProjectSlug: res.firstProjectSlug,
      firstCreatedAgentName: res.firstCreatedAgentName,
    };
    user = res.user;
  }

  trackUserOnServer({
    userId: user.id,
    name: user.name,
    email: user.email,
  });

  if (newUserDetails) {
    trackServerSideEvent(AnalyticsEvent.USER_CREATED, {
      userId: user.id,
    });
  } else {
    trackServerSideEvent(AnalyticsEvent.USER_LOGGED_IN, {
      userId: user.id,
    });
  }

  return {
    user: {
      theme: user.theme,
      email: user.email,
      id: user.id,
      organizationId: user.organizationId,
      imageUrl: user.imageUrl,
      name: user.name,
    },
    newUserDetails,
  };
}

const SESSION_EXPIRY_MS = 31536000000; // one year

interface SignInUserFromProviderLoginResponse {
  newUserDetails: NewUserDetails | undefined;
  user: UserSession;
}

export async function signInUserFromProviderLogin(
  userData: ProviderUserPayload
): Promise<SignInUserFromProviderLoginResponse> {
  const { user, newUserDetails } =
    await findOrCreateUserAndOrganizationFromProviderLogin(userData);

  const sessionId = crypto.randomUUID();
  const expires = Date.now() + SESSION_EXPIRY_MS;

  await setCookie(CookieNames.LETTA_SESSION, {
    sessionId,
    expires,
  });

  cookies().set(CookieNames.THEME, user.theme);

  await setRedisData('userSession', sessionId, {
    expiresAt: expires,
    data: user,
  });

  return {
    newUserDetails,
    user,
  };
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

export interface GetUserDataResponse {
  organizationId: string;
  id: string;
  lettaAgentsId: string;
  email: string;
  imageUrl: string;
  theme: string;
  name: string;
}

export async function getUser(): Promise<GetUserDataResponse | null> {
  const session = await getCookie(CookieNames.LETTA_SESSION);

  if (!session) {
    return null;
  }

  const user = await getRedisData('userSession', session.sessionId);

  if (!user) {
    return null;
  }

  const userFromDb = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: {
      organizationId: true,
      id: true,
      lettaAgentsId: true,
      email: true,
      theme: true,
      imageUrl: true,
      name: true,
    },
  });

  if (!userFromDb) {
    return null;
  }

  return {
    ...userFromDb,
    theme: userFromDb.theme || 'light',
  };
}

export async function getUserOrRedirect() {
  const user = await getUser();

  if (!user) {
    redirect('/signout');
    return null;
  }

  return user;
}

export async function getUserOrThrow(): Promise<GetUserDataResponse> {
  const user = await getUser();

  if (!user) {
    throw new Error('User not found');
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

export async function getUserIdOrThrow() {
  const user = await getUser();

  if (!user) {
    throw new Error('User not found');
  }

  return user.id;
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

  let organizationId = '';

  try {
    const { organizationId: orgId } = await parseAccessToken(apiKey);
    organizationId = orgId;
  } catch (_e) {
    return null;
  }

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
  name?: string;
  picture?: string;
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
    imageUrl: decodedData.picture || '',
    name: decodedData.name || '',
  };
}

interface GenerateRedirectSignatureForLoggedInUserOptions {
  newUserDetails?: NewUserDetails | undefined;
}

export async function generateRedirectSignatureForLoggedInUser(
  options: GenerateRedirectSignatureForLoggedInUserOptions
) {
  const { newUserDetails } = options;

  if (newUserDetails) {
    return new Response('Successfully signed in', {
      status: 302,
      headers: {
        location: `/projects/${newUserDetails.firstProjectSlug}/templates/${newUserDetails.firstCreatedAgentName}`,
      },
    });
  }

  return new Response('Successfully signed in', {
    status: 302,
    headers: {
      location: '/',
    },
  });
}
