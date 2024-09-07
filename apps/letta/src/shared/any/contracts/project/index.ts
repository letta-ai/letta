import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

export const PartialProjectSchema = z.object({
  name: z.string(),
  id: z.string(),
});

export type PartialProject = z.infer<typeof PartialProjectSchema>;

export const projectQueryClientKeys = {
  getProjectById: (projectId: string) => ['project', projectId],
};

export const projectContract = c.router({
  getProjectById: c.query({
    method: 'GET',
    path: '/project/:projectId',
    pathParams: z.object({
      projectId: z.string(),
    }),
    responses: {
      200: PartialProjectSchema,
    },
  }),
});
