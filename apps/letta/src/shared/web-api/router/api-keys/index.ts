import { db, lettaAPIKeys } from '@letta-web/database';
import {
  generateAPIKey,
  getUser,
  getUserOrganizationIdOrThrow,
} from '$letta/server/auth';
import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '$letta/web-api/contracts';
import { and, eq } from 'drizzle-orm';

type CreateAPIKeyPayload = ServerInferRequest<
  typeof contracts.apiKeys.createAPIKey
>;
type CreateAPIKeyResponse = ServerInferResponses<
  typeof contracts.apiKeys.createAPIKey
>;

export async function createAPIKey(
  req: CreateAPIKeyPayload
): Promise<CreateAPIKeyResponse> {
  const { name } = req.body;

  const user = await getUser();

  if (!user) {
    throw new Error('User not found');
  }

  const apiKey = await generateAPIKey(user.organizationId);

  await db.insert(lettaAPIKeys).values({
    name,
    userId: user.id,
    organizationId: user.organizationId,
    apiKey,
  });

  return {
    status: 200,
    body: {
      apiKey,
    },
  };
}

type GetAPIKeysRequest = ServerInferRequest<
  typeof contracts.apiKeys.getAPIKeys
>;
type GetAPIKeysResponse = ServerInferResponses<
  typeof contracts.apiKeys.getAPIKeys
>;

export async function getAPIKeys(
  req: GetAPIKeysRequest
): Promise<GetAPIKeysResponse> {
  const organizationId = await getUserOrganizationIdOrThrow();
  const { offset, limit, search } = req.query;

  const where = [eq(lettaAPIKeys.organizationId, organizationId)];

  if (search) {
    where.push(eq(lettaAPIKeys.apiKey, search));
  }

  const apiKeys = await db.query.lettaAPIKeys.findMany({
    where: and(...where),
    offset,
    limit,
    columns: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return {
    status: 200,
    body: apiKeys.map((apiKey) => ({
      id: apiKey.id,
      name: apiKey.name,
      createdAt: apiKey.createdAt.toISOString(),
      updatedAt: apiKey.updatedAt.toISOString(),
    })),
  };
}

type DeleteAPIKeyRequest = ServerInferRequest<
  typeof contracts.apiKeys.deleteAPIKey
>;
type DeleteAPIKeyResponse = ServerInferResponses<
  typeof contracts.apiKeys.deleteAPIKey
>;

export async function deleteAPIKey(
  req: DeleteAPIKeyRequest
): Promise<DeleteAPIKeyResponse> {
  const { apiKeyId } = req.params;

  const organizationId = await getUserOrganizationIdOrThrow();

  await db
    .delete(lettaAPIKeys)
    .where(
      and(
        eq(lettaAPIKeys.id, apiKeyId),
        eq(lettaAPIKeys.organizationId, organizationId)
      )
    );

  return {
    status: 200,
    body: null,
  };
}

type GetAPIKeyRequest = ServerInferRequest<typeof contracts.apiKeys.getAPIKey>;

type GetAPIKeyResponse = ServerInferResponses<
  typeof contracts.apiKeys.getAPIKey
>;

export async function getAPIKey(
  req: GetAPIKeyRequest
): Promise<GetAPIKeyResponse> {
  const { apiKeyId } = req.params;

  const organizationId = await getUserOrganizationIdOrThrow();

  const where = [eq(lettaAPIKeys.organizationId, organizationId)];

  if (apiKeyId !== 'first') {
    where.push(eq(lettaAPIKeys.id, apiKeyId));
  }

  const apiKey = await db.query.lettaAPIKeys.findFirst({
    where: and(...where),
    columns: {
      id: true,
      name: true,
      apiKey: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!apiKey) {
    return {
      status: 404,
      body: null,
    };
  }

  return {
    status: 200,
    body: {
      id: apiKey.id,
      name: apiKey.name,
      apiKey: apiKey.apiKey,
      createdAt: apiKey.createdAt.toISOString(),
      updatedAt: apiKey.updatedAt.toISOString(),
    },
  };
}
