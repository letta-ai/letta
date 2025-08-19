import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import {
  agentTemplates,
  db,
  deployedAgentTemplates,
  organizationPreferences,
  projects,
} from '@letta-cloud/service-database';
import { getUserWithActiveOrganizationIdOrThrow } from '$web/server/auth';
import { and, count, desc, eq, ilike, isNull } from 'drizzle-orm';
import type { contracts, projectsContract } from '$web/web-api/contracts';
import { generateSlug } from '$web/server';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { getCurrentOrganizationUsageLimits } from '@letta-cloud/utils-server';
import { trackServerSideEvent } from '@letta-cloud/service-analytics/server';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';

type ResponseShapes = ServerInferResponses<typeof projectsContract>;
type GetProjectsRequest = ServerInferRequest<
  typeof projectsContract.getProjects
>;

export async function getProjects(
  req: GetProjectsRequest,
): Promise<ResponseShapes['getProjects']> {
  const { search, offset, limit } = req.query;

  const user = await getUserWithActiveOrganizationIdOrThrow();

  const { activeOrganizationId, permissions } = user;

  if (!permissions.has(ApplicationServices.READ_PROJECTS)) {
    return {
      status: 403,
      body: {},
    };
  }
  const where = [
    isNull(projects.deletedAt),
    eq(projects.organizationId, activeOrganizationId),
  ];

  if (search) {
    where.push(ilike(projects.name, `%${search}%`));
  }

  const projectsList = await db.query.projects.findMany({
    where: and(...where),
    columns: {
      name: true,
      id: true,
      updatedAt: true,
      slug: true,
    },
    orderBy: [desc(projects.updatedAt)],
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
  req: GetProjectByIdRequest,
): Promise<GetProjectByIdResponse> {
  const { projectId } = req.params;
  const { lookupBy } = req.query;

  const user = await getUserWithActiveOrganizationIdOrThrow();

  const organizationId = user.activeOrganizationId;

  if (!user.permissions.has(ApplicationServices.READ_PROJECTS)) {
    return {
      status: 403,
      body: {},
    };
  }

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
  req: CreateProjectRequest,
): Promise<CreateProjectResponse> {
  const { name } = req.body;
  const user = await getUserWithActiveOrganizationIdOrThrow();

  const organizationId = user.activeOrganizationId;

  if (
    !user.permissions.has(ApplicationServices.CREATE_UPDATE_DELETE_PROJECTS)
  ) {
    return {
      status: 403,
      body: {
        errorCode: 'noPermission',
      },
    };
  }

  void trackServerSideEvent(AnalyticsEvent.CREATED_PROJECT, {
    userId: user.id,
  });

  let projectSlug = generateSlug(name);

  const existingProject = await db.query.projects.findFirst({
    where: and(
      isNull(projects.deletedAt),
      eq(projects.organizationId, organizationId),
      eq(projects.slug, projectSlug),
    ),
  });

  const [{ count: projectCount }] = await db
    .select({ count: count() })
    .from(projects)
    .where(eq(projects.organizationId, organizationId));

  if (existingProject) {
    // get total project count
    projectSlug = `${projectSlug}-${projectCount}`;
  }

  const limits = await getCurrentOrganizationUsageLimits(organizationId);

  if (projectCount >= limits.projects) {
    return {
      status: 400,
      body: {
        errorCode: 'projectLimitReached',
      },
    };
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
  req: GetProjectDeployedAgentTemplatesRequest,
): Promise<GetProjectDeployedAgentTemplatesResponse> {
  const user = await getUserWithActiveOrganizationIdOrThrow();

  const organizationId = user.activeOrganizationId;

  if (
    !user.permissions.has(ApplicationServices.CREATE_UPDATE_DELETE_TEMPLATES)
  ) {
    return {
      status: 403,
      body: {},
    };
  }

  const { projectId } = req.params;
  const { search, offset = 0, agentTemplateId, limit = 10 } = req.query;

  const where = [
    isNull(deployedAgentTemplates.deletedAt),
    eq(deployedAgentTemplates.organizationId, organizationId),
    eq(deployedAgentTemplates.projectId, projectId),
  ];

  if (search) {
    const [name, version] = search.split(':');

    if (name) {
      where.push(ilike(agentTemplates.name, `%${name}%`));
    }

    if (version) {
      where.push(ilike(deployedAgentTemplates.version, `%${version}%`));
    }
  }

  if (agentTemplateId) {
    where.push(eq(deployedAgentTemplates.agentTemplateId, agentTemplateId));
  }

  const deployedAgentTemplatesList = await db
    .select()
    .from(deployedAgentTemplates)
    .innerJoin(
      agentTemplates,
      eq(agentTemplates.id, deployedAgentTemplates.agentTemplateId),
    )
    .where(and(...where))
    .offset(offset)
    .limit(limit + 1);

  return {
    status: 200,
    body: {
      deployedAgentTemplates: deployedAgentTemplatesList
        .slice(0, limit)
        .map(
          ({
            deployed_agent_templates: deployedAgent,
            agent_templates: agentTemplate,
          }) => {
            return {
              id: deployedAgent.id,
              agentTemplateId: deployedAgent.agentTemplateId,
              testingAgentName: agentTemplate.name,
              version: deployedAgent.version,
              createdAt: deployedAgent.createdAt.toISOString(),
              updatedAt: deployedAgent.updatedAt.toISOString(),
            };
          },
        ),
      hasNextPage: deployedAgentTemplatesList.length === limit,
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
  req: UpdateProjectRequest,
): Promise<UpdateProjectResponse> {
  const { projectId } = req.params;
  const { name, slug } = req.body;

  const user = await getUserWithActiveOrganizationIdOrThrow();

  const organizationId = user.activeOrganizationId;

  if (
    !user.permissions.has(ApplicationServices.CREATE_UPDATE_DELETE_PROJECTS)
  ) {
    return {
      status: 403,
      body: {},
    };
  }

  if (Object.values(req.body).filter(Boolean).length === 0) {
    return {
      status: 400,
      body: {
        errorCode: 'atLeastOneFieldRequired',
      },
    };
  }

  const project = await db.query.projects.findFirst({
    where: and(
      isNull(projects.deletedAt),
      eq(projects.id, projectId),
      eq(projects.organizationId, organizationId),
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
        eq(projects.slug, slug),
      ),
    });

    if (existingProject) {
      return {
        status: 400,
        body: {
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
  req: DeleteProjectRequest,
): Promise<DeleteProjectResponse> {
  const { projectId } = req.params;
  const user = await getUserWithActiveOrganizationIdOrThrow();

  const organizationId = user.activeOrganizationId;

  if (
    !user.permissions.has(ApplicationServices.CREATE_UPDATE_DELETE_PROJECTS)
  ) {
    return {
      status: 403,
      body: {},
    };
  }

  const organizationPreferenceRes =
    await db.query.organizationPreferences.findFirst({
      where: eq(organizationPreferences.organizationId, organizationId),
    });

  if (!organizationPreferenceRes) {
    return {
      status: 404,
      body: {},
    };
  }

  if (organizationPreferenceRes.defaultProjectId === projectId) {
    return {
      status: 400,
      body: {
        errorCode: 'defaultProjectCannotBeDeleted',
      },
    };
  }

  const project = await db.query.projects.findFirst({
    where: and(
      isNull(projects.deletedAt),
      eq(projects.id, projectId),
      eq(projects.organizationId, organizationId),
    ),
  });

  if (!project) {
    return {
      status: 404,
      body: {},
    };
  }

  const operations = [];

  // hard delete for now
  operations.push(db.delete(projects).where(eq(projects.id, projectId)));

  operations.push(
    db
      .delete(deployedAgentTemplates)
      .where(eq(deployedAgentTemplates.projectId, projectId)),
  );

  operations.push(
    db.delete(agentTemplates).where(eq(agentTemplates.projectId, projectId)),
  );

  await Promise.all(operations);

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
};
