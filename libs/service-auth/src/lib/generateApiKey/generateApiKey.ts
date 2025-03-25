import { db, lettaAPIKeys, organizations } from '@letta-cloud/service-database';
import { UsersService } from '@letta-cloud/sdk-core';
import { eq } from 'drizzle-orm';

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
