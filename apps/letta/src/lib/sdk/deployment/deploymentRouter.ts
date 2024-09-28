import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { sdkContracts } from '../contracts';
import type { AuthedRequestType } from '../shared';
import {
  db,
  deployedAgents,
  deployedAgentTemplates,
} from '@letta-web/database';
import { and, desc, eq } from 'drizzle-orm';
import { copyAgentById, migrateToNewAgent } from '$letta/server';
import * as crypto from 'node:crypto';
import type { AgentMessage } from '@letta-web/letta-agents-api';
import {
  AgentMessageSchema,
  AgentsService,
  safeParseArguments,
} from '@letta-web/letta-agents-api';

type CreateAgentRequestType = ServerInferRequest<
  typeof sdkContracts.deployment.createAgent
>;
type CreateAgentResponseType = ServerInferResponses<
  typeof sdkContracts.deployment.createAgent
>;

export async function createAgent(
  req: CreateAgentRequestType,
  context: AuthedRequestType
): Promise<CreateAgentResponseType> {
  const { deployedAgentTemplateKey, uniqueIdentifier } = req.body;
  const { organizationId, userId } = context.request;

  if (uniqueIdentifier) {
    const alreadyExists = await db.query.deployedAgents.findFirst({
      where: and(
        eq(deployedAgents.organizationId, organizationId),
        eq(deployedAgents.key, uniqueIdentifier)
      ),
      columns: {
        id: true,
      },
    });

    if (alreadyExists) {
      return {
        status: 409,
        body: {
          message: 'An agent with the same unique identifier already exists',
        },
      };
    }
  }

  const deployedAgentTemplate = await db.query.deployedAgentTemplates.findFirst(
    {
      where: and(
        eq(deployedAgentTemplates.organizationId, organizationId),
        eq(deployedAgentTemplates.key, deployedAgentTemplateKey)
      ),
    }
  );

  if (!deployedAgentTemplate) {
    return {
      status: 404,
      body: {
        message: 'Source agent not found',
      },
    };
  }

  const copiedAgent = await copyAgentById(
    deployedAgentTemplate.id,
    crypto.randomUUID(),
    userId
  );

  const lastDeployedAgent = await db.query.deployedAgents.findFirst({
    where: eq(deployedAgents.deployedAgentTemplateId, deployedAgentTemplate.id),
    orderBy: [desc(deployedAgents.createdAt)],
  });

  if (!copiedAgent.id) {
    return {
      status: 500,
      body: {
        message: 'Failed to copy agent',
      },
    };
  }

  const nextInternalAgentCountId =
    (lastDeployedAgent?.internalAgentCountId || 0) + 1;

  const key =
    uniqueIdentifier ||
    `${deployedAgentTemplateKey}-${nextInternalAgentCountId}`;

  const [agent] = await db
    .insert(deployedAgents)
    .values({
      id: copiedAgent.id,
      projectId: deployedAgentTemplate.projectId,
      key,
      internalAgentCountId: nextInternalAgentCountId,
      deployedAgentTemplateKey: deployedAgentTemplate.key,
      deployedAgentTemplateId: deployedAgentTemplate.id,
      organizationId,
    })
    .returning({ id: deployedAgents.id });

  return {
    status: 201,
    body: {
      agentDeploymentId: agent.id,
    },
  };
}

type ChatWithAgentResponseType = ServerInferResponses<
  typeof sdkContracts.deployment.chatWithAgent
>;

export async function chatWithAgent(): Promise<ChatWithAgentResponseType> {
  // This is a stub, the actual implementation of this code is in `/v1/deployment/agents/[agentDeploymentId]/chat/route.ts`

  return {
    status: 201,
    body: {
      messages: [],
    },
  };
}

type MigrateDeployedAgentToNewDeployedAgentTemplateType = ServerInferRequest<
  typeof sdkContracts.deployment.migrateDeployedAgentToNewDeployedAgentTemplate
>;

type MigrateDeployedAgentToNewDeployedAgentTemplateResponseType =
  ServerInferResponses<
    typeof sdkContracts.deployment.migrateDeployedAgentToNewDeployedAgentTemplate
  >;

export async function migrateDeployedAgentToNewDeployedAgentTemplate(
  req: MigrateDeployedAgentToNewDeployedAgentTemplateType
): Promise<MigrateDeployedAgentToNewDeployedAgentTemplateResponseType> {
  const { agentDeploymentId } = req.params;
  const { deployedAgentTemplateKey, preserveCoreMemories } = req.body;

  const agent = await db.query.deployedAgents.findFirst({
    where: eq(deployedAgents.id, agentDeploymentId),
  });

  if (!agent) {
    return {
      status: 404,
      body: {
        message: 'Deployed Agent not found',
      },
    };
  }

  const deployedAgentTemplate = await db.query.deployedAgentTemplates.findFirst(
    {
      where: and(
        eq(deployedAgentTemplates.organizationId, agent.organizationId),
        eq(deployedAgentTemplates.key, deployedAgentTemplateKey)
      ),
    }
  );

  if (!deployedAgentTemplate) {
    return {
      status: 404,
      body: {
        message: 'Source agent not found',
      },
    };
  }

  const sourceSDKAgent = await AgentsService.getAgent({
    agentId: deployedAgentTemplate.id,
  });

  const newDatasources = await AgentsService.getAgentSources({
    agentId: agent.id || '',
  });

  await migrateToNewAgent({
    preserveCoreMemories,
    agentIdToMigrate: agent.id,
    agentTemplate: sourceSDKAgent,
    agentDatasourcesIds: newDatasources
      .map((datasource) => datasource.id)
      .filter(Boolean) as string[],
  });

  return {
    status: 200,
    body: {
      agentDeploymentId,
    },
  };
}

type GetExistingMessagesFromDeployedAgentRequestType = ServerInferRequest<
  typeof sdkContracts.deployment.getExistingMessagesFromAgent
>;

type GetExistingMessagesFromDeployedAgentResponseType = ServerInferResponses<
  typeof sdkContracts.deployment.getExistingMessagesFromAgent
>;

export async function getExistingMessagesFromAgent(
  req: GetExistingMessagesFromDeployedAgentRequestType
): Promise<GetExistingMessagesFromDeployedAgentResponseType> {
  const { agentDeploymentId } = req.params;
  const {
    before,
    limit,
    format_function_call_arguments,
    return_function_calls,
    return_message_types,
    format_user_message_arguments,
  } = req.query;

  const agent = await db.query.deployedAgents.findFirst({
    where: eq(deployedAgents.id, agentDeploymentId),
  });

  if (!agent) {
    return {
      status: 404,
      body: {
        message: 'Agent not found',
      },
    };
  }

  let messages = (await AgentsService.listAgentMessages({
    agentId: agent.id,
    before,
    limit,
  })) as AgentMessage[];

  if (
    format_function_call_arguments ||
    return_function_calls ||
    return_message_types
  ) {
    messages = messages
      .map((message) => {
        if (return_message_types) {
          if (!return_message_types.includes(message.message_type)) {
            return null;
          }
        }

        const parsedMessageRes = AgentMessageSchema.safeParse(message);

        if (parsedMessageRes.success) {
          const parsedMessage = parsedMessageRes.data;

          if (parsedMessage.message_type === 'function_call') {
            if (return_function_calls) {
              if (
                !return_function_calls.includes(
                  parsedMessage.function_call.name || ''
                )
              ) {
                return null;
              }
            }

            return {
              ...parsedMessage,
              function_call: {
                ...parsedMessage.function_call,
                formattedArguments:
                  format_function_call_arguments &&
                  parsedMessage.function_call.arguments
                    ? safeParseArguments(parsedMessage.function_call.arguments)
                    : parsedMessage.function_call.formattedArguments,
              },
            };
          } else if (parsedMessage.message_type === 'user_message') {
            return {
              ...parsedMessage,
              formattedMessage: format_user_message_arguments
                ? safeParseArguments(parsedMessage.message)
                : parsedMessage.formattedMessage,
            };
          }
        }

        return message;
      })
      .filter((message) => message !== null);
  }

  return {
    status: 200,
    body: {
      messages,
    },
  };
}

type QueryDeployedAgentsRequestType = ServerInferRequest<
  typeof sdkContracts.deployment.queryDeployedAgents
>;

type QueryDeployedAgentsResponseType = ServerInferResponses<
  typeof sdkContracts.deployment.queryDeployedAgents
>;

export async function queryDeployedAgents(
  req: QueryDeployedAgentsRequestType,
  context: AuthedRequestType
): Promise<QueryDeployedAgentsResponseType> {
  const {
    uniqueIdentifier,
    deployedAgentTemplateKey,
    limit,
    offset,
    projectId,
  } = req.query;
  const { organizationId } = context.request;

  const queryBuilder = [eq(deployedAgents.organizationId, organizationId)];

  if (projectId) {
    queryBuilder.push(eq(deployedAgents.projectId, projectId));
  }

  if (uniqueIdentifier) {
    queryBuilder.push(eq(deployedAgents.key, uniqueIdentifier));
  }

  if (deployedAgentTemplateKey) {
    queryBuilder.push(
      eq(deployedAgents.deployedAgentTemplateKey, deployedAgentTemplateKey)
    );
  }

  const agentsResponse = await db.query.deployedAgents.findMany({
    where: and(...queryBuilder),
    limit,
    offset,
  });

  return {
    status: 200,
    body: {
      agents: agentsResponse.map((agent) => ({
        id: agent.id,
        deployedAgentTemplateKey: agent.deployedAgentTemplateKey,
        uniqueIdentifier: agent.key,
        createdAt: agent.createdAt.toISOString(),
      })),
    },
  };
}
