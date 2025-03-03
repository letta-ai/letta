import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import type { GenericSearch } from '../shared';
import { GenericSearchSchema } from '../shared';

const c = initContract();

export const PublicAPIKeySchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const SpecificAPIKeySchema = z.object({
  id: z.string(),
  name: z.string(),
  apiKey: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const APIKeysSchema = z.array(PublicAPIKeySchema);

export type APIKeyType = z.infer<typeof PublicAPIKeySchema>;

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

const GetAPIKeysResponseSchema = z.object({
  apiKeys: APIKeysSchema,
  hasNextPage: z.boolean(),
});

const getAPIKeysContract = c.query({
  method: 'GET',
  query: GenericSearchSchema,
  path: '/api-keys',
  responses: {
    200: GetAPIKeysResponseSchema,
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

const getAPIKeyContract = c.query({
  method: 'GET',
  path: '/api-keys/:apiKeyId',
  pathParams: z.object({
    apiKeyId: z.string(),
  }),
  responses: {
    200: SpecificAPIKeySchema,
  },
});

export const apiKeysContracts = {
  createAPIKey: createAPIKeyContract,
  getAPIKeys: getAPIKeysContract,
  deleteAPIKey: deleteAPIKeyContract,
  getAPIKey: getAPIKeyContract,
};

export const apiKeysQueryKeys = {
  getAPIKeys: ['api-keys'],
  getAPIKeysWithSearch: (search: GenericSearch) => ['api-keys', search],
  getApiKey: (apiKeyId: string) => ['api-keys', apiKeyId],
};
