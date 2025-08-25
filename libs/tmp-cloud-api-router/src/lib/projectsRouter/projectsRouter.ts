import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';

import type { cloudContracts } from '@letta-cloud/sdk-cloud-api';
import type { SDKContext } from '../types';
import { getContextDataHack } from '../getContextDataHack/getContextDataHack';
import { db, projects } from '@letta-cloud/service-database';
import { and, eq, ilike, desc } from 'drizzle-orm';
type ListProjectsRequest = ServerInferRequest<
  typeof cloudContracts.projects.listProjects
>;

type ListProjectsResponse = ServerInferResponses<
  typeof cloudContracts.projects.listProjects
>;

async function listProjects(
  req: ListProjectsRequest,
  context: SDKContext,
): Promise<ListProjectsResponse> {
  const { organizationId } = getContextDataHack(req, context);

  const { query } = req;

  const { name, limit = 10, offset = 0 } = query;

  const where = [eq(projects.organizationId, organizationId)];

  if (name) {
    where.push(ilike(projects.name, `%${name}%`));
  }

  const projectsResponse = await db.query.projects.findMany({
    where: and(...where),
    orderBy: [desc(projects.createdAt)],
    offset,
    limit: limit + 1,
  });

  return {
    status: 200,
    body: {
      projects: projectsResponse.slice(0, limit).map((project) => ({
        id: project.id,
        slug: project.slug,
        name: project.name,
      })),
      hasNextPage: projectsResponse.length > limit,
    },
  };
}

export const projectsRouter = {
  listProjects,
};
