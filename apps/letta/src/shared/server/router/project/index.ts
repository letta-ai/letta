import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '$letta/any/contracts';
import { db, projects } from '@letta-web/database';
import { getUserOrganizationIdOrThrow } from '$letta/server/auth';
import { eq, and } from 'drizzle-orm';

type GetProjectByIdResponse = ServerInferResponses<
  typeof contracts.project.getProjectById
>;
type GetProjectByIdRequest = ServerInferRequest<
  typeof contracts.project.getProjectById
>;

export async function getProjectById(
  req: GetProjectByIdRequest
): Promise<GetProjectByIdResponse> {
  const { projectId } = req.params;

  const organizationId = await getUserOrganizationIdOrThrow();

  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.organizationId, organizationId)
    ),
    columns: {
      name: true,
      id: true,
    },
  });

  if (!project) {
    return {
      status: 404,
      body: 'Project not found',
    };
  }

  return {
    status: 200,
    body: {
      name: project.name,
      id: project.id,
    },
  };
}
