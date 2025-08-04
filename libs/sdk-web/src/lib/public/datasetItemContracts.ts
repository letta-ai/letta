import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import type { GenericSearch } from '../shared';
import { GenericSearchSchema } from '../shared';
import { DatasetItemCreateMessageSchema } from '@letta-cloud/sdk-core';

const c = initContract();

export const DatasetItemSchema = z.object({
  id: z.string(),
  datasetId: z.string(),
  createMessage: DatasetItemCreateMessageSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const DatasetItemsSchema = z.array(DatasetItemSchema);
export type DatasetItemType = z.infer<typeof DatasetItemSchema>;

/* Upsert Dataset Item */
export const UpsertDatasetItemPayloadSchema = z.object({
  createMessage: DatasetItemCreateMessageSchema,
});

const upsertDatasetItemContract = c.mutation({
  method: 'PUT',
  path: '/datasets/:datasetId/items',
  pathParams: z.object({
    datasetId: z.string(),
  }),
  body: UpsertDatasetItemPayloadSchema,
  responses: {
    200: DatasetItemSchema, // Updated existing item
    201: DatasetItemSchema, // Created new item
    400: z.object({
      message: z.string(),
      errorCode: z.enum(['validation', 'default']),
    }),
    404: z.object({
      message: z.string(),
    }),
  },
});

/* Get Dataset Items */
const GetDatasetItemsResponseSchema = z.object({
  datasetItems: DatasetItemsSchema,
  hasNextPage: z.boolean(),
});

const getDatasetItemsContract = c.query({
  method: 'GET',
  path: '/datasets/:datasetId/items',
  pathParams: z.object({
    datasetId: z.string(),
  }),
  query: GenericSearchSchema,
  responses: {
    200: GetDatasetItemsResponseSchema,
    404: z.object({
      message: z.string(),
    }),
  },
});

/* Get Single Dataset Item */
const getDatasetItemContract = c.query({
  method: 'GET',
  path: '/datasets/:datasetId/items/:datasetItemId',
  pathParams: z.object({
    datasetId: z.string(),
    datasetItemId: z.string(),
  }),
  responses: {
    200: DatasetItemSchema,
    404: z.object({
      message: z.string(),
    }),
  },
});

/* Update Dataset Item */
export const UpdateDatasetItemPayloadSchema = z.object({
  createMessage: DatasetItemCreateMessageSchema,
});

const updateDatasetItemContract = c.mutation({
  method: 'PUT',
  path: '/datasets/:datasetId/items/:datasetItemId',
  pathParams: z.object({
    datasetId: z.string(),
    datasetItemId: z.string(),
  }),
  body: UpdateDatasetItemPayloadSchema,
  responses: {
    200: DatasetItemSchema,
    400: z.object({
      message: z.string(),
      errorCode: z.enum(['validation', 'default']),
    }),
    404: z.object({
      message: z.string(),
    }),
  },
});

/* Delete Dataset Item */
const deleteDatasetItemContract = c.mutation({
  method: 'DELETE',
  path: '/datasets/:datasetId/items/:datasetItemId',
  pathParams: z.object({
    datasetId: z.string(),
    datasetItemId: z.string(),
  }),
  body: null,
  responses: {
    204: null,
    404: z.object({
      message: z.string(),
    }),
  },
});

export const datasetItemContracts = {
  upsertDatasetItem: upsertDatasetItemContract,
  getDatasetItems: getDatasetItemsContract,
  getDatasetItem: getDatasetItemContract,
  updateDatasetItem: updateDatasetItemContract,
  deleteDatasetItem: deleteDatasetItemContract,
};

export const datasetItemQueryKeys = {
  getDatasetItems: (datasetId: string) => ['dataset-items', datasetId],
  getDatasetItemsWithSearch: (datasetId: string, search: GenericSearch) => [
    'dataset-items',
    datasetId,
    search,
  ],
  getDatasetItem: (datasetId: string, datasetItemId: string) => [
    'dataset-items',
    datasetId,
    datasetItemId,
  ],
  upsertDatasetItem: (datasetId: string) => [
    'dataset-items',
    datasetId,
    'upsert',
  ],
};
