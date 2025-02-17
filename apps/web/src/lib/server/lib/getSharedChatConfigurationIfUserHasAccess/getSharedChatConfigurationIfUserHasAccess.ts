import { db, sharedAgentChatConfigurations } from '@letta-cloud/database';
import { eq } from 'drizzle-orm';

type DoesUserHaveAccessToSharedAgentOptions = {
  organizationId?: string;
  userId?: string;
} & ({ chatId: string; agentId?: never } | { chatId?: never; agentId: string });

export async function getSharedChatConfigurationIfUserHasAccess(
  options: DoesUserHaveAccessToSharedAgentOptions,
) {
  const { chatId, agentId } = options;
  const configuration = await db.query.sharedAgentChatConfigurations.findFirst({
    where: chatId
      ? eq(sharedAgentChatConfigurations.chatId, chatId)
      : eq(sharedAgentChatConfigurations.agentId, agentId || ''),
  });

  if (!configuration) {
    return false;
  }

  const { accessLevel } = configuration;

  if (accessLevel === 'everyone') {
    return configuration;
  }

  if (accessLevel === 'organization') {
    if (options.organizationId === configuration.organizationId) {
      return configuration;
    }
  }

  if (accessLevel === 'logged-in') {
    if (options.userId) {
      return configuration;
    }
  }

  return false;
}
