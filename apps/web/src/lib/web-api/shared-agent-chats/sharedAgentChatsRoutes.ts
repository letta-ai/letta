import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '@letta-cloud/web-api-client';
import { db, sharedAgentChatConfigurations } from '@letta-cloud/database';
import { eq } from 'drizzle-orm';
import {
  getUser,
  getUserWithActiveOrganizationIdOrThrow,
} from '$web/server/auth';
import { ApplicationServices } from '@letta-cloud/rbac';
import crypto from 'crypto';
import { getSharedChatConfigurationIfUserHasAccess } from '$web/server/lib/getSharedChatConfigurationIfUserHasAccess/getSharedChatConfigurationIfUserHasAccess';
import { getOrganizationLettaServiceAccountId } from '$web/server/lib/getOrganizationLettaServiceAccountId/getOrganizationLettaServiceAccountId';
import { AgentsService } from '@letta-cloud/letta-agents-api';

type GetSharedChatConfigurationRequest = ServerInferRequest<
  typeof contracts.sharedAgentChats.getSharedChatConfiguration
>;
type GetSharedChatConfigurationResponse = ServerInferResponses<
  typeof contracts.sharedAgentChats.getSharedChatConfiguration
>;

async function getSharedChatConfiguration(
  req: GetSharedChatConfigurationRequest,
): Promise<GetSharedChatConfigurationResponse> {
  const { agentId, projectId } = req.params;
  const { activeOrganizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.READ_AGENT)) {
    return {
      status: 403,
      body: {
        message: 'You do not have permission to access this resource',
      },
    };
  }

  const existingConfiguration =
    await db.query.sharedAgentChatConfigurations.findFirst({
      where: eq(sharedAgentChatConfigurations.agentId, agentId),
    });

  if (existingConfiguration) {
    return {
      status: 200,
      body: {
        accessLevel: existingConfiguration.accessLevel,
        agentId: existingConfiguration.agentId,
        chatId: existingConfiguration.chatId,
      },
    };
  }

  // create a unique access url given a random id + timestamp
  const chatId = `${crypto.randomBytes(16).toString('hex').slice(0, 10)}${Date.now()}`;

  const [newConfiguration] = await db
    .insert(sharedAgentChatConfigurations)
    .values({
      accessLevel: 'organization',
      agentId,
      projectId,
      chatId,
      organizationId: activeOrganizationId,
    })
    .onConflictDoNothing()
    .returning({
      accessLevel: sharedAgentChatConfigurations.accessLevel,
      agentId: sharedAgentChatConfigurations.agentId,
      chatId: sharedAgentChatConfigurations.chatId,
    });

  return {
    status: 200,
    body: {
      accessLevel: newConfiguration.accessLevel,
      agentId: newConfiguration.agentId,
      chatId: newConfiguration.chatId,
    },
  };
}

type UpdateSharedChatConfigurationRequest = ServerInferRequest<
  typeof contracts.sharedAgentChats.updateSharedChatConfiguration
>;

type UpdateSharedChatConfigurationResponse = ServerInferResponses<
  typeof contracts.sharedAgentChats.updateSharedChatConfiguration
>;

async function updateSharedChatConfiguration(
  req: UpdateSharedChatConfigurationRequest,
): Promise<UpdateSharedChatConfigurationResponse> {
  const { agentId } = req.params;
  const { accessLevel } = req.body;
  const { permissions } = await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.UPDATE_AGENT)) {
    return {
      status: 403,
      body: {
        message: 'You do not have permission to access this resource',
      },
    };
  }

  const existingConfiguration =
    await db.query.sharedAgentChatConfigurations.findFirst({
      where: eq(sharedAgentChatConfigurations.agentId, agentId),
    });

  if (!existingConfiguration) {
    return {
      status: 404,
      body: {
        message: 'Configuration not found',
      },
    };
  }

  await db
    .update(sharedAgentChatConfigurations)
    .set({
      accessLevel,
    })
    .where(eq(sharedAgentChatConfigurations.agentId, agentId));

  return {
    status: 200,
    body: {
      accessLevel,
      agentId,
      chatId: existingConfiguration.chatId,
    },
  };
}

type GetSharedAgentFromChatIdRequest = ServerInferRequest<
  typeof contracts.sharedAgentChats.getSharedAgentFromChatId
>;

type GetSharedAgentFromChatIdResponse = ServerInferResponses<
  typeof contracts.sharedAgentChats.getSharedAgentFromChatId
>;

async function getSharedAgentFromChatId(
  req: GetSharedAgentFromChatIdRequest,
): Promise<GetSharedAgentFromChatIdResponse> {
  const { chatId } = req.params;
  const user = await getUser();

  const configuration = await getSharedChatConfigurationIfUserHasAccess({
    chatId,
    userId: user?.id,
    organizationId: user?.activeOrganizationId || '',
  });

  if (!configuration) {
    return {
      status: 404,
      body: {
        message: 'Configuration not found',
      },
    };
  }

  const serviceAccountId = await getOrganizationLettaServiceAccountId(
    configuration.organizationId,
  );

  if (!serviceAccountId) {
    throw new Error('Service account not found');
  }

  const agent = await AgentsService.retrieveAgent(
    {
      agentId: configuration.agentId,
    },
    {
      user_id: serviceAccountId,
    },
  );

  return {
    status: 200,
    body: {
      agentName: agent?.name || '',
      agentId: configuration.agentId,
    },
  };
}

export const sharedAgentChatsRoutes = {
  getSharedChatConfiguration,
  updateSharedChatConfiguration,
  getSharedAgentFromChatId,
};
