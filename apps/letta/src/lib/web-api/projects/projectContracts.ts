import type { ServerInferResponses } from '@ts-rest/core';
import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import type { GenericSearch } from '$letta/web-api/shared/sharedContracts';
import { GenericSearchSchema } from '$letta/web-api/shared/sharedContracts';
import { AgentRecipieVariant } from '$letta/types';

const c = initContract();

export const ProjectAgentTemplateSchema = z.object({
  name: z.string(),
  id: z.string(),
  updatedAt: z.string(),
});

export const ProjectAgentTemplatesSchema = z.array(ProjectAgentTemplateSchema);

export type ProjectAgentTemplateType = z.infer<
  typeof ProjectAgentTemplateSchema
>;
export type ProjectAgentTemplatesType = z.infer<
  typeof ProjectAgentTemplatesSchema
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

/* Update Project */
export const UpdateProjectPayloadSchema = z.object({
  name: z.string().optional(),
});

const updateProjectContract = c.mutation({
  method: 'PATCH',
  path: '/projects/:projectId',
  pathParams: z.object({
    projectId: z.string(),
  }),
  body: UpdateProjectPayloadSchema,
  responses: {
    200: PartialProjectSchema,
  },
});

/* Delete Project */
const deleteProjectContract = c.mutation({
  method: 'DELETE',
  path: '/projects/:projectId',
  pathParams: z.object({
    projectId: z.string(),
  }),
  body: z.undefined(),
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
  },
});

/* Update Project Testing Agent */
export const UpdateProjectAgentTemplatePayloadSchema = z.object({
  name: z.string().optional(),
});

const updateProjectAgentTemplateContract = c.mutation({
  method: 'PATCH',
  path: '/projects/:projectId/testing-agents/:agentTemplateId',
  pathParams: z.object({
    projectId: z.string(),
    agentTemplateId: z.string(),
  }),
  body: UpdateProjectAgentTemplatePayloadSchema,
  responses: {
    200: ProjectAgentTemplateSchema,
  },
});

/* Delete Project Testing Agent */
const deleteProjectAgentTemplateContract = c.mutation({
  method: 'DELETE',
  path: '/projects/:projectId/testing-agents/:agentTemplateId',
  pathParams: z.object({
    projectId: z.string(),
    agentTemplateId: z.string(),
  }),
  body: z.undefined(),
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
  },
});

/* Create Project Testing Agent */
export const CreateProjectAgentTemplatePayloadSchema = z.object({
  recipeId: z
    .enum([
      AgentRecipieVariant.CUSTOMER_SUPPORT,
      AgentRecipieVariant.DATA_COLLECTOR,
      AgentRecipieVariant.FANTASY_ROLEPLAY,
      AgentRecipieVariant.DEFAULT,
    ])
    .optional(),
});

const createProjectAgentTemplateContract = c.mutation({
  method: 'POST',
  path: '/projects/:projectId/testing-agents',
  pathParams: z.object({
    projectId: z.string(),
  }),
  body: CreateProjectAgentTemplatePayloadSchema,
  responses: {
    201: ProjectAgentTemplateSchema,
  },
});

/* Get Source Agents */
const ProjectDeployedAgentTemplateSchema = z.object({
  key: z.string(),
  id: z.string(),
  agentTemplateId: z.string(),
  testingAgentName: z.string().optional(),
  version: z.string(),
  updatedAt: z.string(),
  createdAt: z.string(),
});

const ProjectDeployedAgentTemplatesSchema = z.array(
  ProjectDeployedAgentTemplateSchema
);
const ProjectDeployedAgentTemplatesResponseSchema = z.object({
  deployedAgentTemplates: ProjectDeployedAgentTemplatesSchema,
  hasNextPage: z.boolean(),
});

export type DeployedAgentTemplateType = z.infer<
  typeof ProjectDeployedAgentTemplateSchema
>;
export type DeployedAgentTemplatesType = z.infer<
  typeof ProjectDeployedAgentTemplatesSchema
>;

const SearchDeployedAgentTemplatesQuerySchema = z.object({
  agentTemplateId: z.string().optional(),
  includeAgentTemplateInfo: z.boolean().optional(),
  search: z.string().optional(),
  offset: z.number().optional(),
  limit: z.number().optional(),
});

type SearchDeployedAgentTemplatesQueryType = z.infer<
  typeof SearchDeployedAgentTemplatesQuerySchema
>;

const getProjectDeployedAgentTemplatesContract = c.query({
  method: 'GET',
  path: '/projects/:projectId/source-agents',
  pathParams: z.object({
    projectId: z.string(),
  }),
  query: SearchDeployedAgentTemplatesQuerySchema,
  responses: {
    200: ProjectDeployedAgentTemplatesResponseSchema,
  },
});

/* Deploy Testing Agent */
const CreateDeployedAgentTemplateFromAgentBodySchema = z.object({
  agentTemplateId: z.string(),
});

const createDeployedAgentTemplateFromAgentTemplateContract = c.mutation({
  method: 'POST',
  path: '/projects/:projectId/source-agents',
  pathParams: z.object({
    projectId: z.string(),
  }),
  body: CreateDeployedAgentTemplateFromAgentBodySchema,
  responses: {
    201: ProjectDeployedAgentTemplateSchema,
  },
});

/* Get Single Source Agent */
const getDeployedAgentTemplateContract = c.query({
  method: 'GET',
  path: '/projects/:projectId/source-agents/:deployedAgentTemplateId',
  pathParams: z.object({
    projectId: z.string(),
    deployedAgentTemplateId: z.string(),
  }),
  responses: {
    200: ProjectDeployedAgentTemplateSchema,
  },
});

/* Get Agents */
const AgentSchema = z.object({
  key: z.string(),
  id: z.string(),
  deployedAgentTemplateId: z.string().nullable(),
  createdAt: z.string(),
});

const DeployedAgentsSchema = z.array(AgentSchema);

export type DeployedAgentType = z.infer<typeof AgentSchema>;
export type DeployedAgentsType = z.infer<typeof DeployedAgentsSchema>;
const GetDeployedAgentsQuerySchema = z.object({
  search: z.preprocess(String, z.string()).optional(),
  offset: z.number().optional(),
  limit: z.number().optional(),
  deployedAgentTemplateId: z.string().optional(),
  deployedAgentTemplateKey: z.string().optional(),
});

export const GetDeployedAgentsContractResponseSchema = z.object({
  agents: DeployedAgentsSchema,
  hasNextPage: z.boolean(),
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
    200: GetDeployedAgentsContractResponseSchema,
  },
});

/* Get Project Testing Agent */
const getProjectAgentTemplateContract = c.query({
  method: 'GET',
  path: '/projects/:projectId/testing-agents/:agentTemplateId',
  pathParams: z.object({
    projectId: z.string(),
    agentTemplateId: z.string(),
  }),
  responses: {
    200: ProjectAgentTemplateSchema,
  },
});

/* Get Deployed Agents Count By Source Agent */
const GetDeployedAgentsCountByDeployedAgentTemplateQuerySchema = z.object({
  deployedAgentTemplateId: z.string(),
});

const GetDeployedAgentsCountByDeployedAgentTemplateResponseSchema = z.object({
  count: z.number(),
});

const getDeployedAgentsCountByDeployedAgentTemplateContract = c.query({
  method: 'GET',
  path: '/projects/:projectId/deployed-agents/count',
  pathParams: z.object({
    projectId: z.string(),
  }),
  query: GetDeployedAgentsCountByDeployedAgentTemplateQuerySchema,
  responses: {
    200: GetDeployedAgentsCountByDeployedAgentTemplateResponseSchema,
  },
});

/* Fork Testing Agent */
const ForkAgentTemplateParamsSchema = z.object({
  projectId: z.string(),
  agentTemplateId: z.string(),
});

const forkAgentTemplateContract = c.mutation({
  method: 'POST',
  path: '/projects/:projectId/testing-agents/:agentTemplateId/fork',
  pathParams: ForkAgentTemplateParamsSchema,
  body: z.undefined(),
  responses: {
    201: ProjectAgentTemplateSchema,
  },
});

/* Get Project By Id */
const getProjectByIdContract = c.query({
  method: 'GET',
  path: '/projects/:projectId',
  pathParams: z.object({
    projectId: z.string(),
  }),
  responses: {
    200: PartialProjectSchema,
  },
});

export type GetProjectByIdContractSuccessResponse = ServerInferResponses<
  typeof getProjectByIdContract,
  200
>;

export const projectsContract = c.router({
  getProjects: c.query({
    method: 'GET',
    query: GenericSearchSchema,
    path: '/projects',
    responses: {
      200: PublicProjectsSchema,
    },
  }),
  getProjectById: getProjectByIdContract,
  getProjectAgentTemplate: getProjectAgentTemplateContract,
  updateProjectAgentTemplate: updateProjectAgentTemplateContract,
  deleteProjectAgentTemplate: deleteProjectAgentTemplateContract,
  getProjectAgentTemplates: c.query({
    method: 'GET',
    path: '/projects/:projectId/testing-agents',
    pathParams: z.object({
      projectId: z.string(),
    }),
    query: GenericSearchSchema,
    responses: {
      200: ProjectAgentTemplatesSchema,
    },
  }),
  createProject: createProjectContract,
  createProjectAgentTemplate: createProjectAgentTemplateContract,
  getProjectDeployedAgentTemplates: getProjectDeployedAgentTemplatesContract,
  createProjectDeployedAgentTemplateFromAgentTemplate:
    createDeployedAgentTemplateFromAgentTemplateContract,
  getProjectDeployedAgentTemplate: getDeployedAgentTemplateContract,
  getDeployedAgents: getDeployedAgentsContract,
  getDeployedAgentsCountByDeployedAgentTemplate:
    getDeployedAgentsCountByDeployedAgentTemplateContract,
  forkAgentTemplate: forkAgentTemplateContract,
  updateProject: updateProjectContract,
  deleteProject: deleteProjectContract,
});

export const projectsQueryClientKeys = {
  getProjects: ['projects'],
  getProjectsWithSearch: (search: GenericSearch) => [
    ...projectsQueryClientKeys.getProjects,
    search,
  ],
  getProjectById: (projectId: string) => ['project', projectId],
  getProjectAgentTemplates: (projectId: string) => [
    'project',
    projectId,
    'testing-agents',
  ],
  getProjectAgentTemplatesWithSearch: (
    projectId: string,
    search: GenericSearch
  ) => ['project', projectId, 'testing-agents', search],
  getProjectDeployedAgentTemplates: (projectId: string) => [
    'project',
    projectId,
    'source-agents',
  ],
  getProjectDeployedAgentTemplatesWithSearch: (
    projectId: string,
    search: SearchDeployedAgentTemplatesQueryType
  ) => [
    ...projectsQueryClientKeys.getProjectDeployedAgentTemplates(projectId),
    search,
  ],
  getDeployedAgentTemplateContract: (
    projectId: string,
    deployedAgentTemplateId: string
  ) => ['project', projectId, 'source-agents', deployedAgentTemplateId],
  getDeployedAgents: (projectId: string) => [
    'project',
    projectId,
    'deployed-agents',
  ],
  getDeployedAgentsWithSearch: (
    projectId: string,
    search: GetDeployedAgentsQueryType
  ) => ['project', projectId, 'deployed-agents', search],
  getProjectAgentTemplate: (projectId: string, agentTemplateId: string) => [
    'project',
    projectId,
    'testing-agents',
    agentTemplateId,
  ],
  getDeployedAgentsCountByDeployedAgentTemplate: (
    projectId: string,
    deployedAgentTemplateId: string
  ) => [
    'project',
    projectId,
    'deployed-agents',
    'count',
    { deployedAgentTemplateId },
  ],
};
