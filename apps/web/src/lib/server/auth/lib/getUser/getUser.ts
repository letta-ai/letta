import { getCookie } from '$web/server/cookies';
import { CookieNames } from '$web/server/cookies/types';
import { getRedisData } from '@letta-web/redis';
import { db, organizationUsers, users } from '@letta-web/database';
import { and, eq, isNull } from 'drizzle-orm';
import { redirect } from 'next/navigation';

export interface GetUserDataResponse {
  activeOrganizationId: string | null;
  hasCloudAccess: boolean;
  id: string;
  lettaAgentsId: string;
  email: string;
  imageUrl: string;
  theme: string;
  locale: string;
  hasOnboarded: boolean;
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
      submittedOnboardingAt: true,
      imageUrl: true,
      locale: true,
      name: true,
      bannedAt: true,
    },
    with: {
      activeOrganization: {
        columns: {
          enabledCloudAt: true,
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

  return {
    activeOrganizationId: userFromDb.activeOrganizationId || null,
    hasCloudAccess: !!userFromDb.activeOrganization?.enabledCloudAt,
    id: userFromDb.id,
    hasOnboarded: !!userFromDb.submittedOnboardingAt,
    locale: userFromDb.locale || 'en',
    lettaAgentsId: userFromDb.lettaAgentsId,
    email: userFromDb.email,
    imageUrl: userFromDb.imageUrl,
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
