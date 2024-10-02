import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '../contracts';
import { getUserOrganizationIdOrThrow } from '$letta/server/auth';
import { and, desc, eq, like } from 'drizzle-orm';
import { agentTemplates, db } from '@letta-web/database';

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

export const agentTemplateRoutes = {
  listAgentTemplates,
};
