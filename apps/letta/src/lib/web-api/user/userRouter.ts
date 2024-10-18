import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { userContract } from '$letta/web-api/contracts';
import { getUser } from '$letta/server/auth';
import type { contracts } from '$letta/web-api/contracts';
import { db, users } from '@letta-web/database';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { CookieNames } from '$letta/server/cookies/types';

type ResponseShapes = ServerInferResponses<typeof userContract>;

export async function getCurrentUser(): Promise<
  ResponseShapes['getCurrentUser']
> {
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
      organizationId: user.organizationId,
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

export async function updateCurrentUser(
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
      imageUrl: updatedUser.imageUrl,
      organizationId: updatedUser.organizationId,
      id: updatedUser.id,
    },
  };
}
