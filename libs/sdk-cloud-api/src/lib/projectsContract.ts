import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

const PublicProjectDetails = z.object({
  name: z.string(),
  slug: z.string(),
  id: z.string(),
});

const PublicProjectDetailsArray = z.array(PublicProjectDetails);

const PublicProjectDetailsResponse = z.object({
  projects: PublicProjectDetailsArray,
  hasNextPage: z.boolean(),
});

const ListProjectsQuery = z.object({
  name: z.string().optional(),
  offset: z.number().min(0).optional(),
  limit: z.number().min(1).max(20).optional(),
});

const ListProjectsContract = c.query({
  path: '/v1/projects',
  method: 'GET',
  summary: 'List Projects (Cloud-only)',
  description: 'List all projects',
  query: ListProjectsQuery,
  responses: {
    200: PublicProjectDetailsResponse,
  },
});

export const projectsContract = c.router({
  listProjects: ListProjectsContract,
});
