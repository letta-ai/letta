import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

export const PublicUserSchema = z.object({
  name: z.string(),
  email: z.string(),
  imageUrl: z.string(),
  organizationId: z.string(),
  id: z.string(),
});

export const userQueryClientKeys = {
  getCurrentUser: ['user', 'self'],
};

export const userContract = c.router({
  getCurrentUser: c.query({
    method: 'GET',
    path: '/user/self',
    responses: {
      200: PublicUserSchema,
    },
  }),
});
