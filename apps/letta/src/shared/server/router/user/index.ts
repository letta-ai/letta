import type { ServerInferResponses } from '@ts-rest/core';
import type { userContract } from '$letta/any/contracts/user';
import { getUser } from '$letta/server/auth';

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
