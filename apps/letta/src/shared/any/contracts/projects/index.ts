import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import type { GenericSearch } from '$letta/any/contracts/shared';
import { GenericSearchSchema } from '$letta/any/contracts/shared';

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
};
