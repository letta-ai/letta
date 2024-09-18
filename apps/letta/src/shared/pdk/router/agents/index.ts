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
import { copyAgentById } from '$letta/server';
import * as crypto from 'node:crypto';

type CreateAgentRequestType = ServerInferRequest<
  typeof pdkContracts.agents.createAgent
>;
type CreateAgentResponseType = ServerInferResponses<
  typeof pdkContracts.agents.createAgent
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
      deployedAgentId: deployedAgent.id,
    },
  };
}

type ChatWithAgentResponseType = ServerInferResponses<
  typeof pdkContracts.agents.chatWithAgent
>;

export async function chatWithAgent(): Promise<ChatWithAgentResponseType> {
  // This is a stub, the actual implementation of this code is in `/pdk/v1/agents/[deployedAgentId]/chat/route.ts`

  return {
    status: 201,
    body: {
      messages: [],
    },
  };
}
