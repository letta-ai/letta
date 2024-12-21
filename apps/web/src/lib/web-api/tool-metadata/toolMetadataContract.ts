import { z } from 'zod';
import { initContract } from '@ts-rest/core';
import type { GenericSearch } from '$web/web-api/shared/sharedContracts';
import { GenericSearchSchema } from '$web/web-api/shared/sharedContracts';
import { ProviderSchemaConfiguration } from '@letta-web/types';

export const ToolGroup = z.object({
  brand: z.string(),
  toolCount: z.number(),
  imageUrl: z.string().nullable(),
  description: z.string(),
});

export type ToolGroupType = z.infer<typeof ToolGroup>;

export const ToolMetadataPreview = z.object({
  name: z.string(),
  description: z.string(),
  id: z.string(),
  brand: z.string(),
  provider: z.string(),
  providerId: z.string().optional(),
  imageUrl: z.string().nullable(),
});

export type ToolMetadataPreviewType = z.infer<typeof ToolMetadataPreview>;

export const ToolMetadata = z.object({
  name: z.string(),
  description: z.string(),
  id: z.string(),
  brand: z.string(),
  configuration: ProviderSchemaConfiguration.nullable(),
  provider: z.string(),
  providerId: z.string(),
});

export const ListToolsResponse = z.object({
  toolMetadata: z.array(ToolMetadataPreview),
  hasNextPage: z.boolean(),
});

export const ToolMetadataSummary = z.object({
  toolCountByBrand: z.record(z.string(), z.number()),
  allToolsCount: z.number(),
});

const c = initContract();

const getToolMetadataSummaryContract = c.query({
  method: 'GET',
  path: '/tool-metadata-summary',
  responses: {
    200: ToolMetadataSummary,
  },
});

const ListToolGroupsResponse = z.object({
  toolGroups: z.array(ToolGroup),
  hasNextPage: z.boolean(),
});

const listToolGroupMetadataContract = c.query({
  method: 'GET',
  path: '/tool-group-metadata',
  query: GenericSearchSchema,
  responses: {
    200: ListToolGroupsResponse,
  },
});

const ListToolMetaDataQuery = z.object({
  search: z.string().optional(),
  page: z.number().optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
  brand: z.string().optional(),
  providerId: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

type ListToolMetaDataQueryType = z.infer<typeof ListToolMetaDataQuery>;

const listToolMetadataContract = c.query({
  method: 'GET',
  path: '/tool-metadata',
  responses: {
    200: ListToolsResponse,
  },
  query: ListToolMetaDataQuery,
});

const getSingleToolMetadataContract = c.query({
  method: 'GET',
  path: '/tool-metadata/:id',
  responses: {
    200: ToolMetadata,
  },
  params: z.object({
    id: z.string(),
  }),
});

export const toolMetadataContracts = c.router({
  getToolMetadataSummary: getToolMetadataSummaryContract,
  listToolGroupMetadata: listToolGroupMetadataContract,
  listToolMetadata: listToolMetadataContract,
  getSingleToolMetadata: getSingleToolMetadataContract,
});

export const toolMetadataQueryClientKeys = {
  getToolMetadataSummary: ['getToolMetadataSummaryContract'],
  listToolGroupMetadata: ['listToolGroupMetadata'],
  listToolGroupMetadataWithSearch: (search: GenericSearch) => [
    'listToolGroupMetadata',
    search,
  ],
  listToolMetadata: ['listToolMetadata'],
  listToolMetadataWithSearch: (search: ListToolMetaDataQueryType) => [
    'listToolMetadata',
    search,
  ],
  getSingleToolMetadata: (id: string) => ['getSingleToolMetadata', { id }],
};
