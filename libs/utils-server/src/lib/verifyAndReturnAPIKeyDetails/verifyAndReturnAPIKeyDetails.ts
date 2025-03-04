import { parseAccessToken } from '../parseAccessToken/parseAccessToken';
import { getRedisData } from '@letta-cloud/service-redis';
import { db, lettaAPIKeys, organizations } from '@letta-cloud/service-database';
import { and, eq } from 'drizzle-orm';
import { UsersService } from '@letta-cloud/sdk-core';

interface BackfillGenerateApiKeyOptions {
  apiKey: string;
  organizationId: string;
}

async function backfillCoreUserIdToApiKeyFn(
  options: BackfillGenerateApiKeyOptions,
) {
  const { apiKey, organizationId } = options;
  const response = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
    columns: {
      lettaAgentsId: true,
    },
  });

  if (!response?.lettaAgentsId) {
    throw new Error('Organization not found');
  }

  const coreUser = await UsersService.createUser({
    requestBody: {
      organization_id: response.lettaAgentsId,
      name: `API user for ${organizationId}`,
    },
  });

  if (!coreUser.id) {
    throw new Error('Failed to create user');
  }

  await db
    .update(lettaAPIKeys)
    .set({
      coreUserId: coreUser.id,
    })
    .where(
      and(
        eq(lettaAPIKeys.apiKey, apiKey),
        eq(lettaAPIKeys.organizationId, organizationId),
      ),
    );

  return coreUser.id;
}

export async function verifyAndReturnAPIKeyDetails(apiKey?: string) {
  if (!apiKey) {
    return null;
  }

  let organizationId = '';

  try {
    const { organizationId: orgId } = await parseAccessToken(apiKey);
    organizationId = orgId;
  } catch (_e) {
    return null;
  }

  const key = await getRedisData('apiKeys', {
    apiKey: apiKey,
    organizationId: organizationId,
  });

  if (!key) {
    return null;
  }

  if (!key.coreUserId) {
    key.coreUserId = await backfillCoreUserIdToApiKeyFn({
      apiKey,
      organizationId,
    });
  }

  return key;
}
