import type { ServerInferResponses } from '@ts-rest/core';
import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

export const PublicUserSchema = z.object({
  name: z.string(),
  email: z.string(),
  imageUrl: z.string(),
  theme: z.string(),
  organizationId: z.string(),
  id: z.string(),
});

export type GetUser200ResponseType = ServerInferResponses<
  typeof getUserContract,
  200
>;

const getUserContract = c.query({
  method: 'GET',
  path: '/user/self',
  responses: {
    200: PublicUserSchema,
  },
});

/* Update User */
export const UpdateUserPayloadSchema = z.object({
  name: z.string().optional(),
  theme: z.string().optional(),
});

const updateCurrentUserContract = c.mutation({
  method: 'PUT',
  path: '/user/self',
  body: UpdateUserPayloadSchema,
  responses: {
    200: PublicUserSchema,
  },
});

export const userContract = c.router({
  getCurrentUser: getUserContract,
  updateCurrentUser: updateCurrentUserContract,
});

export const userQueryClientKeys = {
  getCurrentUser: ['user', 'self'],
};
