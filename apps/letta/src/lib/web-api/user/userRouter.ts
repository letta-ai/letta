import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type {
  updateActiveOrganizationContract,
  userContract,
} from '$letta/web-api/contracts';
import { getUser } from '$letta/server/auth';
import type { contracts } from '$letta/web-api/contracts';
import {
  db,
  organizations,
  organizationUsers,
  users,
} from '@letta-web/database';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { CookieNames } from '$letta/server/cookies/types';
import { AdminService } from '@letta-web/letta-agents-api';

type ResponseShapes = ServerInferResponses<typeof userContract>;

async function getCurrentUser(): Promise<ResponseShapes['getCurrentUser']> {
  const user = await getUser();

  if (!user) {
    return {
      status: 401,
      body: {
        message: 'User not found',
      },
    };
  }

  return {
    status: 200,
    body: {
      theme: user.theme,
      name: user.name,
      email: user.email,
      imageUrl: user.imageUrl,
      hasCloudAccess: user.hasCloudAccess,
      activeOrganizationId: user.activeOrganizationId || '',
      id: user.id,
    },
  };
}

type UpdateUserResponse = ServerInferResponses<
  typeof contracts.user.updateCurrentUser
>;
type UpdateUserPayload = ServerInferRequest<
  typeof contracts.user.updateCurrentUser
>;

async function updateCurrentUser(
  payload: UpdateUserPayload
): Promise<UpdateUserResponse> {
  const user = await getUser();

  if (!user) {
    return {
      status: 401,
      body: {
        message: 'User not found',
      },
    };
  }

  if (payload.body.theme) {
    cookies().set(CookieNames.THEME, payload.body.theme);
  }

  const updatedUser = {
    ...user,
    ...payload.body,
  };

  await db
    .update(users)
    .set({
      name: updatedUser.name,
      theme: updatedUser.theme,
    })
    .where(eq(users.id, user.id));

  return {
    status: 200,
    body: {
      theme: updatedUser.theme,
      name: updatedUser.name,
      email: updatedUser.email,
      hasCloudAccess: user.hasCloudAccess,
      imageUrl: updatedUser.imageUrl,
      activeOrganizationId: updatedUser.activeOrganizationId || '',
      id: updatedUser.id,
    },
  };
}

type ListUserOrganizationsResponse = ServerInferResponses<
  typeof contracts.user.listUserOrganizations
>;

async function listUserOrganizations(): Promise<ListUserOrganizationsResponse> {
  const user = await getUser();

  if (!user) {
    return {
      status: 401,
      body: {
        message: 'User not found',
      },
    };
  }

  const organizationsMapResponse = await db.query.organizationUsers.findMany({
    where: and(eq(organizationUsers.userId, user.id)),
  });

  const organizationsResponse = await db.query.organizations.findMany({
    where: and(
      inArray(
        organizations.id,
        organizationsMapResponse.map((o) => o.organizationId)
      ),
      isNull(organizations.deletedAt)
    ),
  });

  return {
    status: 200,
    body: {
      organizations: organizationsResponse.map((organization) => ({
        id: organization.id,
        name: organization.name,
      })),
    },
  };
}

type UpdateActiveOrganizationResponse = ServerInferResponses<
  typeof updateActiveOrganizationContract
>;

type UpdateActiveOrganizationRequest = ServerInferRequest<
  typeof updateActiveOrganizationContract
>;

async function updateActiveOrganization(
  request: UpdateActiveOrganizationRequest
): Promise<UpdateActiveOrganizationResponse> {
  const user = await getUser();

  if (!user) {
    return {
      status: 401,
      body: {
        message: 'User not found',
      },
    };
  }

  const { activeOrganizationId } = request.body;

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, activeOrganizationId),
  });

  if (!organization) {
    return {
      status: 404,
      body: {
        message: 'Organization not found',
      },
    };
  }

  await Promise.all([
    db.update(users).set({ activeOrganizationId }).where(eq(users.id, user.id)),
    AdminService.updateUser({
      requestBody: {
        id: user.lettaAgentsId,
        organization_id: organization.lettaAgentsId,
      },
    }),
  ]);

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

export const userRouter = {
  getCurrentUser,
  updateCurrentUser,
  listUserOrganizations,
  updateActiveOrganization,
};
