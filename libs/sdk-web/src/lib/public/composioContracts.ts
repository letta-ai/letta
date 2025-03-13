import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

export const composioAuthSchemesSchema = z.object({
  key: z.string(),
});

export const composioTestConnectorsSchema = z.object({
  id: z.string(),
  name: z.string(),
  authScheme: z.string(),
});

const composioAppSchema = z.object({
  appId: z.string(),
  key: z.string(),
  name: z.string(),
  description: z.string(),
  logo: z.string(),
  categories: z.string().array(),
  enabled: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  tags: z.string(),
  auth_schemes: composioAuthSchemesSchema.array(),
  testConnectors: composioTestConnectorsSchema.array(),
  no_auth: z.boolean(),
});

export type ComposioAppType = z.infer<typeof composioAppSchema>;

export const ComposioResponseSchema = z.object({
  items: z.array(composioAppSchema),
  totalPages: z.number(),
});

export type GetComposioAppResponse = z.infer<typeof ComposioResponseSchema>;

const GetComposioApps = c.query({
  method: 'GET',
  path: '/composio/apps',
  summary: 'Get composio apps',
  responses: {
    200: ComposioResponseSchema,
  },
});

const ComposioActionSchema = z.object({
  parameters: z.object({ key: z.string() }),
  response: z.object({ key: z.string() }),
  appKey: z.string(),
  appName: z.string(),
  version: z.string(),
  available_versions: z.array(z.object({ key: z.string() })),
  no_auth: z.boolean(),
  description: z.string(),
  displayName: z.string(),
  enum: z.string(),
  logo: z.string(),
  name: z.string(),
  tags: z.array(z.string()),
  appId: z.string(),
  deprecated: z.boolean(),
});

export type ComposioActionType = z.infer<typeof ComposioActionSchema>;

const SearchComposioActionsSchema = z.object({
  items: ComposioActionSchema.array(),
  page: z.number(),
  totalPages: z.number(),
});

const ComposioActionQuery = z.object({
  query: z.string().optional(),
  limit: z.number().optional(),
  page: z.number().optional(),
  app: z.string(),
});

type ComposioActionQueryType = z.infer<typeof ComposioActionQuery>;

const ListComposioActions = c.query({
  method: 'GET',
  path: '/composio/actions',
  summary: 'List composio actions',
  query: ComposioActionQuery,
  responses: {
    200: SearchComposioActionsSchema,
  },
});

export const composioContracts = c.router({
  getComposioApps: GetComposioApps,
  listComposioActions: ListComposioActions,
});

export const composioQueryKeys = {
  getComposioApps: ['composio-apps'],
  listComposioActions: (query: ComposioActionQueryType) => [
    'composio-actions',
    query,
  ],
};
