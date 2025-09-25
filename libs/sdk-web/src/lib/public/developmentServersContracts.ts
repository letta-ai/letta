import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import type { GenericSearch } from '../shared';
import { GenericSearchSchema } from '../shared';

const c = initContract();

export const DevelopmentServerSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  password: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type DevelopmentServerType = z.infer<typeof DevelopmentServerSchema>;

export const DevelopmentServersSchema = z.array(DevelopmentServerSchema);

/* Get Development Servers */
export const GetDevelopmentServersResponseSchema = z.object({
  developmentServers: DevelopmentServersSchema,
  hasMore: z.boolean(),
});

const getDevelopmentServersContract = c.query({
  method: 'GET',
  path: '/development-servers',
  responses: {
    200: GetDevelopmentServersResponseSchema,
  },
  query: GenericSearchSchema,
});

/* Get Development Server */
const GetDevelopmentServerParamsSchema = z.object({
  developmentServerId: z.string(),
});

export const GetDevelopmentServerResponseSchema = z.object({
  developmentServer: DevelopmentServerSchema,
});

export type GetDevelopmentServerResponseType = z.infer<
  typeof GetDevelopmentServerResponseSchema
>;

export const getDevelopmentServerContract = c.query({
  method: 'GET',
  path: '/development-servers/:developmentServerId',
  pathParams: GetDevelopmentServerParamsSchema,
  responses: {
    200: GetDevelopmentServerResponseSchema,
  },
});

/* Create Development Server */
export const CreateDevelopmentServerRequestSchema = z.object({
  name: z.string().min(3).max(50),
  password: z.string(),
  url: z.string().url(),
});

export const CreateDevelopmentServerResponseSchema = z.object({
  developmentServer: DevelopmentServerSchema,
});

export const createDevelopmentServerContract = c.mutation({
  method: 'POST',
  path: '/development-servers',
  body: CreateDevelopmentServerRequestSchema,
  responses: {
    201: CreateDevelopmentServerResponseSchema,
  },
});

/* Update Development Server */
const UpdateDevelopmentServerParamsSchema = z.object({
  developmentServerId: z.string(),
});

export const UpdateDevelopmentServerRequestSchema = z.object({
  name: z.string().min(3).max(50).optional(),
  url: z.string().url().optional(),
  password: z.string().optional(),
});

export type UpdateDevelopmentServerRequestSchemaType = z.infer<
  typeof UpdateDevelopmentServerRequestSchema
>;

export const UpdateDevelopmentServerResponseSchema = z.object({
  developmentServer: DevelopmentServerSchema,
});

export const updateDevelopmentServerContract = c.mutation({
  method: 'PUT',
  path: '/development-servers/:developmentServerId',
  pathParams: UpdateDevelopmentServerParamsSchema,
  body: UpdateDevelopmentServerRequestSchema,
  responses: {
    200: UpdateDevelopmentServerResponseSchema,
  },
});

/* Delete Development Server */
const DeleteDevelopmentServerParamsSchema = z.object({
  developmentServerId: z.string(),
});

export const deleteDevelopmentServerContract = c.mutation({
  method: 'DELETE',
  path: '/development-servers/:developmentServerId',
  pathParams: DeleteDevelopmentServerParamsSchema,
  body: z.undefined(),
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
  },
});

export const developmentServersContracts = {
  getDevelopmentServers: getDevelopmentServersContract,
  createDevelopmentServer: createDevelopmentServerContract,
  updateDevelopmentServer: updateDevelopmentServerContract,
  deleteDevelopmentServer: deleteDevelopmentServerContract,
  getDevelopmentServer: getDevelopmentServerContract,
};

export const developmentServerQueryClientKeys = {
  getDevelopmentServers: ['development-servers'],
  getDevelopmentServersWithSearch: (search: GenericSearch) => [
    'development-servers',
    search,
  ],
  getDevelopmentServer: (developmentServerId: string) => [
    'development-servers',
    developmentServerId,
  ],
};
