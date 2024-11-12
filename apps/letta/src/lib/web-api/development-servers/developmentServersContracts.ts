import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import type { GenericSearch } from '$letta/web-api/shared/sharedContracts';
import { GenericSearchSchema } from '$letta/web-api/shared/sharedContracts';

const c = initContract();

export const DevelopmentServerSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const DevelopmentServersSchema = z.array(DevelopmentServerSchema);

/* Get Development Servers */
export const GetDevelopmentServersResponseSchema = z.object({
  developmentServers: DevelopmentServersSchema,
});

const getDevelopmentServersContract = c.query({
  method: 'GET',
  path: '/development-servers',
  responses: {
    200: GetDevelopmentServersResponseSchema,
  },
  query: GenericSearchSchema,
});

/* Create Development Server */
export const CreateDevelopmentServerRequestSchema = z.object({
  name: z.string(),
  url: z.string(),
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
  url: z.string().optional(),
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
};

export const developmentServerQueryClientKeys = {
  getDevelopmentServers: ['development-servers'],
  getDevelopmentServersWithSearch: (search: GenericSearch) => [
    'development-servers',
    search,
  ],
};
