import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { projectsContract } from '$letta/web-api/contracts/projects';
import {
  db,
  deployedAgents,
  projects,
  sourceAgents,
  sourceAgentsStatistics,
  sourceAgentsStatus,
  testingAgents,
} from '@letta-web/database';
import { getUserOrganizationIdOrThrow } from '$letta/server/auth';
import { eq, and, like, desc } from 'drizzle-orm';
import type { contracts } from '$letta/web-api/contracts';
import { copyAgentById, migrateToNewAgent } from '$letta/server';
import crypto from 'node:crypto';
import {
  adjectives,
  animals,
  colors,
  uniqueNamesGenerator,
} from 'unique-names-generator';
import { AgentsService } from '@letta-web/letta-agents-api';

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
      })),
    },
  };
}

type GetProjectByIdResponse = ServerInferResponses<
  typeof contracts.projects.getProjectById
>;
type GetProjectByIdRequest = ServerInferRequest<
  typeof contracts.projects.getProjectById
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

type GetProjectTestingAgentsResponse = ServerInferResponses<
  typeof contracts.projects.getProjectTestingAgents
>;
type GetProjectTestingAgentsRequest = ServerInferRequest<
  typeof contracts.projects.getProjectTestingAgents
>;

export async function getProjectTestingAgents(
  req: GetProjectTestingAgentsRequest
): Promise<GetProjectTestingAgentsResponse> {
  const { projectId } = req.params;
  const { search, offset, limit } = req.query;
  const organizationId = await getUserOrganizationIdOrThrow();

  const where = [
    eq(testingAgents.organizationId, organizationId),
    eq(testingAgents.projectId, projectId),
  ];

  if (search) {
    where.push(like(testingAgents.name, search || '%'));
  }

  const agents = await db.query.testingAgents.findMany({
    where: and(...where),
    limit,
    offset,
    columns: {
      name: true,
      agentId: true,
      id: true,
      updatedAt: true,
    },
  });

  return {
    status: 200,
    body: agents.map((agent) => ({
      name: agent.name,
      id: agent.id,
      agentId: agent.agentId,
      updatedAt: agent.updatedAt.toISOString(),
    })),
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

  const [project] = await db
    .insert(projects)
    .values({
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
    },
  };
}

type CreateProjectTestingAgentRequest = ServerInferRequest<
  typeof contracts.projects.createProjectTestingAgent
>;
type CreateProjectTestingAgentResponse = ServerInferResponses<
  typeof contracts.projects.createProjectTestingAgent
>;

export async function createProjectTestingAgent(
  req: CreateProjectTestingAgentRequest
): Promise<CreateProjectTestingAgentResponse> {
  const { projectId } = req.params;

  const organizationId = await getUserOrganizationIdOrThrow();

  const newAgent = await copyAgentById(
    'agent-cfcbc295-b906-4b62-ab85-de77a77c27b7',
    crypto.randomUUID()
  );

  if (!newAgent.id) {
    return {
      status: 500,
      body: {
        message: 'Failed to create agent',
      },
    };
  }

  const [agent] = await db
    .insert(testingAgents)
    .values({
      projectId,
      organizationId,
      name: 'New Agent',
      agentId: newAgent.id,
    })
    .returning({
      id: testingAgents.id,
    });

  return {
    status: 201,
    body: {
      agentId: newAgent.id,
      id: agent.id,
      name: 'New Agent',
      updatedAt: new Date().toISOString(),
    },
  };
}

type CreateProjectSourceAgentFromTestingAgentRequest = ServerInferRequest<
  typeof contracts.projects.createProjectSourceAgentFromTestingAgent
>;
type CreateProjectSourceAgentFromTestingAgentResponse = ServerInferResponses<
  typeof contracts.projects.createProjectSourceAgentFromTestingAgent
>;

export async function createProjectSourceAgentFromTestingAgent(
  req: CreateProjectSourceAgentFromTestingAgentRequest
): Promise<CreateProjectSourceAgentFromTestingAgentResponse> {
  const { projectId } = req.params;
  const { testingAgentId, migrateExistingAgents } = req.body;
  const organizationId = await getUserOrganizationIdOrThrow();

  const testingAgent = await db.query.testingAgents.findFirst({
    where: eq(testingAgents.id, testingAgentId),
  });

  if (!testingAgent) {
    return {
      status: 404,
      body: {},
    };
  }

  const existingSourceAgentCount = await db.query.sourceAgents.findMany({
    where: eq(sourceAgents.testingAgentId, testingAgentId),
    columns: {
      id: true,
    },
  });

  const version = `${existingSourceAgentCount.length + 1}`;

  const randomName = uniqueNamesGenerator({
    dictionaries: [adjectives, adjectives, animals, colors],
    length: 4,
    separator: '-',
  });

  const copiedAgent = await copyAgentById(
    testingAgent.agentId,
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

  const [sourceAgent] = await db
    .insert(sourceAgents)
    .values({
      version,
      testingAgentId: testingAgent.id,
      agentId: copiedAgent.id,
      projectId,
      organizationId,
      key: randomName,
    })
    .returning({
      id: sourceAgents.id,
    });

  const defaultStatus = 'live';

  await Promise.all([
    db.insert(sourceAgentsStatus).values({
      status: defaultStatus,
      id: sourceAgent.id,
    }),
    db.insert(sourceAgentsStatistics).values({
      id: sourceAgent.id,
      deployedAgentCount: 0,
    }),
  ]);

  // do this as a job at a later time
  if (migrateExistingAgents) {
    const lastSourceAgent = await db.query.sourceAgents.findFirst({
      where: and(
        eq(sourceAgents.testingAgentId, testingAgent.id),
        eq(sourceAgents.version, `${existingSourceAgentCount.length}`)
      ),
      orderBy: [desc(sourceAgents.createdAt)],
    });

    if (lastSourceAgent) {
      const ids = await db.query.deployedAgents.findMany({
        where: eq(deployedAgents.sourceAgentId, lastSourceAgent.id),
        columns: {
          id: true,
          agentId: true,
        },
      });

      const newDatasources = await AgentsService.getAgentSources({
        agentId: copiedAgent.id || '',
      });

      await Promise.all(
        ids.map(async ({ agentId }) => {
          return migrateToNewAgent({
            agentTemplate: copiedAgent,
            agentIdToMigrate: agentId,
            agentDatasourcesIds: newDatasources
              .map(({ id }) => id)
              .filter(Boolean) as string[],
          });
        })
      );

      await db
        .update(deployedAgents)
        .set({
          sourceAgentId: sourceAgent.id,
          sourceAgentKey: randomName,
        })
        .where(eq(deployedAgents.sourceAgentId, lastSourceAgent.id));
    }
  }

  return {
    status: 201,
    body: {
      deployedAgentCount: 0,
      key: randomName,
      testingAgentId: testingAgent.id,
      id: sourceAgent.id,
      status: defaultStatus,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version,
    },
  };
}

type GetProjectSourceAgentsRequest = ServerInferRequest<
  typeof contracts.projects.getProjectSourceAgents
>;
type GetProjectSourceAgentsResponse = ServerInferResponses<
  typeof contracts.projects.getProjectSourceAgents
>;

export async function getProjectSourceAgents(
  req: GetProjectSourceAgentsRequest
): Promise<GetProjectSourceAgentsResponse> {
  const organizationId = await getUserOrganizationIdOrThrow();
  const { projectId } = req.params;
  const { search, offset, testingAgentId, limit } = req.query;

  const where = [
    eq(sourceAgents.organizationId, organizationId),
    eq(sourceAgents.projectId, projectId),
  ];

  if (search) {
    where.push(like(sourceAgents.key, search || '%'));
  }

  if (testingAgentId) {
    where.push(eq(sourceAgents.testingAgentId, testingAgentId));
  }

  const sourceAgentsList = await db.query.sourceAgents.findMany({
    where: and(...where),
    limit: (limit || 10) + 1,
    offset,
    orderBy: [desc(sourceAgents.createdAt)],
    columns: {
      id: true,
      key: true,
      testingAgentId: true,
      createdAt: true,
      updatedAt: true,
      version: true,
    },
    with: {
      status: true,
      sourceAgentsStatistics: true,
    },
  });

  return {
    status: 200,
    body: {
      sourceAgents: sourceAgentsList
        .slice(0, limit)
        .map(({ status, ...rest }) => ({
          id: rest.id,
          key: rest.key,
          testingAgentId: rest.testingAgentId,
          version: rest.version,
          deployedAgentCount: rest.sourceAgentsStatistics.deployedAgentCount,
          createdAt: rest.createdAt.toISOString(),
          updatedAt: rest.updatedAt.toISOString(),
          status: status.status,
        })),
      hasNextPage: sourceAgentsList.length === limit,
    },
  };
}

type GetProjectSourceAgentRequest = ServerInferRequest<
  typeof contracts.projects.getProjectSourceAgent
>;

type GetProjectSourceAgentResponse = ServerInferResponses<
  typeof contracts.projects.getProjectSourceAgent
>;

export async function getProjectSourceAgent(
  req: GetProjectSourceAgentRequest
): Promise<GetProjectSourceAgentResponse> {
  const organizationId = await getUserOrganizationIdOrThrow();
  const { projectId, sourceAgentId } = req.params;

  const sourceAgent = await db.query.sourceAgents.findFirst({
    where: and(
      eq(sourceAgents.organizationId, organizationId),
      eq(sourceAgents.projectId, projectId),
      eq(sourceAgents.id, sourceAgentId)
    ),
    columns: {
      id: true,
      key: true,
      testingAgentId: true,
      createdAt: true,
      updatedAt: true,
      version: true,
    },
    with: {
      sourceAgentsStatistics: true,
      status: true,
    },
  });

  if (!sourceAgent) {
    return {
      status: 404,
      body: {},
    };
  }

  return {
    status: 200,
    body: {
      id: sourceAgent.id,
      key: sourceAgent.key,
      testingAgentId: sourceAgent.testingAgentId,
      version: sourceAgent.version,
      deployedAgentCount: sourceAgent.sourceAgentsStatistics.deployedAgentCount,
      createdAt: sourceAgent.createdAt.toISOString(),
      updatedAt: sourceAgent.updatedAt.toISOString(),
      status: sourceAgent.status.status,
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
  const { search, offset, limit, sourceAgentId, sourceAgentKey } = req.query;

  const where = [
    eq(deployedAgents.organizationId, organizationId),
    eq(deployedAgents.projectId, projectId),
  ];

  if (sourceAgentId) {
    where.push(eq(deployedAgents.sourceAgentId, sourceAgentId));
  }

  if (sourceAgentKey) {
    where.push(eq(deployedAgents.sourceAgentKey, sourceAgentKey));
  }

  if (search) {
    where.push(like(deployedAgents.key, search || '%'));
  }

  const existingSourceAgentCount = await db.query.deployedAgents.findMany({
    where: and(...where),
    limit,
    offset,
    columns: {
      id: true,
      key: true,
      sourceAgentId: true,
      createdAt: true,
      agentId: true,
      updatedAt: true,
    },
    with: {
      deployedAgentsStatistics: true,
    },
  });

  return {
    status: 200,
    body: existingSourceAgentCount.map((agent) => ({
      id: agent.id,
      key: agent.key,
      sourceAgentId: agent.sourceAgentId,
      agentId: agent.agentId,
      messageCount: agent.deployedAgentsStatistics.messageCount,
      lastActiveAt: agent.deployedAgentsStatistics.lastActiveAt.toISOString(),
      createdAt: agent.createdAt.toISOString(),
      updatedAt: agent.updatedAt.toISOString(),
    })),
  };
}

type GetProjectTestingAgentRequest = ServerInferRequest<
  typeof contracts.projects.getProjectTestingAgent
>;

type GetProjectTestingAgentResponse = ServerInferResponses<
  typeof contracts.projects.getProjectTestingAgent
>;

export async function getProjectTestingAgent(
  req: GetProjectTestingAgentRequest
): Promise<GetProjectTestingAgentResponse> {
  const organizationId = await getUserOrganizationIdOrThrow();
  const { projectId, testingAgentId } = req.params;

  const testingAgent = await db.query.testingAgents.findFirst({
    where: and(
      eq(testingAgents.organizationId, organizationId),
      eq(testingAgents.projectId, projectId),
      eq(testingAgents.id, testingAgentId)
    ),
    columns: {
      id: true,
      name: true,
      updatedAt: true,
      agentId: true,
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
      agentId: testingAgent.agentId,
      id: testingAgent.id,
      name: testingAgent.name,
      updatedAt: testingAgent.updatedAt.toISOString(),
    },
  };
}
