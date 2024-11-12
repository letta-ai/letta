import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import {
  db,
  deployedAgents,
  projects,
  deployedAgentTemplates,
  agentTemplates,
  organizationPreferences,
} from '@letta-web/database';
import { getUserActiveOrganizationIdOrThrow } from '$letta/server/auth';
import { eq, and, like, desc, count, isNull } from 'drizzle-orm';
import type { contracts, projectsContract } from '$letta/web-api/contracts';
import { generateSlug } from '$letta/server';

type ResponseShapes = ServerInferResponses<typeof projectsContract>;
type GetProjectsRequest = ServerInferRequest<
  typeof projectsContract.getProjects
>;

export async function getProjects(
  req: GetProjectsRequest
): Promise<ResponseShapes['getProjects']> {
  const { search, offset, limit } = req.query;

  const organizationId = await getUserActiveOrganizationIdOrThrow();

  const where = [
    isNull(projects.deletedAt),
    eq(projects.organizationId, organizationId),
  ];

  if (search) {
    where.push(like(projects.name, `%${search}%`));
  }

  const projectsList = await db.query.projects.findMany({
    where: and(...where),
    columns: {
      name: true,
      id: true,
      updatedAt: true,
      slug: true,
    },
    offset,
    limit,
  });

  return {
    status: 200,
    body: {
      projects: projectsList.map((project) => ({
        name: project.name,
        updatedAt: project.updatedAt.toISOString(),
        id: project.id,
        slug: project.slug,
      })),
    },
  };
}

type GetProjectByIdResponse = ServerInferResponses<
  typeof contracts.projects.getProjectByIdOrSlug
>;
type GetProjectByIdRequest = ServerInferRequest<
  typeof contracts.projects.getProjectByIdOrSlug
>;

export async function getProjectByIdOrSlug(
  req: GetProjectByIdRequest
): Promise<GetProjectByIdResponse> {
  const { projectId } = req.params;
  const { lookupBy } = req.query;

  const organizationId = await getUserActiveOrganizationIdOrThrow();

  const query = [
    isNull(projects.deletedAt),
    eq(projects.organizationId, organizationId),
  ];

  if (lookupBy === 'slug') {
    query.push(eq(projects.slug, projectId));
  } else {
    query.push(eq(projects.id, projectId));
  }

  const project = await db.query.projects.findFirst({
    where: and(...query),
    columns: {
      name: true,
      updatedAt: true,
      id: true,
      slug: true,
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
      updatedAt: project.updatedAt.toISOString(),
      name: project.name,
      id: project.id,
      slug: project.slug,
    },
  };
}

type CreateProjectRequest = ServerInferRequest<
  typeof contracts.projects.createProject
>;
type CreateProjectResponse = ServerInferResponses<
  typeof contracts.projects.createProject
>;

export async function createProject(
  req: CreateProjectRequest
): Promise<CreateProjectResponse> {
  const { name } = req.body;

  const organizationId = await getUserActiveOrganizationIdOrThrow();

  let projectSlug = generateSlug(name);

  const existingProject = await db.query.projects.findFirst({
    where: and(
      isNull(projects.deletedAt),
      eq(projects.organizationId, organizationId),
      eq(projects.slug, projectSlug)
    ),
  });

  if (existingProject) {
    // get total project count
    const [{ count: projectCount }] = await db
      .select({ count: count() })
      .from(projects)
      .where(eq(projects.organizationId, organizationId));

    projectSlug = `${projectSlug}-${projectCount}`;
  }

  const [project] = await db
    .insert(projects)
    .values({
      slug: projectSlug,
      name,
      organizationId,
    })
    .returning({
      id: projects.id,
    });

  return {
    status: 201,
    body: {
      updatedAt: new Date().toISOString(),
      name: name,
      id: project.id,
      slug: projectSlug,
    },
  };
}

type GetProjectDeployedAgentTemplatesRequest = ServerInferRequest<
  typeof contracts.projects.getProjectDeployedAgentTemplates
>;
type GetProjectDeployedAgentTemplatesResponse = ServerInferResponses<
  typeof contracts.projects.getProjectDeployedAgentTemplates
>;

export async function getProjectDeployedAgentTemplates(
  req: GetProjectDeployedAgentTemplatesRequest
): Promise<GetProjectDeployedAgentTemplatesResponse> {
  const organizationId = await getUserActiveOrganizationIdOrThrow();
  const { projectId } = req.params;
  const { search, offset, agentTemplateId, limit, includeAgentTemplateInfo } =
    req.query;

  const where = [
    isNull(deployedAgentTemplates.deletedAt),
    eq(deployedAgentTemplates.organizationId, organizationId),
    eq(deployedAgentTemplates.projectId, projectId),
  ];

  if (search) {
    where.push(like(deployedAgentTemplates.version, `%${search}%`));
  }

  if (agentTemplateId) {
    where.push(eq(deployedAgentTemplates.agentTemplateId, agentTemplateId));
  }

  const deployedAgentTemplatesList =
    await db.query.deployedAgentTemplates.findMany({
      where: and(...where),
      limit: (limit || 10) + 1,
      offset,
      orderBy: [desc(deployedAgentTemplates.createdAt)],
      columns: {
        id: true,
        agentTemplateId: true,
        createdAt: true,
        updatedAt: true,
        version: true,
      },
      with: {
        ...(includeAgentTemplateInfo
          ? { agentTemplate: { columns: { name: true } } }
          : {}),
      },
    });

  return {
    status: 200,
    body: {
      deployedAgentTemplates: deployedAgentTemplatesList
        .slice(0, limit)
        .map(({ agentTemplate, ...rest }) => ({
          id: rest.id,
          agentTemplateId: rest.agentTemplateId,
          testingAgentName: agentTemplate?.name,
          version: rest.version,
          createdAt: rest.createdAt.toISOString(),
          updatedAt: rest.updatedAt.toISOString(),
        })),
      hasNextPage: deployedAgentTemplatesList.length === limit,
    },
  };
}

type GetProjectDeployedAgentsRequest = ServerInferRequest<
  typeof contracts.projects.getDeployedAgents
>;

type GetProjectDeployedAgentsResponse = ServerInferResponses<
  typeof contracts.projects.getDeployedAgents
>;

export async function getDeployedAgents(
  req: GetProjectDeployedAgentsRequest
): Promise<GetProjectDeployedAgentsResponse> {
  const organizationId = await getUserActiveOrganizationIdOrThrow();
  const { projectId } = req.params;
  const { search, offset, limit = 10, deployedAgentTemplateId } = req.query;

  const where = [
    isNull(deployedAgentTemplates.deletedAt),
    eq(deployedAgents.organizationId, organizationId),
    eq(deployedAgents.projectId, projectId),
  ];

  if (deployedAgentTemplateId) {
    where.push(
      eq(deployedAgents.deployedAgentTemplateId, deployedAgentTemplateId)
    );
  }

  if (search) {
    where.push(like(deployedAgents.key, `%${search}%` || '%'));
  }

  const existingDeployedAgentTemplateCount =
    await db.query.deployedAgents.findMany({
      where: and(...where),
      limit: limit + 1,
      offset,
      columns: {
        id: true,
        key: true,
        deployedAgentTemplateId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [desc(deployedAgents.createdAt)],
    });

  return {
    status: 200,
    body: {
      agents: existingDeployedAgentTemplateCount
        .slice(0, limit)
        .map((agent) => ({
          id: agent.id,
          key: agent.key,
          deployedAgentTemplateId: agent.deployedAgentTemplateId,
          createdAt: agent.createdAt.toISOString(),
          updatedAt: agent.updatedAt.toISOString(),
        })),
      hasNextPage: existingDeployedAgentTemplateCount.length === limit + 1,
    },
  };
}

type UpdateProjectRequest = ServerInferRequest<
  typeof contracts.projects.updateProject
>;

type UpdateProjectResponse = ServerInferResponses<
  typeof contracts.projects.updateProject
>;

export async function updateProject(
  req: UpdateProjectRequest
): Promise<UpdateProjectResponse> {
  const { projectId } = req.params;
  const organizationId = await getUserActiveOrganizationIdOrThrow();
  const { name, slug } = req.body;

  if (Object.values(req.body).filter(Boolean).length === 0) {
    return {
      status: 400,
      body: {
        message: 'At least one field is required',
        errorCode: 'atLeastOneFieldRequired',
      },
    };
  }

  const project = await db.query.projects.findFirst({
    where: and(
      isNull(projects.deletedAt),
      eq(projects.id, projectId),
      eq(projects.organizationId, organizationId)
    ),
  });

  if (!project) {
    return {
      status: 404,
      body: {},
    };
  }

  if (slug) {
    // check if slug is already taken
    const existingProject = await db.query.projects.findFirst({
      where: and(
        eq(projects.organizationId, organizationId),
        eq(projects.slug, slug)
      ),
    });

    if (existingProject) {
      return {
        status: 409,
        body: {
          message: 'Slug already taken',
          errorCode: 'slugAlreadyTaken',
        },
      };
    }
  }

  await db
    .update(projects)
    .set({
      name,
      slug,
    })
    .where(eq(projects.id, projectId));

  return {
    status: 200,
    body: {
      updatedAt: project.updatedAt.toISOString(),
      name: name || project.name,
      id: project.id,
      slug: slug || project.slug,
    },
  };
}

type DeleteProjectRequest = ServerInferRequest<
  typeof contracts.projects.deleteProject
>;

type DeleteProjectResponse = ServerInferResponses<
  typeof contracts.projects.deleteProject
>;

export async function deleteProject(
  req: DeleteProjectRequest
): Promise<DeleteProjectResponse> {
  const { projectId } = req.params;
  const organizationId = await getUserActiveOrganizationIdOrThrow();

  const project = await db.query.projects.findFirst({
    where: and(
      isNull(projects.deletedAt),
      eq(projects.id, projectId),
      eq(projects.organizationId, organizationId)
    ),
  });

  if (!project) {
    return {
      status: 404,
      body: {},
    };
  }

  const operations = [];
  operations.push(
    db
      .update(projects)
      .set({ deletedAt: new Date() })
      .where(eq(projects.id, projectId))
  );

  // delete all deployed agents
  operations.push(
    db
      .update(deployedAgents)
      .set({ deletedAt: new Date() })
      .where(eq(deployedAgents.projectId, projectId))
  );

  // delete all deployed agent templates
  operations.push(
    db
      .update(deployedAgentTemplates)
      .set({ deletedAt: new Date() })
      .where(eq(deployedAgentTemplates.projectId, projectId))
  );

  // delete all templates
  operations.push(
    db
      .update(agentTemplates)
      .set({ deletedAt: new Date() })
      .where(eq(agentTemplates.projectId, projectId))
  );

  await Promise.all([
    ...operations,
    (async () => {
      // check if deleted project is the organizationPreferences.catchAllAgentsProjectId
      // if it is, set it to null

      const isMatching = await db.query.organizationPreferences.findFirst({
        where: and(
          eq(organizationPreferences.organizationId, organizationId),
          eq(organizationPreferences.catchAllAgentsProjectId, projectId)
        ),
      });

      if (isMatching) {
        await db
          .update(organizationPreferences)
          .set({ catchAllAgentsProjectId: null })
          .where(eq(organizationPreferences.organizationId, organizationId));
      }
    })(),
  ]);

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

export const projectsRouter = {
  getProjects,
  getProjectByIdOrSlug,
  createProject,
  getProjectDeployedAgentTemplates,
  updateProject,
  deleteProject,
  getDeployedAgents,
};
