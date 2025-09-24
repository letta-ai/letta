import type { ServerInferResponses } from '@ts-rest/core';
import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import type { GenericSearch } from '../shared';

const c = initContract();


export const PublicEnvironmentVariableSchema = z.object({
  id: z.string(),
  key: z.string(),
  updatedAt: z.string(),
});

export type PublicEnvironmentVariable = z.infer<
  typeof PublicEnvironmentVariableSchema
>;

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
  method: 'PUT',
  path: '/config-environment-variables',
  body: SetEnvironmentVariablePayloadSchema,
  responses: {
    200: SetEnvironmentVariableResponseSchema,
    201: SetEnvironmentVariableResponseSchema,
  },
});

const GetEnvironmentVariablesSearchSchema = z.object({
  search: z.string().optional(),
});

/* Get Environment Variable By Key */
const GetEnvironmentVariableByKeyResponseSchema = z.object({
  id: z.string(),
  key: z.string(),
});

const getEnvironmentVariableByKeyContract = c.query({
  method: 'GET',
  path: '/config-environment-variables/:key',
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

export type GetEnvironmentVariables200Response = ServerInferResponses<
  typeof getEnvironmentVariablesContract,
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
  path: '/config-environment-variables',
  responses: {
    200: GetEnvironmentVariablesResponseSchema,
  },
});

/* Delete Environment Variable */

const deleteEnvironmentVariableContract = c.mutation({
  method: 'DELETE',
  path: '/config-environment-variables/:id',
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

/* Create Environment Variable */
export const CreateEnvironmentVariableSchema = z.object({
  key: z.string(),
  value: z.string(),
});

const createEnvironmentVariableContract = c.mutation({
  method: 'POST',
  path: '/config-environment-variables',
  body: CreateEnvironmentVariableSchema,
  responses: {
    200: SetEnvironmentVariableResponseSchema,
    400: z.object({
      errorCode: z.enum(['keyAlreadyExists']),
      message: z.string(),
    }),
  },
});

export const environmentVariablesContracts = {
  setEnvironmentVariable: setEnvironmentVariableContract,
  createEnvironmentVariable: createEnvironmentVariableContract,
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
