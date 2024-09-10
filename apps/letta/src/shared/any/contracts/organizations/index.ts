import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

/* Get Current Organization */
export const CurrentOrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  isAdmin: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const getCurrentOrganizationContract = c.query({
  method: 'GET',
  path: '/organizations/self',
  responses: {
    200: CurrentOrganizationSchema,
  },
});

export const organizationsContract = c.router({
  getCurrentOrganization: getCurrentOrganizationContract,
});

export const organizationsQueryClientKeys = {
  getCurrentOrganization: ['organizations', 'self'],
};
