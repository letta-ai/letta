import {
  clientSideAccessTokens,
  db,
  organizations,
} from '@letta-cloud/service-database';
import { UsersService } from '@letta-cloud/sdk-core';
import { eq } from 'drizzle-orm';
import type { AccessPolicyVersionOneType } from '@letta-cloud/types';
import { accessTokenTypeToPrefix } from '@letta-cloud/types';

interface GenerateAPIKeyOptions {
  organizationId: string;
  hostname: string;
  expiresAt?: Date | null;
  userId: string;
  policy: AccessPolicyVersionOneType;
}

export async function generateClientSideAPIKey(options: GenerateAPIKeyOptions) {
  const { organizationId, hostname, policy, userId, expiresAt } = options;
  const apiKey = crypto.randomUUID();

  const response = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
    columns: {
      lettaAgentsId: true,
    },
  });

  if (!response?.lettaAgentsId) {
    throw new Error('Organization not found');
  }

  const key = btoa(`${organizationId}:${apiKey}`);

  const coreUser = await UsersService.createUser({
    requestBody: {
      organization_id: response.lettaAgentsId,
      name: `API user for ${organizationId}`,
    },
  });

  if (!coreUser.id) {
    throw new Error('Failed to create user');
  }

  const fullKey = `${accessTokenTypeToPrefix['client-side']}-${key}`;

  await db.insert(clientSideAccessTokens).values({
    organizationId,
    coreUserId: coreUser.id,
    token: fullKey,
    requesterUserId: userId,
    policy,
    hostname,
    /* if no expiresAt is provided, set it to 5 minutes from now */
    expiresAt: expiresAt
      ? new Date(expiresAt)
      : new Date(Date.now() + 5 * 60 * 1000),
  });

  return fullKey;
}
