import { db, lettaAPIKeys, organizations } from '@letta-cloud/database';
import { UsersService } from '@letta-cloud/letta-agents-api';
import { and, eq } from 'drizzle-orm';

interface GenerateAPIKeyOptions {
  organizationId: string;
  name: string;
  creatorUserId: string;
}

export async function generateAPIKey(options: GenerateAPIKeyOptions) {
  const { organizationId, name, creatorUserId } = options;
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

  await db.insert(lettaAPIKeys).values({
    name,
    organizationId,
    userId: creatorUserId,
    coreUserId: coreUser.id,
    apiKey: key,
  });

  return key;
}

interface BackfillGenerateApiKeyOptions {
  apiKey: string;
  organizationId: string;
}

export async function backfillCoreUserIdToApiKeyFn(
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
