import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { pdkContracts } from '../../contracts';
import type { AuthedRequestType } from '../../shared';
import {
  db,
  deployedAgents,
  deployedAgentsStatistics,
  sourceAgents,
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
  typeof pdkContracts.deployment.createAgent
>;
type CreateAgentResponseType = ServerInferResponses<
  typeof pdkContracts.deployment.createAgent
>;

export async function createAgent(
  req: CreateAgentRequestType,
  context: AuthedRequestType
): Promise<CreateAgentResponseType> {
  const { sourceAgentKey, uniqueIdentifier } = req.body;
  const { organizationId } = context.request;

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

  const sourceAgent = await db.query.sourceAgents.findFirst({
    where: and(
      eq(sourceAgents.organizationId, organizationId),
      eq(sourceAgents.key, sourceAgentKey)
    ),
  });

  if (!sourceAgent) {
    return {
      status: 404,
      body: {
        message: 'Source agent not found',
      },
    };
  }

  const copiedAgent = await copyAgentById(
    sourceAgent.agentId,
    crypto.randomUUID()
  );

  const lastDeployedAgent = await db.query.deployedAgents.findFirst({
    where: eq(deployedAgents.sourceAgentId, sourceAgent.id),
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
    uniqueIdentifier || `${sourceAgentKey}-${nextInternalAgentCountId}`;

  const [deployedAgent] = await db
    .insert(deployedAgents)
    .values({
      projectId: sourceAgent.projectId,
      key,
      agentId: copiedAgent.id,
      internalAgentCountId: nextInternalAgentCountId,
      sourceAgentKey: sourceAgent.key,
      sourceAgentId: sourceAgent.id,
      organizationId,
    })
    .returning({ id: deployedAgents.id });

  await Promise.all([
    db.insert(deployedAgentsStatistics).values({
      id: deployedAgent.id,
      messageCount: 0,
      lastActiveAt: new Date(),
    }),
  ]);

  return {
    status: 201,
    body: {
      agentDeploymentId: deployedAgent.id,
    },
  };
}

type ChatWithAgentResponseType = ServerInferResponses<
  typeof pdkContracts.deployment.chatWithAgent
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

type GetDeployedAgentSDKIdRequestType = ServerInferRequest<
  typeof pdkContracts.deployment.getDeployedAgentSdkId
>;

type GetDeployedAgentSDKIdResponseType = ServerInferResponses<
  typeof pdkContracts.deployment.getDeployedAgentSdkId
>;

export async function getDeployedAgentSdkId(
  req: GetDeployedAgentSDKIdRequestType
): Promise<GetDeployedAgentSDKIdResponseType> {
  const { agentDeploymentId } = req.params;

  const deployedAgent = await db.query.deployedAgents.findFirst({
    where: eq(deployedAgents.id, agentDeploymentId),
  });

  if (!deployedAgent) {
    return {
      status: 404,
      body: {
        message: 'Agent not found',
      },
    };
  }

  return {
    status: 200,
    body: {
      sdkId: deployedAgent.agentId,
    },
  };
}

type MigrateDeployedAgentToNewSourceAgentType = ServerInferRequest<
  typeof pdkContracts.deployment.migrateDeployedAgentToNewSourceAgent
>;

type MigrateDeployedAgentToNewSourceAgentResponseType = ServerInferResponses<
  typeof pdkContracts.deployment.migrateDeployedAgentToNewSourceAgent
>;

export async function migrateDeployedAgentToNewSourceAgent(
  req: MigrateDeployedAgentToNewSourceAgentType
): Promise<MigrateDeployedAgentToNewSourceAgentResponseType> {
  const { agentDeploymentId } = req.params;
  const { sourceAgentKey, preserveCoreMemories } = req.body;

  const deployedAgent = await db.query.deployedAgents.findFirst({
    where: eq(deployedAgents.id, agentDeploymentId),
  });

  if (!deployedAgent) {
    return {
      status: 404,
      body: {
        message: 'Deployed Agent not found',
      },
    };
  }

  const sourceAgent = await db.query.sourceAgents.findFirst({
    where: and(
      eq(sourceAgents.organizationId, deployedAgent.organizationId),
      eq(sourceAgents.key, sourceAgentKey)
    ),
  });

  if (!sourceAgent) {
    return {
      status: 404,
      body: {
        message: 'Source agent not found',
      },
    };
  }

  const sourceSDKAgent = await AgentsService.getAgent({
    agentId: sourceAgent.agentId,
  });

  const newDatasources = await AgentsService.getAgentSources({
    agentId: deployedAgent.agentId || '',
  });

  await migrateToNewAgent({
    preserveCoreMemories,
    agentIdToMigrate: deployedAgent.agentId,
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
  typeof pdkContracts.deployment.getExistingMessagesFromAgent
>;

type GetExistingMessagesFromDeployedAgentResponseType = ServerInferResponses<
  typeof pdkContracts.deployment.getExistingMessagesFromAgent
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

  const deployedAgent = await db.query.deployedAgents.findFirst({
    where: eq(deployedAgents.id, agentDeploymentId),
  });

  if (!deployedAgent) {
    return {
      status: 404,
      body: {
        message: 'Agent not found',
      },
    };
  }

  let messages = (await AgentsService.listAgentMessages({
    agentId: deployedAgent.agentId,
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
  typeof pdkContracts.deployment.queryDeployedAgents
>;

type QueryDeployedAgentsResponseType = ServerInferResponses<
  typeof pdkContracts.deployment.queryDeployedAgents
>;

export async function queryDeployedAgents(
  req: QueryDeployedAgentsRequestType,
  context: AuthedRequestType
): Promise<QueryDeployedAgentsResponseType> {
  const { uniqueIdentifier, sourceAgentKey, limit, offset, projectId } =
    req.query;
  const { organizationId } = context.request;

  const queryBuilder = [eq(deployedAgents.organizationId, organizationId)];

  if (projectId) {
    queryBuilder.push(eq(deployedAgents.projectId, projectId));
  }

  if (uniqueIdentifier) {
    queryBuilder.push(eq(deployedAgents.key, uniqueIdentifier));
  }

  if (sourceAgentKey) {
    queryBuilder.push(eq(deployedAgents.sourceAgentKey, sourceAgentKey));
  }

  const deployedAgentsResponse = await db.query.deployedAgents.findMany({
    where: and(...queryBuilder),
    limit,
    offset,
  });

  return {
    status: 200,
    body: {
      deployedAgents: deployedAgentsResponse.map((deployedAgent) => ({
        sdkId: deployedAgent.agentId,
        id: deployedAgent.id,
        sourceAgentKey: deployedAgent.sourceAgentKey,
        uniqueIdentifier: deployedAgent.key,
        createdAt: deployedAgent.createdAt.toISOString(),
      })),
    },
  };
}
