import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import type { GenericSearch } from '$letta/web-api/contracts/shared';
import { GenericSearchSchema } from '$letta/web-api/contracts/shared';

const c = initContract();

export const ProjectTestingAgentSchema = z.object({
  name: z.string(),
  id: z.string(),
  updatedAt: z.string(),
});

export const ProjectTestingAgentsSchema = z.array(ProjectTestingAgentSchema);

export type ProjectTestingAgentType = z.infer<typeof ProjectTestingAgentSchema>;
export type ProjectTestingAgentsType = z.infer<
  typeof ProjectTestingAgentsSchema
>;

export const PartialProjectSchema = z.object({
  name: z.string(),
  id: z.string(),
});

export type PartialProjectType = z.infer<typeof PartialProjectSchema>;

export const PublicProjectsSchema = z.object({
  projects: z.array(PartialProjectSchema),
});

export type PublicProjects = z.infer<typeof PublicProjectsSchema>;

/* Create Project */
export const CreateProjectPayloadSchema = z.object({
  name: z.string(),
});

const createProjectContract = c.mutation({
  method: 'POST',
  path: '/projects',
  body: CreateProjectPayloadSchema,
  responses: {
    201: PartialProjectSchema,
  },
});

/* Create Project Testing Agent */
export const CreateProjectTestingAgentPayloadSchema = z.object({
  recipeId: z.string().optional(),
});

const createProjectTestingAgentContract = c.mutation({
  method: 'POST',
  path: '/projects/:projectId/testing-agents',
  pathParams: z.object({
    projectId: z.string(),
  }),
  body: CreateProjectTestingAgentPayloadSchema,
  responses: {
    201: ProjectTestingAgentSchema,
  },
});

/* Get Source Agents */
const ProjectSourceAgentSchema = z.object({
  name: z.string(),
  id: z.string(),
  testingAgentId: z.string(),
  status: z.enum(['live', 'offline']),
  version: z.string(),
  updatedAt: z.string(),
  createdAt: z.string(),
});

const ProjectDeployedAgentsSchema = z.array(ProjectSourceAgentSchema);

export type ProjectDeployedAgentSchemaType = z.infer<
  typeof ProjectSourceAgentSchema
>;
export type ProjectDeployedAgentsSchemaType = z.infer<
  typeof ProjectDeployedAgentsSchema
>;

const getProjectSourceAgentsContract = c.query({
  method: 'GET',
  path: '/projects/:projectId/source-agents',
  pathParams: z.object({
    projectId: z.string(),
  }),
  query: GenericSearchSchema,
  responses: {
    200: ProjectDeployedAgentsSchema,
  },
});

/* Deploy Testing Agent */
const CreateSourceAgentFromAgentBodySchema = z.object({
  testingAgentId: z.string(),
});

const createSourceAgentFromTestingAgentContract = c.mutation({
  method: 'POST',
  path: '/projects/:projectId/source-agents',
  pathParams: z.object({
    projectId: z.string(),
  }),
  body: CreateSourceAgentFromAgentBodySchema,
  responses: {
    201: ProjectSourceAgentSchema,
  },
});

/* Get Single Source Agent */
const getSourceAgentContract = c.query({
  method: 'GET',
  path: '/projects/:projectId/source-agents/:sourceAgentId',
  pathParams: z.object({
    projectId: z.string(),
    sourceAgentId: z.string(),
  }),
  responses: {
    200: ProjectSourceAgentSchema,
  },
});

/* Get Deployed Agents */
const DeployedAgentSchema = z.object({
  name: z.string(),
  id: z.string(),
  sourceAgentId: z.string(),
  agentId: z.string(),
  createdAt: z.string(),
});

const DeployedAgentsSchema = z.array(DeployedAgentSchema);

export type DeployedAgentType = z.infer<typeof DeployedAgentSchema>;
export type DeployedAgentsType = z.infer<typeof DeployedAgentsSchema>;
const GetDeployedAgentsQuerySchema = z.object({
  search: z.string().optional(),
  offset: z.number().optional(),
  limit: z.number().optional(),
  sourceAgentId: z.string().optional(),
});

export type GetDeployedAgentsQueryType = z.infer<
  typeof GetDeployedAgentsQuerySchema
>;

const getDeployedAgentsContract = c.query({
  method: 'GET',
  path: '/projects/:projectId/deployed-agents',
  pathParams: z.object({
    projectId: z.string(),
  }),
  query: GetDeployedAgentsQuerySchema,
  responses: {
    200: DeployedAgentsSchema,
  },
});

export const projectsContract = c.router({
  getProjects: c.query({
    method: 'GET',
    query: GenericSearchSchema,
    path: '/projects',
    responses: {
      200: PublicProjectsSchema,
    },
  }),
  getProjectById: c.query({
    method: 'GET',
    path: '/projects/:projectId',
    pathParams: z.object({
      projectId: z.string(),
    }),
    responses: {
      200: PartialProjectSchema,
    },
  }),
  getProjectTestingAgents: c.query({
    method: 'GET',
    path: '/projects/:projectId/testing-agents',
    pathParams: z.object({
      projectId: z.string(),
    }),
    query: GenericSearchSchema,
    responses: {
      200: ProjectTestingAgentsSchema,
    },
  }),
  createProject: createProjectContract,
  createProjectTestingAgent: createProjectTestingAgentContract,
  getProjectSourceAgents: getProjectSourceAgentsContract,
  createProjectSourceAgentFromTestingAgent:
    createSourceAgentFromTestingAgentContract,
  getProjectSourceAgent: getSourceAgentContract,
  getDeployedAgents: getDeployedAgentsContract,
});

export const projectsQueryClientKeys = {
  getProjects: ['projects'],
  getProjectsWithSearch: (search: GenericSearch) => [
    ...projectsQueryClientKeys.getProjects,
    search,
  ],
  getProjectById: (projectId: string) => ['project', projectId],
  getProjectTestingAgents: (projectId: string) => [
    'project',
    projectId,
    'testing-agents',
  ],
  getProjectTestingAgentsWithSearch: (
    projectId: string,
    search: GenericSearch
  ) => ['project', projectId, 'testing-agents', search],
  getProjectSourceAgents: (projectId: string) => [
    'project',
    projectId,
    'source-agents',
  ],
  getProjectSourceAgentsWithSearch: (
    projectId: string,
    search: GenericSearch
  ) => ['project', projectId, 'source-agents', search],
  getSourceAgentContract: (projectId: string, sourceAgentId: string) => [
    'project',
    projectId,
    'source-agents',
    sourceAgentId,
  ],
  getDeployedAgents: (projectId: string) => [
    'project',
    projectId,
    'deployed-agents',
  ],
  getDeployedAgentsWithSearch: (
    projectId: string,
    search: GetDeployedAgentsQueryType
  ) => ['project', projectId, 'deployed-agents', search],
};
