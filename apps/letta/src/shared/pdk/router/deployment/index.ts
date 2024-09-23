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
import { AgentsService } from '@letta-web/letta-agents-api';

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
  const { sourceAgentKey } = req.body;
  const { organizationId } = context.request;

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

  const [deployedAgent] = await db
    .insert(deployedAgents)
    .values({
      projectId: sourceAgent.projectId,
      key: `${sourceAgentKey}-${nextInternalAgentCountId}`,
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
