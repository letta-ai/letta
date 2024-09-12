import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { pdkContracts } from '../../contracts';
import type { AuthedRequestType } from '../../shared';
import { db, deployedAgents, sourceAgents } from '@letta-web/database';
import { and, eq } from 'drizzle-orm';

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

  const [deployedAgent] = await db
    .insert(deployedAgents)
    .values({
      projectId: sourceAgent.projectId,
      name: sourceAgent.name,
      // TODO make another one
      agentId: sourceAgent.agentId,
      sourceAgentId: sourceAgentId,
      organizationId,
    })
    .returning({ id: deployedAgents.id });

  return {
    status: 201,
    body: {
      deployedAgentId: deployedAgent.id,
    },
  };
}

type ChatWithAgentRequestType = ServerInferRequest<
  typeof pdkContracts.agents.chatWithAgent
>;
type ChatWithAgentResponseType = ServerInferResponses<
  typeof pdkContracts.agents.chatWithAgent
>;

export async function chatWithAgent(
  req: ChatWithAgentRequestType,
  context: AuthedRequestType
): Promise<ChatWithAgentResponseType> {
  const { deployedAgentId } = req.params;
  const { message } = req.body;
  const { organizationId } = context.request;

  const deployedAgent = await db.query.deployedAgents.findFirst({
    where: and(
      eq(deployedAgents.organizationId, organizationId),
      eq(deployedAgents.id, deployedAgentId)
    ),
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
    status: 201,
    body: {
      message: `Response from agent ${deployedAgent.name} - ${message}`,
    },
  };
}
