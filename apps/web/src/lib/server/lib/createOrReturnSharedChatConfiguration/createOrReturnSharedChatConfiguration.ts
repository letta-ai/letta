import crypto from 'crypto';
import { db, sharedAgentChatConfigurations } from '@letta-cloud/database';
import type { AccessLevelEnumSchemaType } from '@letta-cloud/web-api-client';
import { eq } from 'drizzle-orm';

interface CreateOrReturnSharedChatConfigurationOptions {
  agentId: string;
  organizationId: string;
  projectId: string;
  launchLinkId?: string;
  accessLevel?: AccessLevelEnumSchemaType;
}

export async function createOrReturnSharedChatConfiguration(
  options: CreateOrReturnSharedChatConfigurationOptions,
) {
  const {
    agentId,
    organizationId,
    launchLinkId = null,
    projectId,
    accessLevel = 'organization',
  } = options;
  const existingConfiguration =
    await db.query.sharedAgentChatConfigurations.findFirst({
      where: eq(sharedAgentChatConfigurations.agentId, agentId),
      columns: {
        accessLevel: true,
        agentId: true,
        chatId: true,
        launchLinkId: true,
      },
    });

  if (existingConfiguration) {
    return existingConfiguration;
  }

  // create a unique access url given a random id + timestamp
  const chatId = `${crypto.randomBytes(16).toString('hex').slice(0, 10)}${Date.now()}`;

  const [newConfiguration] = await db
    .insert(sharedAgentChatConfigurations)
    .values({
      accessLevel,
      agentId,
      projectId,
      chatId,
      organizationId,
      ...(launchLinkId && { launchLinkId }),
    })
    .onConflictDoNothing()
    .returning({
      accessLevel: sharedAgentChatConfigurations.accessLevel,
      agentId: sharedAgentChatConfigurations.agentId,
      chatId: sharedAgentChatConfigurations.chatId,
      launchLinkId: sharedAgentChatConfigurations.launchLinkId,
    });

  return newConfiguration;
}
