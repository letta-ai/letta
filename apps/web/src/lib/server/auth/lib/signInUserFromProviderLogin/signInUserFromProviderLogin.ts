'use server';
import {
  db,
  emailWhitelist,
  organizationInvitedUsers,
  organizationInviteRules,
  organizationPreferences,
  organizations,
  organizationUsers,
  organizationVerifiedDomains,
  projects,
  users,
} from '@letta-cloud/service-database';
import { eq } from 'drizzle-orm';
import type { UserSession } from '@letta-cloud/sdk-web';
import type { ProviderUserPayload } from '@letta-cloud/sdk-web';
import { AdminService } from '@letta-cloud/sdk-core';
import { LoginErrorsEnum } from '$web/errors';
import {
  trackServerSideEvent,
  trackUserOnServer,
} from '@letta-cloud/service-analytics/server';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';
import { setCookie } from '$web/server/cookies';
import { CookieNames } from '$web/server/cookies/types';
import { cookies } from 'next/headers';
import { setRedisData } from '@letta-cloud/service-redis';
import { generateAPIKey } from '$web/server/auth/lib/generateApiKey/generateApiKey';
import { createOrganization } from '$web/server/auth/lib/createOrganization/createOrganization';
import type { UserPresetRolesType } from '@letta-cloud/service-rbac';

function isLettaEmail(email: string) {
  return email.endsWith('@letta.com') || email.endsWith('@memgpt.ai');
}

interface GetDefaultProjectArgs {
  organizationId: string;
}

async function getDefaultProject(args: GetDefaultProjectArgs) {
  const { organizationId } = args;

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

  return createdProject.slug;
}

interface CreateUserAndOrganizationResponse {
  user: UserSession;
  newProjectPayload?: {
    firstProjectSlug: string;
  };
}

interface CreateUserAndOrganizationOptions {
  enableCloud?: boolean;
}

async function createUserAndOrganization(
  userData: ProviderUserPayload,
  options: CreateUserAndOrganizationOptions = {},
): Promise<CreateUserAndOrganizationResponse> {
  let organizationId = userData.organizationOverride || '';
  let lettaOrganizationId = '';
  let isNewOrganization = false;
  let role: UserPresetRolesType | undefined = undefined;

  if (!organizationId) {
    // if there is no override, check if the user was invited to an organization
    const invitedUserList = await db.query.organizationInvitedUsers.findMany({
      where: eq(organizationInvitedUsers.email, userData.email),
    });

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
    } else {
      // if the user was not invited, check if the domain is authorized
      const domain = userData.email.split('@')[1].toLowerCase();

      if (domain) {
        const authorizedDomains = await db
          .select()
          .from(organizationVerifiedDomains)
          .where(eq(organizationVerifiedDomains.domain, domain))
          .leftJoin(
            organizationInviteRules,
            eq(
              organizationInviteRules.verifiedDomain,
              organizationVerifiedDomains.id,
            ),
          );

        await Promise.all(
          authorizedDomains.map(async (authorizedDomain) => {
            if (!authorizedDomain.organization_invite_rules) {
              return;
            }

            const { organization_invite_rules } = authorizedDomain;
            role = organization_invite_rules.role;
            organizationId = organization_invite_rules.organizationId;

            const organization = await db.query.organizations.findFirst({
              where: eq(organizations.id, organizationId),
            });

            if (!organization) {
              return;
            } else {
              lettaOrganizationId = organization.lettaAgentsId;
            }
          }),
        );
      }
    }
  } else {
    // if there is an override, check if the organization exists and get the Letta Agents ID
    const organization = await db.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
    });

    if (!organization) {
      throw new Error('Organization not found');
    } else {
      lettaOrganizationId = organization.lettaAgentsId;
    }
  }

  if (!organizationId) {
    isNewOrganization = true;
    const organizationName = `${userData.name}'s organization`;

    const createdOrg = await createOrganization({
      name: organizationName,
      email: userData.email,
      enableCloud: options.enableCloud,
    });

    lettaOrganizationId = createdOrg.lettaOrganizationId;
    organizationId = createdOrg.organizationId;

    role = 'admin';
  } else {
    role = role || 'editor';
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

  const [[createdUser]] = await Promise.all([
    db
      .insert(users)
      .values({
        activeOrganizationId: organizationId,
        name: userData.name || 'New User',
        lettaAgentsId: lettaAgentsUser.id,
        imageUrl: userData.imageUrl,
        email: userData.email,
        submittedOnboardingAt: userData.skipOnboarding ? new Date() : null,
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
    generateAPIKey({
      name: `${userFullName}'s API Key`,
      organizationId,
      creatorUserId: createdUser.userId,
    }),
    db
      .update(users)
      .set({
        activeOrganizationId: organizationId,
      })
      .where(eq(users.id, createdUser.userId)),
    db.insert(organizationUsers).values({
      userId: createdUser.userId,
      role: role,
      organizationId,
    }),
  ]);

  let firstProjectSlug = '';

  if (isNewOrganization) {
    firstProjectSlug = await getDefaultProject({
      organizationId,
    });
  }

  return {
    user: {
      email: userData.email,
      theme: 'light',
      name: userData.name,
      imageUrl: userData.imageUrl,
      id: createdUser.userId,
      activeOrganizationId: organizationId,
      coreUserId: lettaAgentsUser.id,
    },
    newProjectPayload: firstProjectSlug
      ? {
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
    coreUserId: user.lettaAgentsId,
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
  isNewUser: boolean;
}

async function findOrCreateUserAndOrganizationFromProviderLogin(
  userData: ProviderUserPayload,
): Promise<FindOrCreateUserAndOrganizationFromProviderLoginResponse> {
  let newUserDetails: NewUserDetails | undefined;
  let isNewUser = false;

  // normalize email
  userData.email = userData.email.toLowerCase();

  const res = await Promise.all([
    findExistingUser(userData),
    db.query.users.findFirst({
      where: eq(users.email, userData.email),
    }),
  ]);

  let user = res[0];
  const userWithSameEmail = res[1];

  // if the user is from SSO, we dont check for conflicting addresses, thus email is not unique
  if (userWithSameEmail && userWithSameEmail.providerId !== userData.uniqueId) {
    if (userData.provider === 'workos-sso') {
      throw new Error(LoginErrorsEnum.SSO_USER_EXISTS_AS_NOT_SSO);
    }

    throw new Error(LoginErrorsEnum.EMAIL_ALREADY_EXISTS);
  }

  if (!user) {
    isNewUser = true;

    const isCloudEnabled = await isUserInWhitelist(userData.email);

    const res = await createUserAndOrganization(userData, {
      enableCloud: isCloudEnabled,
    });

    if (res.newProjectPayload && isCloudEnabled) {
      newUserDetails = {
        firstProjectSlug: res.newProjectPayload.firstProjectSlug,
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
      coreUserId: user.coreUserId,
    },
    newUserDetails,
    isNewUser,
  };
}

const SESSION_EXPIRY_MS = 31536000000; // one year

interface SignInUserFromProviderLoginResponse {
  newUserDetails: NewUserDetails | undefined;
  isNewUser: boolean;
  user: UserSession;
}

export async function signInUserFromProviderLogin(
  userData: ProviderUserPayload,
): Promise<SignInUserFromProviderLoginResponse> {
  const { user, isNewUser, newUserDetails } =
    await findOrCreateUserAndOrganizationFromProviderLogin(userData);

  const sessionId = crypto.randomUUID();
  const expires = Date.now() + SESSION_EXPIRY_MS;

  await setCookie(CookieNames.LETTA_SESSION, {
    sessionId,
    expires,
  });

  await setCookie(CookieNames.CLOUD_API_SESSION, {
    sessionId,
    expires,
  });

  (await cookies()).set(CookieNames.THEME, user.theme);

  await setRedisData(
    'userSession',
    { sessionId },
    {
      expiresAt: expires,
      data: user,
    },
  );

  return {
    isNewUser,
    newUserDetails,
    user,
  };
}
