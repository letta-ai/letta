import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import type { GenericSearch } from '$letta/any/contracts/shared';
import { GenericSearchSchema } from '$letta/any/contracts/shared';
import { PartialProjectSchema } from '$letta/any/contracts/project';

const c = initContract();

export const PublicProjectsSchema = z.object({
  projects: z.array(PartialProjectSchema),
});

export type PublicProjects = z.infer<typeof PublicProjectsSchema>;

export const projectsQueryClientKeys = {
  getProjects: ['projects'],
  getProjectsWithSearch: (search: GenericSearch) => [
    ...projectsQueryClientKeys.getProjects,
    search,
  ],
};

export const projectsContract = c.router({
  getProjects: c.query({
    method: 'GET',
    query: GenericSearchSchema,
    path: '/projects',
    responses: {
      200: PublicProjectsSchema,
    },
  }),
});
