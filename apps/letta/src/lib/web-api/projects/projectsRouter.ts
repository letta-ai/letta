import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import {
  db,
  deployedAgents,
  projects,
  deployedAgentTemplates,
  agentTemplates,
} from '@letta-web/database';
import {
  getUserOrganizationIdOrThrow,
  getUserOrThrow,
} from '$letta/server/auth';
import { eq, and, like, desc, count } from 'drizzle-orm';
import type { contracts, projectsContract } from '$letta/web-api/contracts';
import { capitalize } from 'lodash';
import { copyAgentById } from '$letta/sdk';
import { generateSlug } from '$letta/server';

type ResponseShapes = ServerInferResponses<typeof projectsContract>;
type GetProjectsRequest = ServerInferRequest<
  typeof projectsContract.getProjects
>;

export async function getProjects(
  req: GetProjectsRequest
): Promise<ResponseShapes['getProjects']> {
  const { search, offset, limit } = req.query;

  const organizationId = await getUserOrganizationIdOrThrow();

  const projectsList = await db.query.projects.findMany({
    where: and(
      eq(projects.organizationId, organizationId),
      like(projects.name, search || '%')
    ),
    columns: {
      name: true,
      id: true,
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

  const organizationId = await getUserOrganizationIdOrThrow();

  const query = [eq(projects.organizationId, organizationId)];

  if (lookupBy === 'slug') {
    query.push(eq(projects.slug, projectId));
  } else {
    query.push(eq(projects.id, projectId));
  }

  const project = await db.query.projects.findFirst({
    where: and(...query),
    columns: {
      name: true,
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

  const organizationId = await getUserOrganizationIdOrThrow();

  let projectSlug = generateSlug(name);

  const existingProject = await db.query.projects.findFirst({
    where: and(
      eq(projects.organizationId, organizationId),
      eq(projects.slug, projectSlug)
    ),
  });

  if (existingProject) {
    // get total project count
    const projectCount = await db
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
  const organizationId = await getUserOrganizationIdOrThrow();
  const { projectId } = req.params;
  const { search, offset, agentTemplateId, limit, includeAgentTemplateInfo } =
    req.query;

  const where = [
    eq(deployedAgentTemplates.organizationId, organizationId),
    eq(deployedAgentTemplates.projectId, projectId),
  ];

  if (search) {
    where.push(like(deployedAgentTemplates.version, search || '%'));
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

type GetProjectDeployedAgentTemplateRequest = ServerInferRequest<
  typeof contracts.projects.getProjectDeployedAgentTemplate
>;

type GetProjectDeployedAgentTemplateResponse = ServerInferResponses<
  typeof contracts.projects.getProjectDeployedAgentTemplate
>;

export async function getProjectDeployedAgentTemplate(
  req: GetProjectDeployedAgentTemplateRequest
): Promise<GetProjectDeployedAgentTemplateResponse> {
  const organizationId = await getUserOrganizationIdOrThrow();
  const { projectId, deployedAgentTemplateId } = req.params;

  const deployedAgentTemplate = await db.query.deployedAgentTemplates.findFirst(
    {
      where: and(
        eq(deployedAgentTemplates.organizationId, organizationId),
        eq(deployedAgentTemplates.projectId, projectId),
        eq(deployedAgentTemplates.id, deployedAgentTemplateId)
      ),
      columns: {
        id: true,
        agentTemplateId: true,
        createdAt: true,
        updatedAt: true,
        version: true,
      },
    }
  );

  if (!deployedAgentTemplate) {
    return {
      status: 404,
      body: {},
    };
  }

  return {
    status: 200,
    body: {
      id: deployedAgentTemplate.id,
      agentTemplateId: deployedAgentTemplate.agentTemplateId,
      version: deployedAgentTemplate.version,
      createdAt: deployedAgentTemplate.createdAt.toISOString(),
      updatedAt: deployedAgentTemplate.updatedAt.toISOString(),
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
  const organizationId = await getUserOrganizationIdOrThrow();
  const { projectId } = req.params;
  const { search, offset, limit = 10, deployedAgentTemplateId } = req.query;

  const where = [
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

type GetProjectAgentTemplateRequest = ServerInferRequest<
  typeof contracts.projects.getTestingAgentByIdOrName
>;

type GetProjectAgentTemplateResponse = ServerInferResponses<
  typeof contracts.projects.getTestingAgentByIdOrName
>;

export async function getTestingAgentByIdOrName(
  req: GetProjectAgentTemplateRequest
): Promise<GetProjectAgentTemplateResponse> {
  const organizationId = await getUserOrganizationIdOrThrow();
  const { lookupValue } = req.params;
  const { lookupBy } = req.query;

  const query = [eq(agentTemplates.organizationId, organizationId)];

  if (lookupBy === 'name') {
    query.push(eq(agentTemplates.name, lookupValue));
  } else {
    query.push(eq(agentTemplates.id, lookupValue));
  }

  const testingAgent = await db.query.agentTemplates.findFirst({
    where: and(...query),
    columns: {
      id: true,
      name: true,
      updatedAt: true,
    },
  });

  if (!testingAgent) {
    return {
      status: 404,
      body: {},
    };
  }

  return {
    status: 200,
    body: {
      id: testingAgent.id,
      name: testingAgent.name,
      updatedAt: testingAgent.updatedAt.toISOString(),
    },
  };
}

type GetDeployedAgentsCountByDeployedAgentTemplateRequest = ServerInferRequest<
  typeof contracts.projects.getDeployedAgentsCountByDeployedAgentTemplate
>;

type GetDeployedAgentsCountByDeployedAgentTemplateResponse =
  ServerInferResponses<
    typeof contracts.projects.getDeployedAgentsCountByDeployedAgentTemplate
  >;

export async function getDeployedAgentsCountByDeployedAgentTemplate(
  req: GetDeployedAgentsCountByDeployedAgentTemplateRequest
): Promise<GetDeployedAgentsCountByDeployedAgentTemplateResponse> {
  const organizationId = await getUserOrganizationIdOrThrow();
  const { projectId } = req.params;
  const { deployedAgentTemplateId } = req.query;

  const [result] = await db
    .select({ count: count() })
    .from(deployedAgents)
    .where(
      and(
        eq(deployedAgents.organizationId, organizationId),
        eq(deployedAgents.projectId, projectId),
        eq(deployedAgents.deployedAgentTemplateId, deployedAgentTemplateId)
      )
    );

  return {
    status: 200,
    body: {
      count: result.count,
    },
  };
}

type ForkAgentTemplateRequest = ServerInferRequest<
  typeof contracts.projects.forkAgentTemplate
>;

type ForkAgentTemplateResponse = ServerInferResponses<
  typeof contracts.projects.forkAgentTemplate
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
  const organizationId = await getUserOrganizationIdOrThrow();
  const { name } = req.body;

  const project = await db.query.projects.findFirst({
    where: and(
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

  await db
    .update(projects)
    .set({
      name,
    })
    .where(eq(projects.id, projectId));

  return {
    status: 200,
    body: {
      name: name || project.name,
      id: project.id,
      slug: project.slug,
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
  const organizationId = await getUserOrganizationIdOrThrow();

  const project = await db.query.projects.findFirst({
    where: and(
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

  await db.delete(projects).where(eq(projects.id, projectId));

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
  getProjectDeployedAgentTemplate,
  getTestingAgentByIdOrName,
  getDeployedAgentsCountByDeployedAgentTemplate,
  forkAgentTemplate,
  updateProject,
  deleteProject,
  getDeployedAgents,
};
