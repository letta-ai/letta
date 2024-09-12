import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { pdkContracts } from '../../contracts';
import type { AuthedRequestType } from '../../shared';
import {
  db,
  deployedAgents,
  deployedAgentsStatistics,
  sourceAgents,
  sourceAgentsStatistics,
} from '@letta-web/database';
import { and, eq, sql } from 'drizzle-orm';
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
  const { sourceAgentId } = req.body;
  const { organizationId } = context.request;

  const sourceAgent = await db.query.sourceAgents.findFirst({
    where: and(
      eq(sourceAgents.organizationId, organizationId),
      eq(sourceAgents.id, sourceAgentId)
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

  if (!copiedAgent.id) {
    return {
      status: 500,
      body: {
        message: 'Failed to copy agent',
      },
    };
  }

  const [deployedAgent] = await db
    .insert(deployedAgents)
    .values({
      projectId: sourceAgent.projectId,
      name: sourceAgent.name,
      agentId: copiedAgent.id,
      sourceAgentId: sourceAgentId,
      organizationId,
    })
    .returning({ id: deployedAgents.id });

  await Promise.all([
    db.insert(deployedAgentsStatistics).values({
      id: deployedAgent.id,
      messageCount: 0,
      lastActiveAt: new Date(),
    }),
    db
      .update(sourceAgentsStatistics)
      .set({
        deployedAgentCount: sql`${sourceAgentsStatistics.deployedAgentCount} + 1`,
      })
      .where(eq(sourceAgentsStatistics.id, sourceAgent.id)),
  ]);

  return {
    status: 201,
    body: {
      deployedAgentId: deployedAgent.id,
    },
  };
}

export async function chatWithAgent() {
  // This is a stub, the actual implementation of this code is in `/pdk/v1/agents/[deployedAgentId]/chat/route.ts`

  return {
    status: 501,
    body: {
      message: 'Not implemented',
    },
  };
}
