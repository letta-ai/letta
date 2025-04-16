import { parseAccessToken } from '../parseAccessToken/parseAccessToken';
import { getRedisData } from '@letta-cloud/service-redis';
import { db, lettaAPIKeys, organizations } from '@letta-cloud/service-database';
import { and, eq } from 'drizzle-orm';
import { UsersService } from '@letta-cloud/sdk-core';
import type { AccessTokenTypes } from '@letta-cloud/types';
import type { AccessResource } from '../validateClientSidePolicy/validateClientSidePolicy';
import { validateClientSidePolicy } from '../validateClientSidePolicy/validateClientSidePolicy';

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

interface VerifyAndReturnAPIKeyDetailsResponse {
  type: AccessTokenTypes;
  apiKey?: string;
  organizationId: string;
  coreUserId: string;
  userId: string;
  expiresAt?: number;
  hostname?: string;
}

interface VerifyAndReturnAPIKeyDetailsOptions {
  apiKey?: string;
  resource?: AccessResource;
}

export async function verifyAndReturnAPIKeyDetails(
  options: VerifyAndReturnAPIKeyDetailsOptions,
): Promise<VerifyAndReturnAPIKeyDetailsResponse | null> {
  const { apiKey } = options;

  if (!apiKey) {
    return null;
  }

  let organizationId = '';
  let type: AccessTokenTypes = 'server-side';

  try {
    const { organizationId: orgId, type: t } = await parseAccessToken(apiKey);

    organizationId = orgId;
    type = t;
  } catch (_e) {
    return null;
  }

  if (type === 'server-side') {
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

    return {
      type,
      ...key,
    };
  }

  if (!options.resource) {
    return null;
  }

  const clientKey = await getRedisData('clientSideApiKeys', {
    token: apiKey,
    organizationId: organizationId,
  });

  if (!clientKey) {
    return null;
  }

  if (!clientKey.expiresAt) {
    return null;
  }

  if (new Date(clientKey.expiresAt).getTime() < Date.now()) {
    return null;
  }
  if (
    !validateClientSidePolicy({
      policy: clientKey.policy,
      resource: options.resource,
      coreUserId: clientKey.coreUserId,
    })
  ) {
    return null;
  }

  return {
    type,
    ...clientKey,
  };
}
