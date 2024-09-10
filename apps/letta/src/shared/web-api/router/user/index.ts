import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { userContract } from '$letta/web-api/contracts/user';
import { getUser } from '$letta/server/auth';
import type { contracts } from '$letta/web-api/contracts';
import { users } from '@letta-web/database';
import { eq } from 'drizzle-orm';

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

  const updatedUser = {
    ...user,
    ...payload.body,
  };

  await db
    .update(users)
    .set({
      name: updatedUser.name,
    })
    .where(eq(users.id, user.id));

  return {
    status: 200,
    body: {
      name: updatedUser.name,
      email: updatedUser.email,
      imageUrl: updatedUser.imageUrl,
      organizationId: updatedUser.organizationId,
      id: updatedUser.id,
    },
  };
}
