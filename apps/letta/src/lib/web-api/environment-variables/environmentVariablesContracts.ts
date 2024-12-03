import type { ServerInferResponses } from '@ts-rest/core';
import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import type { GenericSearch } from '$letta/web-api/shared/sharedContracts';

const c = initContract();

export const COMPOSE_IO_KEY_NAME = 'COMPOSE_IO_KEY';
export const HIDDEN_ENVIRONMENT_VARIABLES = [COMPOSE_IO_KEY_NAME];

export const PublicEnvironmentVariableSchema = z.object({
  id: z.string(),
  key: z.string(),
});

export const SetEnvironmentVariablePayloadSchema = z.object({
  key: z.string().regex(/^[a-zA-Z0-9_]+$/),
  value: z.string(),
});

/* Set Environment Variable */
export const SetEnvironmentVariableResponseSchema = z.object({
  id: z.string(),
  key: z.string(),
});

const setEnvironmentVariableContract = c.mutation({
  method: 'POST',
  path: '/environmental-variables',
  body: SetEnvironmentVariablePayloadSchema,
  responses: {
    200: SetEnvironmentVariableResponseSchema,
    201: SetEnvironmentVariableResponseSchema,
  },
});

const GetEnvironmentVariablesSearchSchema = z.object({
  search: z.string(),
});

/* Get Environment Variable By Key */
const GetEnvironmentVariableByKeyResponseSchema = z.object({
  id: z.string(),
  key: z.string(),
});

const getEnvironmentVariableByKeyContract = c.query({
  method: 'GET',
  path: '/environmental-variables/:key',
  pathParams: z.object({
    key: z.string(),
  }),
  responses: {
    200: GetEnvironmentVariableByKeyResponseSchema,
  },
});

export type GetEnvironmentVariableByKey200Response = ServerInferResponses<
  typeof getEnvironmentVariableByKeyContract,
  200
>;

/* Get Environment Variables */
const GetEnvironmentVariablesResponseSchema = z.object({
  environmentVariables: PublicEnvironmentVariableSchema.array(),
  hasNextPage: z.boolean(),
});

const getEnvironmentVariablesContract = c.query({
  method: 'GET',
  query: GetEnvironmentVariablesSearchSchema,
  path: '/environmental-variables',
  responses: {
    200: GetEnvironmentVariablesResponseSchema,
  },
});

/* Delete Environment Variable */

const deleteEnvironmentVariableContract = c.mutation({
  method: 'DELETE',
  path: '/environmental-variables/:id',
  pathParams: z.object({
    id: z.string(),
  }),
  body: z.undefined(),
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
  },
});

export const environmentVariablesContracts = {
  setEnvironmentVariable: setEnvironmentVariableContract,
  getEnvironmentVariables: getEnvironmentVariablesContract,
  deleteEnvironmentVariable: deleteEnvironmentVariableContract,
  getEnvironmentVariableByKey: getEnvironmentVariableByKeyContract,
};

export const environmentVariablesQueryKeys = {
  getEnvironmentVariables: ['getEnvironmentVariables'],
  getEnvironmentVariablesWithSearch: (search: GenericSearch) => [
    ...environmentVariablesQueryKeys.getEnvironmentVariables,
    search,
  ],
  getEnvironmentVariableByKey: (key: string) => [
    'getEnvironmentVariableByKey',
    key,
  ],
};
