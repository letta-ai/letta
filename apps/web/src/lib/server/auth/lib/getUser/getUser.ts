import { getCookie } from '$web/server/cookies';
import { CookieNames } from '$web/server/cookies/types';
import { getRedisData } from '@letta-cloud/service-redis';
import { db, organizationUsers, users } from '@letta-cloud/service-database';
import { and, eq, isNull } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import type { ApplicationServices } from '@letta-cloud/service-rbac';
import { roleToServicesMap } from '@letta-cloud/service-rbac';
import type { OnboardingStepSchemaType } from '@letta-cloud/sdk-web';

export interface GetUserDataResponse {
  activeOrganizationId: string | null;
  hasCloudAccess: boolean;
  id: string;
  lettaAgentsId: string;
  email: string;
  imageUrl: string;
  permissions: Set<ApplicationServices>;
  isVerified: boolean;
  theme: string;
  locale: string;
  createdAt: string;
  hasOnboarded: boolean;
  onboardingStatus: OnboardingStepSchemaType | null;
  name: string;
}

export async function getUser(): Promise<GetUserDataResponse | null> {
  const session = await getCookie(CookieNames.LETTA_SESSION);

  if (!session) {
    return null;
  }

  const user = await getRedisData('userSession', {
    sessionId: session.sessionId,
  });

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
      submittedOnboardingAt: true,
      verifiedAt: true,
      imageUrl: true,
      locale: true,
      name: true,
      bannedAt: true,
      createdAt: true,
    },
    with: {
      organizationUsers: {
        where: eq(organizationUsers.organizationId, user.activeOrganizationId),
        columns: {
          role: true,
        },
      },
      userProductOnboarding: {
        columns: {
          completedSteps: true,
          currentStep: true,
          pausedAt: true,
        },
      },
      activeOrganization: {
        columns: {
          enabledCloudAt: true,
        },
        with: {
          organizationClaimedOnboardingRewards: true,
        },
      },
    },
  });

  if (userFromDb?.bannedAt) {
    return null;
  }

  if (!userFromDb) {
    return null;
  }

  if (userFromDb.activeOrganizationId) {
    const userOrganization = await db.query.organizationUsers.findFirst({
      where: and(
        eq(organizationUsers.userId, userFromDb.id),
        eq(organizationUsers.organizationId, userFromDb.activeOrganizationId),
      ),
    });

    if (!userOrganization) {
      userFromDb.activeOrganizationId = null;

      void db.update(users).set({
        activeOrganizationId: null,
      });
    }
  }

  const permissions =
    roleToServicesMap[userFromDb.organizationUsers[0]?.role || 'custom'];

  return {
    activeOrganizationId: userFromDb.activeOrganizationId || null,
    hasCloudAccess: !!userFromDb.activeOrganization?.enabledCloudAt,
    id: userFromDb.id,
    hasOnboarded: !!userFromDb.submittedOnboardingAt,
    locale: userFromDb.locale || 'en',
    createdAt: userFromDb.createdAt.toISOString(),
    lettaAgentsId: userFromDb.lettaAgentsId,
    email: userFromDb.email,
    imageUrl: userFromDb.imageUrl,
    isVerified: !!userFromDb.verifiedAt,
    permissions: new Set(permissions),
    onboardingStatus: {
      pausedAt: userFromDb.userProductOnboarding?.pausedAt
        ? userFromDb.userProductOnboarding.pausedAt.toISOString()
        : null,
      claimedSteps:
        userFromDb.activeOrganization?.organizationClaimedOnboardingRewards?.map(
          (reward) => reward.rewardKey,
        ) || [],
      completedSteps: userFromDb.userProductOnboarding?.completedSteps || [],
      currentStep: userFromDb.userProductOnboarding?.currentStep || null,
    },
    name: userFromDb.name,
    theme: userFromDb.theme || 'auto',
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
