'use server';
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
import { eq } from 'drizzle-orm';
import { createAgent } from '$web/sdk';
import { versionAgentTemplate } from '$web/sdk/agents/lib/versionAgentTemplate/versionAgentTemplate';
import { generateDefaultADELayout } from '$web/utils';
import type { UserSession } from '$web/types/user';
import type { ProviderUserPayload } from '$web/types';
import { AdminService } from '@letta-web/letta-agents-api';
import { LoginErrorsEnum } from '$web/errors';
import { getDefaultFlags } from '@letta-web/feature-flags';
import {
  trackServerSideEvent,
  trackUserOnServer,
} from '@letta-web/analytics/server';
import { AnalyticsEvent } from '@letta-web/analytics';
import { setCookie } from '$web/server/cookies';
import { CookieNames } from '$web/server/cookies/types';
import { cookies } from 'next/headers';
import { setRedisData } from '@letta-web/redis';
import { generateAPIKey } from '$web/server/auth/lib/generateApiKey/generateApiKey';
import { createOrganization } from '$web/server/auth/lib/createOrganization/createOrganization';

function isLettaEmail(email: string) {
  return email.endsWith('@letta.com') || email.endsWith('@memgpt.ai');
}

interface CreateFirstAgentArgs {
  organizationId: string;
  lettaAgentsUserId: string;
  userId: string;
}

async function createFirstAgent(args: CreateFirstAgentArgs) {
  const { organizationId, lettaAgentsUserId, userId } = args;

  const orgPreferences = await db.query.organizationPreferences.findFirst({
    where: eq(organizationPreferences.organizationId, organizationId),
  });

  if (!orgPreferences?.defaultProjectId) {
    throw new Error('Organization preferences not found');
  }

  const createdProject = await db.query.projects.findFirst({
    where: eq(projects.id, orgPreferences.defaultProjectId),
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
        from_template: 'personalAssistant',
      },
    },
    {
      request: {
        source: 'web',
        lettaAgentsUserId: lettaAgentsUserId,
        userId: userId,
        organizationId,
      },
    },
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
          source: 'web',
          userId,
          organizationId,
          lettaAgentsUserId,
        },
      },
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
        source: 'web',
        lettaAgentsUserId,
      },
    },
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
  options: CreateUserAndOrganizationOptions = {},
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
      }),
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
  userData: ProviderUserPayload,
): Promise<UserSession | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.providerId, userData.uniqueId),
  });

  if (user?.bannedAt) {
    throw new Error(LoginErrorsEnum.BANNED);
  }

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

export interface NewUserDetails {
  firstProjectSlug: string;
  firstCreatedAgentName: string;
}

interface UpdateExistingUserArgs {
  name?: string;
  imageUrl?: string;
  email?: string;
  id: string;
}

async function updateExistingUser(args: UpdateExistingUserArgs) {
  const { name, imageUrl, email, id } = args;

  const set: Partial<UpdateExistingUserArgs> = {};

  if (name) {
    set.name = name;
  }

  if (imageUrl) {
    set.imageUrl = imageUrl;
  }

  if (email) {
    set.email = email;
  }

  await db.update(users).set(set).where(eq(users.id, id));
}

interface FindOrCreateUserAndOrganizationFromProviderLoginResponse {
  user: UserSession;
  newUserDetails: NewUserDetails | undefined;
}

async function findOrCreateUserAndOrganizationFromProviderLogin(
  userData: ProviderUserPayload,
): Promise<FindOrCreateUserAndOrganizationFromProviderLoginResponse> {
  let newUserDetails: NewUserDetails | undefined;
  const res = await Promise.all([
    findExistingUser(userData),
    db.query.users.findFirst({
      where: eq(users.email, userData.email),
    }),
  ]);

  let user = res[0];
  const userWithSameEmail = res[1];

  if (userWithSameEmail && userWithSameEmail.providerId !== userData.uniqueId) {
    throw new Error(LoginErrorsEnum.EMAIL_ALREADY_EXISTS);
  }

  let isNewUser = false;

  if (!user) {
    isNewUser = true;
    const flags = await getDefaultFlags();

    const isWhitelisted = await isUserInWhitelist(userData.email);

    if (!flags.GA_ADE && !isWhitelisted) {
      throw new Error(LoginErrorsEnum.USER_NOT_IN_WHITELIST);
    }

    const isCloudEnabled = isWhitelisted;

    const res = await createUserAndOrganization(userData, {
      enableCloud: isCloudEnabled,
    });

    if (res.newProjectPayload && isCloudEnabled) {
      newUserDetails = {
        firstProjectSlug: res.newProjectPayload.firstProjectSlug,
        firstCreatedAgentName: res.newProjectPayload.firstCreatedAgentName,
      };
    }

    user = res.user;
  } else {
    try {
      await updateExistingUser({
        name: userData.name,
        imageUrl: userData.imageUrl,
        email: userData.email,
        id: user.id,
      });

      user.email = userData.email;
      user.imageUrl = userData.imageUrl;
      user.name = userData.name;
    } catch (e) {
      console.error('Failed to update user', e);
    }
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
  userData: ProviderUserPayload,
): Promise<SignInUserFromProviderLoginResponse> {
  const { user, newUserDetails } =
    await findOrCreateUserAndOrganizationFromProviderLogin(userData);

  const sessionId = crypto.randomUUID();
  const expires = Date.now() + SESSION_EXPIRY_MS;

  await setCookie(CookieNames.LETTA_SESSION, {
    sessionId,
    expires,
  });

  (await cookies()).set(CookieNames.THEME, user.theme);

  await setRedisData('userSession', sessionId, {
    expiresAt: expires,
    data: user,
  });

  return {
    newUserDetails,
    user,
  };
}
