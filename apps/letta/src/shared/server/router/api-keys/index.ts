import { db, lettaAPIKeys } from '@letta-web/database';
import {
  generateAPIKey,
  getUserOrganizationIdOrThrow,
} from '$letta/server/auth';
import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '$letta/any/contracts';
import { and, eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

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

  const organizationId = await getUserOrganizationIdOrThrow();
  const { apiKey, accessToken } = await generateAPIKey(organizationId);

  const hashedApiKey = await bcrypt.hash(apiKey, 10);

  await db.insert(lettaAPIKeys).values({
    name,
    organizationId,
    apiKey: hashedApiKey,
  });

  return {
    status: 200,
    body: {
      apiKey: accessToken,
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
