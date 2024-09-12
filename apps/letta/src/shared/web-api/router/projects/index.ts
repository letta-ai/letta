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
import { copyAgentById } from '$letta/server';
import crypto from 'node:crypto';

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
      id: true,
      updatedAt: true,
    },
  });

  return {
    status: 200,
    body: agents.map((agent) => ({
      name: agent.name,
      id: agent.id,
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

  const [agent] = await db
    .insert(testingAgents)
    .values({
      projectId,
      organizationId,
      name: 'New Agent',
      agentId: 'agent-cfcbc295-b906-4b62-ab85-de77a77c27b7',
    })
    .returning({
      id: testingAgents.id,
    });

  return {
    status: 201,
    body: {
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
  const { testingAgentId } = req.body;
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

  const sourceAgentName = `Staged ${testingAgent.name}`;

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
      name: sourceAgentName,
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

  return {
    status: 201,
    body: {
      name: sourceAgentName,
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
  const { search, offset, limit } = req.query;

  const where = [
    eq(sourceAgents.organizationId, organizationId),
    eq(sourceAgents.projectId, projectId),
  ];

  if (search) {
    where.push(like(sourceAgents.name, search || '%'));
  }

  const sourceAgentsList = await db.query.sourceAgents.findMany({
    where: and(...where),
    limit,
    offset,
    orderBy: [desc(sourceAgents.createdAt)],
    columns: {
      id: true,
      name: true,
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
    body: sourceAgentsList.map(({ status, ...rest }) => ({
      id: rest.id,
      name: rest.name,
      testingAgentId: rest.testingAgentId,
      version: rest.version,
      deployedAgentCount: rest.sourceAgentsStatistics.deployedAgentCount,
      createdAt: rest.createdAt.toISOString(),
      updatedAt: rest.updatedAt.toISOString(),
      status: status.status,
    })),
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
      name: true,
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
      name: sourceAgent.name,
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
  const { search, offset, limit, sourceAgentId } = req.query;

  const where = [
    eq(deployedAgents.organizationId, organizationId),
    eq(deployedAgents.projectId, projectId),
  ];

  if (sourceAgentId) {
    where.push(eq(deployedAgents.sourceAgentId, sourceAgentId));
  }

  if (search) {
    where.push(like(deployedAgents.name, search || '%'));
  }

  const existingSourceAgentCount = await db.query.deployedAgents.findMany({
    where: and(...where),
    limit,
    offset,
    columns: {
      id: true,
      name: true,
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
      name: agent.name,
      sourceAgentId: agent.sourceAgentId,
      agentId: agent.agentId,
      messageCount: agent.deployedAgentsStatistics.messageCount,
      lastActiveAt: agent.deployedAgentsStatistics.lastActiveAt.toISOString(),
      createdAt: agent.createdAt.toISOString(),
      updatedAt: agent.updatedAt.toISOString(),
    })),
  };
}
