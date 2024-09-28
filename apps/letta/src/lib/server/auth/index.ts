'use server';
import type { ProviderUserPayload } from '$letta/types';
import { AgentRecipieVariant } from '$letta/types';
import {
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
import {
  createProjectDeployedAgentTemplateFromAgentTemplate,
  createProjectAgentTemplate,
} from '$letta/web-api/projects/projectsRouter';
import { createAgent } from '$letta/sdk/deployment/deploymentRouter';
import { generateSlug } from '$letta/server';

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
  firstProjectId: string;
  firstCreatedAgentId: string;
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
        name: userData.name,
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
      }),
    db.insert(lettaAPIKeys).values({
      name: `${userFullName}'s API Key`,
      organizationId,
      userId: createdUser.userId,
      apiKey,
    }),
  ]);

  const firstProjectId = project[0].projectId;

  const createdAgentTemplate = await createProjectAgentTemplate(
    {
      params: {
        projectId: firstProjectId,
      },
      body: {
        recipeId: AgentRecipieVariant.CUSTOMER_SUPPORT,
      },
    },
    {
      request: {
        $organizationIdOverride: organizationId,
      },
    }
  );

  if (createdAgentTemplate.status !== 201) {
    throw new Error('Failed to create testing agent');
  }

  const createdDeployedAgentTemplate =
    await createProjectDeployedAgentTemplateFromAgentTemplate(
      {
        body: {
          agentTemplateId: createdAgentTemplate.body.id,
        },
        params: {
          projectId: project[0].projectId,
        },
      },
      {
        request: {
          $organizationIdOverride: organizationId,
        },
      }
    );

  if (createdDeployedAgentTemplate.status !== 201) {
    throw new Error('Failed to create source agent');
  }

  await createAgent(
    {
      body: {
        deployedAgentTemplateKey: createdDeployedAgentTemplate.body.key,
        uniqueIdentifier: 'my-first-agent-in-production',
      },
    },
    {
      request: {
        organizationId,
      },
    }
  );

  return {
    user: {
      email: userData.email,
      name: userData.name,
      imageUrl: userData.imageUrl,
      id: createdUser.userId,
      organizationId: organizationId,
    },
    firstCreatedAgentId: createdAgentTemplate.body.id,
    firstProjectId,
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

interface NewUserDetails {
  firstProjectId: string;
  firstCreatedAgentId: string;
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
      firstProjectId: res.firstProjectId,
      firstCreatedAgentId: res.firstCreatedAgentId,
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
        location: `/projects/${newUserDetails.firstProjectId}/agents/${newUserDetails.firstCreatedAgentId}`,
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
