import { db, lettaAPIKeys } from '@letta-web/database';
import {
  generateAPIKey,
  getUser,
  getUserActiveOrganizationIdOrThrow,
} from '$letta/server/auth';
import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '$letta/web-api/contracts';
import { and, eq, isNull } from 'drizzle-orm';

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

  if (!user?.activeOrganizationId) {
    throw new Error('User not found');
  }

  const apiKey = await generateAPIKey(user.activeOrganizationId);

  await db.insert(lettaAPIKeys).values({
    name,
    userId: user.id,
    organizationId: user.activeOrganizationId,
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
  const organizationId = await getUserActiveOrganizationIdOrThrow();
  const { offset, limit = 10, search } = req.query;

  const where = [
    eq(lettaAPIKeys.organizationId, organizationId),
    isNull(lettaAPIKeys.deletedAt),
  ];

  if (search) {
    where.push(eq(lettaAPIKeys.apiKey, search));
  }

  const apiKeys = await db.query.lettaAPIKeys.findMany({
    where: and(...where),
    offset,
    limit: limit + 1,
    columns: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return {
    status: 200,
    body: {
      apiKeys: apiKeys.slice(0, limit).map((apiKey) => ({
        id: apiKey.id,
        name: apiKey.name,
        createdAt: apiKey.createdAt.toISOString(),
        updatedAt: apiKey.updatedAt.toISOString(),
      })),
      hasNextPage: apiKeys.length > limit,
    },
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

  const organizationId = await getUserActiveOrganizationIdOrThrow();

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

  const organizationId = await getUserActiveOrganizationIdOrThrow();

  const where = [
    eq(lettaAPIKeys.organizationId, organizationId),
    isNull(lettaAPIKeys.deletedAt),
  ];

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
