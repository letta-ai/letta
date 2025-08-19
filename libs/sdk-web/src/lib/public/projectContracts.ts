import type { ServerInferResponses } from '@ts-rest/core';
import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import type { GenericSearch } from '../shared';
import { GenericSearchSchema } from '../shared';
import type { InfiniteData } from '@tanstack/query-core';

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
  slug: z.string(),
  updatedAt: z.string(),
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
    400: z.object({
      errorCode: z.enum(['projectLimitReached', 'noPermission']),
    }),
  },
});

/* Update Project */
export const UpdateProjectPayloadSchema = z.object({
  name: z.string().optional(),
  slug: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+$/)
    .optional(),
});

export type UpdateProjectPayloadType = z.infer<
  typeof UpdateProjectPayloadSchema
>;

const updateProjectContract = c.mutation({
  method: 'PATCH',
  path: '/projects/:projectId',
  pathParams: z.object({
    projectId: z.string(),
  }),
  body: UpdateProjectPayloadSchema,
  responses: {
    200: PartialProjectSchema,
    400: z.object({
      errorCode: z.enum(['atLeastOneFieldRequired', 'slugAlreadyTaken']),
    }),
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

/* Get Source Agents */
const ProjectDeployedAgentTemplateSchema = z.object({
  id: z.string(),
  agentTemplateId: z.string(),
  testingAgentName: z.string().optional(),
  version: z.string(),
  updatedAt: z.string(),
  createdAt: z.string(),
});

const ProjectDeployedAgentTemplatesSchema = z.array(
  ProjectDeployedAgentTemplateSchema,
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

export type GetProjectDeployedAgentTemplates200Response = ServerInferResponses<
  typeof getProjectDeployedAgentTemplatesContract,
  200
>;

export type InfiniteGetProjectDeployedAgentTemplates200Response =
  InfiniteData<GetProjectDeployedAgentTemplates200Response>;

/* Get Agents */
const AgentSchema = z.object({
  key: z.string(),
  id: z.string(),
  deployedAgentTemplateId: z.string().nullable(),
  createdAt: z.string(),
});

const _AgentsSchema = z.array(AgentSchema);

export type AgentType = z.infer<typeof AgentSchema>;

/* Get Project By Id */
const getProjectByIdOrSlugContract = c.query({
  method: 'GET',
  path: '/projects/:projectId',
  query: z.object({
    lookupBy: z.enum(['id', 'slug']).optional(),
  }),
  pathParams: z.object({
    projectId: z.string(),
  }),
  responses: {
    200: PartialProjectSchema,
  },
});

export type GetProjectByIdContractSuccessResponse = ServerInferResponses<
  typeof getProjectByIdOrSlugContract,
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
  getProjectByIdOrSlug: getProjectByIdOrSlugContract,
  createProject: createProjectContract,
  getProjectDeployedAgentTemplates: getProjectDeployedAgentTemplatesContract,
  updateProject: updateProjectContract,
  deleteProject: deleteProjectContract,
});

export const projectsQueryClientKeys = {
  getProjects: ['projects'],
  getProjectsWithSearch: (search: GenericSearch) => [
    ...projectsQueryClientKeys.getProjects,
    search,
  ],
  getProjectByIdOrSlug: (idOrSlug: string) => ['project', idOrSlug],
  getProjectDeployedAgentTemplates: (projectId: string) => [
    'project',
    projectId,
    'source-agents',
  ],
  getProjectDeployedAgentTemplatesWithSearch: (
    projectId: string,
    search: SearchDeployedAgentTemplatesQueryType,
  ) => [
    ...projectsQueryClientKeys.getProjectDeployedAgentTemplates(projectId),
    search,
  ],
};
