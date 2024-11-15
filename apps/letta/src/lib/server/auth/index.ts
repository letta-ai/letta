'use server';
import type { ProviderUserPayload } from '$letta/types';
import { AgentRecipeVariant } from '$letta/types';
import {
  adePreferences,
  db,
  emailWhitelist,
  lettaAPIKeys,
  organizationInvitedUsers,
  organizationPreferences,
  organizations,
  organizationUsers,
  projects,
  users,
} from '@letta-web/database';
import { and, eq, isNull } from 'drizzle-orm';
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
import { AdminService, ToolsService } from '@letta-web/letta-agents-api';
import { createAgent, versionAgentTemplate } from '$letta/sdk';
import { generateDefaultADELayout } from '$letta/utils';
import { cookies } from 'next/headers';
import { getDefaultFlags } from '@letta-web/feature-flags';

function isLettaEmail(email: string) {
  return email.endsWith('@letta.com') || email.endsWith('@memgpt.ai');
}

interface CreateOrganizationArgs {
  name: string;
  isAdmin?: boolean;
  enableCloud?: boolean;
}

export async function createOrganization(args: CreateOrganizationArgs) {
  const { name, enableCloud } = args;

  const lettaAgentsOrganization = await AdminService.createOrganization({
    requestBody: {
      name,
    },
  });

  if (!lettaAgentsOrganization?.id) {
    throw new Error('Failed to create organization from Letta Agents Service');
  }

  const account = await AdminService.createUser({
    requestBody: {
      organization_id: lettaAgentsOrganization.id,
      name: 'Service Account',
    },
  });

  if (!account?.id) {
    throw new Error(
      'Failed to create service account from Letta Agents Service'
    );
  }

  await ToolsService.addBaseTools(
    {
      userId: account.id,
    },
    {
      user_id: account.id,
    }
  );

  const [createdOrg] = await db
    .insert(organizations)
    .values({
      name,
      lettaAgentsId: lettaAgentsOrganization.id,
      enabledCloudAt: enableCloud ? new Date() : null,
    })
    .returning({ organizationId: organizations.id });

  const [createdProject] = await await db
    .insert(projects)
    .values({
      slug: 'default-project',
      name: 'Default Project',
      organizationId: createdOrg.organizationId,
    })
    .returning({
      id: projects.id,
    });

  await db.insert(organizationPreferences).values({
    organizationId: createdOrg.organizationId,
    catchAllAgentsProjectId: createdProject.id,
  });

  return {
    ...createdOrg,
    lettaOrganizationId: lettaAgentsOrganization.id,
  };
}

interface CreateFirstAgentArgs {
  organizationId: string;
  lettaAgentsUserId: string;
  userId: string;
}

async function createFirstAgent(args: CreateFirstAgentArgs) {
  const { organizationId, lettaAgentsUserId, userId } = args;

  const catchAllProject = await db.query.organizationPreferences.findFirst({
    where: eq(organizationPreferences.organizationId, organizationId),
  });

  if (!catchAllProject?.catchAllAgentsProjectId) {
    throw new Error('Organization preferences not found');
  }

  const createdProject = await db.query.projects.findFirst({
    where: eq(projects.id, catchAllProject.catchAllAgentsProjectId),
  });

  if (!createdProject) {
    throw new Error('Project not found');
  }

  const firstProjectSlug = createdProject.slug;

  const createdAgentTemplate = await createAgent(
    {
      body: {
        template: true,
        project_id: createdProject.id,
        from_template: AgentRecipeVariant.CUSTOMER_SUPPORT,
      },
    },
    {
      request: {
        lettaAgentsUserId: lettaAgentsUserId,
        userId: userId,
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
        body: {},
        query: {},
      },
      {
        request: {
          userId,
          organizationId,
          lettaAgentsUserId,
        },
      }
    ),
    db.insert(adePreferences).values({
      userId: userId,
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
        userId,
        lettaAgentsUserId,
      },
    }
  );

  return {
    firstProjectSlug,
    firstCreatedAgentName: createdAgentTemplate.body.name,
  };
}

interface CreateUserAndOrganizationResponse {
  user: UserSession;
  newProjectPayload?: {
    firstProjectSlug: string;
    firstCreatedAgentName: string;
  };
}

interface CreateUserAndOrganizationOptions {
  enableCloud?: boolean;
}

async function createUserAndOrganization(
  userData: ProviderUserPayload,
  options: CreateUserAndOrganizationOptions = {}
): Promise<CreateUserAndOrganizationResponse> {
  let organizationId = '';
  let lettaOrganizationId = '';

  const invitedUserList = await db.query.organizationInvitedUsers.findMany({
    where: eq(organizationInvitedUsers.email, userData.email),
  });

  let isNewOrganization = false;

  if (invitedUserList.length > 0) {
    await Promise.all(
      invitedUserList.map(async (invitedUser) => {
        organizationId = invitedUser.organizationId;

        const organization = await db.query.organizations.findFirst({
          where: eq(organizations.id, organizationId),
        });

        if (!organization) {
          return;
        } else {
          lettaOrganizationId = organization.lettaAgentsId;
        }

        // delete the invited user
        await db
          .delete(organizationInvitedUsers)
          .where(eq(organizationInvitedUsers.email, userData.email));
      })
    );
  }

  if (!organizationId) {
    isNewOrganization = true;
    const organizationName = `${userData.name}'s organization`;

    const createdOrg = await createOrganization({
      name: organizationName,
      enableCloud: options.enableCloud,
    });

    lettaOrganizationId = createdOrg.lettaOrganizationId;
    organizationId = createdOrg.organizationId;
  }

  const lettaAgentsUser = await AdminService.createUser({
    requestBody: {
      name: userData.name,
      organization_id: lettaOrganizationId,
    },
  });

  if (!lettaAgentsUser?.id) {
    // delete organization if user creation fails
    await Promise.all([
      AdminService.deleteOrganizationById({
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
        activeOrganizationId: organizationId,
        name: userData.name || 'New User',
        lettaAgentsId: lettaAgentsUser.id,
        imageUrl: userData.imageUrl,
        email: userData.email,
        providerId: userData.uniqueId,
        signupMethod: userData.provider,
      })
      .returning({ userId: users.id }),
  ]);

  await AdminService.updateUser({
    requestBody: {
      id: lettaAgentsUser.id,
      name: userData.name,
    },
  });

  const userFullName = userData.name;

  await Promise.all([
    db.insert(lettaAPIKeys).values({
      name: `${userFullName}'s API Key`,
      organizationId,
      userId: createdUser.userId,
      apiKey,
    }),
    db
      .update(users)
      .set({
        activeOrganizationId: organizationId,
      })
      .where(eq(users.id, createdUser.userId)),
    db.insert(organizationUsers).values({
      userId: createdUser.userId,
      permissions: { isOrganizationAdmin: isNewOrganization },
      organizationId,
    }),
  ]);

  let firstCreatedAgentName = '';
  let firstProjectSlug = '';

  if (isNewOrganization) {
    const res = await createFirstAgent({
      organizationId,
      lettaAgentsUserId: lettaAgentsUser.id,
      userId: createdUser.userId,
    });

    firstProjectSlug = res.firstProjectSlug;
    firstCreatedAgentName = res.firstCreatedAgentName;
  }

  return {
    user: {
      email: userData.email,
      theme: 'light',
      name: userData.name,
      imageUrl: userData.imageUrl,
      id: createdUser.userId,
      activeOrganizationId: organizationId,
    },
    newProjectPayload: firstCreatedAgentName
      ? {
          firstCreatedAgentName,
          firstProjectSlug,
        }
      : undefined,
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
    activeOrganizationId: user.activeOrganizationId || '',
    imageUrl: user.imageUrl,
    name: user.name,
  };
}

async function isUserInWhitelist(email: string) {
  // some hardcoding to allow letta and memgpt.ai emails bypass the whitelist
  if (isLettaEmail(email)) {
    return true;
  }

  const [a, b] = await Promise.all([
    db.query.emailWhitelist.findFirst({
      where: eq(emailWhitelist.email, email),
    }),
    db.query.organizationInvitedUsers.findFirst({
      where: eq(organizationInvitedUsers.email, email),
    }),
  ]);

  return !!(a || b);
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
  let newUserDetails: NewUserDetails | undefined;
  let user = await findExistingUser(userData);

  if (!user) {
    const flags = await getDefaultFlags();

    const isWhitelisted = await isUserInWhitelist(userData.email);

    if (!flags.GA_ADE && !isWhitelisted) {
      throw new Error(LoginErrorsEnum.USER_NOT_IN_WHITELIST);
    }

    const res = await createUserAndOrganization(userData, {
      enableCloud: isWhitelisted,
    });

    if (res.newProjectPayload) {
      newUserDetails = {
        firstProjectSlug: res.newProjectPayload.firstProjectSlug,
        firstCreatedAgentName: res.newProjectPayload.firstCreatedAgentName,
      };
    }

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
      activeOrganizationId: user.activeOrganizationId,
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
    where: and(
      eq(organizations.id, organizationId),
      isNull(organizations.deletedAt)
    ),
  });

  return organization;
}

export interface GetUserDataResponse {
  activeOrganizationId: string | null;
  hasCloudAccess: boolean;
  id: string;
  lettaAgentsId: string;
  email: string;
  imageUrl: string;
  theme: string;
  locale: string;
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
    where: and(eq(users.id, user.id), isNull(users.deletedAt)),
    columns: {
      activeOrganizationId: true,
      id: true,
      lettaAgentsId: true,
      email: true,
      theme: true,
      imageUrl: true,
      locale: true,
      name: true,
    },
    with: {
      activeOrganization: {
        columns: {
          enabledCloudAt: true,
        },
      },
    },
  });

  if (!userFromDb) {
    return null;
  }

  if (userFromDb.activeOrganizationId) {
    const userOrganization = await db.query.organizationUsers.findFirst({
      where: and(
        eq(organizationUsers.userId, userFromDb.id),
        eq(organizationUsers.organizationId, userFromDb.activeOrganizationId)
      ),
    });

    if (!userOrganization) {
      userFromDb.activeOrganizationId = null;

      void db.update(users).set({
        activeOrganizationId: null,
      });
    }
  }

  return {
    activeOrganizationId: userFromDb.activeOrganizationId || null,
    hasCloudAccess: !!userFromDb.activeOrganization?.enabledCloudAt,
    id: userFromDb.id,
    locale: userFromDb.locale || 'en',
    lettaAgentsId: userFromDb.lettaAgentsId,
    email: userFromDb.email,
    imageUrl: userFromDb.imageUrl,
    name: userFromDb.name,
    theme: userFromDb.theme || 'light',
  };
}

export async function getUserOrRedirect() {
  const user = await getUser();

  if (!user) {
    redirect('/signout');
    return null;
  }

  if (!user?.activeOrganizationId) {
    redirect('/select-organization');
    return;
  }

  return {
    ...user,
    activeOrganizationId: user.activeOrganizationId || '',
  };
}

export async function getUserOrThrow(): Promise<GetUserDataResponse> {
  const user = await getUser();

  if (!user) {
    throw new Error('User not found');
  }

  return user;
}

interface GetUserOrganizationResponseWithActiveOrganizationId
  extends Omit<GetUserDataResponse, 'activeOrganizationId'> {
  activeOrganizationId: string;
}

export async function getUserWithActiveOrganizationIdOrThrow(): Promise<GetUserOrganizationResponseWithActiveOrganizationId> {
  const user = await getUser();

  if (!user?.activeOrganizationId) {
    throw new Error('User not found');
  }

  return {
    ...user,
    activeOrganizationId: user.activeOrganizationId || '',
  };
}

export async function getUserActiveOrganizationIdOrThrow() {
  const user = await getUser();

  if (!user?.activeOrganizationId) {
    throw new Error('User not found');
  }

  return user.activeOrganizationId;
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
      eq(lettaAPIKeys.organizationId, organizationId),
      isNull(lettaAPIKeys.deletedAt)
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

import { deleteUser } from './lib/deleteUser/deleteUser';

export { deleteUser };
