import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import type { GenericSearch } from '$letta/any/contracts/shared';
import { GenericSearchSchema } from '$letta/any/contracts/shared';

const c = initContract();

export const APIKeySchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const APIKeysSchema = z.array(APIKeySchema);

export type APIKeyType = z.infer<typeof APIKeySchema>;

export type APIKeysType = z.infer<typeof APIKeysSchema>;

/* Create API Key */
export const CreateAPIKeyPayloadSchema = z.object({
  name: z.string(),
});

export const CreatedAPIKeySchema = z.object({
  apiKey: z.string(),
});

const createAPIKeyContract = c.mutation({
  method: 'POST',
  path: '/api-keys',
  body: CreateAPIKeyPayloadSchema,
  responses: {
    201: CreatedAPIKeySchema,
  },
});

/* Get API Keys */
const getAPIKeysContract = c.query({
  method: 'GET',
  query: GenericSearchSchema,
  path: '/api-keys',
  responses: {
    200: APIKeysSchema,
  },
});

/* Delete API Key */
const deleteAPIKeyContract = c.mutation({
  method: 'DELETE',
  path: '/api-keys/:apiKeyId',
  pathParams: z.object({
    apiKeyId: z.string(),
  }),
  body: null,
  responses: {
    204: null,
  },
});

export const apiKeysContracts = {
  createAPIKey: createAPIKeyContract,
  getAPIKeys: getAPIKeysContract,
  deleteAPIKey: deleteAPIKeyContract,
};

export const apiKeysQueryKeys = {
  getAPIKeys: ['api-keys'],
  getAPIKeysWithSearch: (search: GenericSearch) => ['api-keys', search],
};
