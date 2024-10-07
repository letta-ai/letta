import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '../contracts';
import {
  getUserOrganizationIdOrThrow,
  getUserOrThrow,
} from '$letta/server/auth';
import { and, desc, eq, like } from 'drizzle-orm';
import { agentTemplates, db } from '@letta-web/database';
import { copyAgentById } from '$letta/sdk';
import { capitalize } from 'lodash';

type ListAgentTemplatesQueryRequest = ServerInferRequest<
  typeof contracts.agentTemplates.listAgentTemplates
>;

type ListAgentTemplatesQueryResponse = ServerInferResponses<
  typeof contracts.agentTemplates.listAgentTemplates
>;

export async function listAgentTemplates(
  req: ListAgentTemplatesQueryRequest
): Promise<ListAgentTemplatesQueryResponse> {
  const { search, offset, limit = 10, projectId } = req.query;

  const organizationId = await getUserOrganizationIdOrThrow();

  const where = [eq(agentTemplates.organizationId, organizationId)];

  if (projectId) {
    where.push(eq(agentTemplates.projectId, projectId));
  }

  if (search) {
    where.push(like(agentTemplates.name, `%${search}%`));
  }

  const agentTemplatesResponse = await db.query.agentTemplates.findMany({
    where: and(...where),
    limit: limit + 1,
    offset,
    orderBy: [desc(agentTemplates.createdAt)],
    columns: {
      name: true,
      id: true,
      updatedAt: true,
    },
  });

  const hasNextPage = agentTemplatesResponse.length > limit;

  return {
    status: 200,
    body: {
      agentTemplates: agentTemplatesResponse
        .slice(0, limit)
        .map((agentTemplate) => {
          return {
            name: agentTemplate.name,
            id: agentTemplate.id,
            updatedAt: agentTemplate.updatedAt.toISOString(),
          };
        }),
      hasNextPage,
    },
  };
}

type ForkAgentTemplateRequest = ServerInferRequest<
  typeof contracts.agentTemplates.forkAgentTemplate
>;

type ForkAgentTemplateResponse = ServerInferResponses<
  typeof contracts.agentTemplates.forkAgentTemplate
>;

export async function forkAgentTemplate(
  req: ForkAgentTemplateRequest
): Promise<ForkAgentTemplateResponse> {
  const { agentTemplateId, projectId } = req.params;
  const { organizationId, lettaAgentsId } = await getUserOrThrow();

  const testingAgent = await db.query.agentTemplates.findFirst({
    where: and(
      eq(agentTemplates.organizationId, organizationId),
      eq(agentTemplates.projectId, projectId),
      eq(agentTemplates.id, agentTemplateId)
    ),
  });

  if (!testingAgent) {
    return {
      status: 404,
      body: {},
    };
  }

  const copiedAgent = await copyAgentById(testingAgent.id, lettaAgentsId);

  if (!copiedAgent.id) {
    return {
      status: 500,
      body: {
        message: 'Failed to copy agent',
      },
    };
  }

  const name = capitalize(`Forked ${testingAgent.name}`);

  const [agent] = await db
    .insert(agentTemplates)
    .values({
      id: copiedAgent.id,
      projectId: testingAgent.projectId,
      organizationId,
      name,
    })
    .returning({
      id: agentTemplates.id,
    });

  return {
    status: 201,
    body: {
      id: agent.id,
      name,
      updatedAt: new Date().toISOString(),
    },
  };
}

export const agentTemplateRoutes = {
  listAgentTemplates,
  forkAgentTemplate,
};
