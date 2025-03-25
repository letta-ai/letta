import { db, lettaAPIKeys } from '@letta-cloud/service-database';
import { getUserWithActiveOrganizationIdOrThrow } from '$web/server/auth';
import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '$web/web-api/contracts';
import { and, eq, isNull } from 'drizzle-orm';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { deleteRedisData } from '@letta-cloud/service-redis';
import { AdminService } from '@letta-cloud/sdk-core';
import { generateAPIKey } from '@letta-cloud/service-auth';

type CreateAPIKeyPayload = ServerInferRequest<
  typeof contracts.apiKeys.createAPIKey
>;
type CreateAPIKeyResponse = ServerInferResponses<
  typeof contracts.apiKeys.createAPIKey
>;

export async function createAPIKey(
  req: CreateAPIKeyPayload,
): Promise<CreateAPIKeyResponse> {
  const { name } = req.body;

  const {
    activeOrganizationId: organizationId,
    id: userId,
    permissions,
  } = await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.CREATE_API_KEY)) {
    return {
      status: 403,
      body: null,
    };
  }

  const apiKey = await generateAPIKey({
    name,
    creatorUserId: userId,
    organizationId: organizationId,
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
  req: GetAPIKeysRequest,
): Promise<GetAPIKeysResponse> {
  const { activeOrganizationId: organizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.READ_API_KEYS)) {
    return {
      status: 403,
      body: null,
    };
  }

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
  req: DeleteAPIKeyRequest,
): Promise<DeleteAPIKeyResponse> {
  const { apiKeyId } = req.params;

  const { activeOrganizationId: organizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.DELETE_API_KEY)) {
    return {
      status: 403,
      body: null,
    };
  }

  const existingKey = await db.query.lettaAPIKeys.findFirst({
    where: and(
      eq(lettaAPIKeys.id, apiKeyId),
      eq(lettaAPIKeys.organizationId, organizationId),
      isNull(lettaAPIKeys.deletedAt),
    ),
  });

  if (!existingKey) {
    return {
      status: 404,
      body: null,
    };
  }

  await deleteRedisData('apiKeys', {
    apiKey: existingKey.apiKey,
    organizationId,
  });

  await db
    .delete(lettaAPIKeys)
    .where(
      and(
        eq(lettaAPIKeys.id, apiKeyId),
        eq(lettaAPIKeys.organizationId, organizationId),
      ),
    );

  await AdminService.deleteUser({
    userId: existingKey.coreUserId,
  });

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
  req: GetAPIKeyRequest,
): Promise<GetAPIKeyResponse> {
  const { apiKeyId } = req.params;

  const { activeOrganizationId: organizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.READ_API_KEYS)) {
    return {
      status: 403,
      body: null,
    };
  }

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
