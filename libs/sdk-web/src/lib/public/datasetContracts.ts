import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import type { GenericSearch } from '../shared';
import { GenericSearchSchema } from '../shared';

const c = initContract();

export const PublicDatasetSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  organizationId: z.string(),
  projectId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const DatasetsSchema = z.array(PublicDatasetSchema);

export type DatasetType = z.infer<typeof PublicDatasetSchema>;
export type DatasetsType = z.infer<typeof DatasetsSchema>;

/* Create Dataset */
export const CreateDatasetPayloadSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  projectId: z.string(),
});

const createDatasetContract = c.mutation({
  method: 'POST',
  path: '/datasets',
  body: CreateDatasetPayloadSchema,
  responses: {
    201: PublicDatasetSchema,
    400: z.object({
      message: z.string(),
      errorCode: z.enum(['validation', 'maxUsage', 'default']),
    }),
  },
});

/* Update Dataset */
export const UpdateDatasetPayloadSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  description: z.string().optional(),
});

const updateDatasetContract = c.mutation({
  method: 'PATCH',
  path: '/datasets/:datasetId',
  pathParams: z.object({
    datasetId: z.string(),
  }),
  body: UpdateDatasetPayloadSchema,
  responses: {
    200: PublicDatasetSchema,
    400: z.object({
      message: z.string(),
      errorCode: z.enum(['validation', 'default']),
    }),
    404: z.object({
      message: z.string(),
    }),
  },
});

/* Get Datasets */
const GetDatasetsResponseSchema = z.object({
  datasets: DatasetsSchema,
  hasNextPage: z.boolean(),
});

const getDatasetsContract = c.query({
  method: 'GET',
  query: GenericSearchSchema.extend({
    projectId: z.string().optional(),
  }),
  path: '/datasets',
  responses: {
    200: GetDatasetsResponseSchema,
  },
});

/* Get Single Dataset */
const getDatasetContract = c.query({
  method: 'GET',
  path: '/datasets/:datasetId',
  pathParams: z.object({
    datasetId: z.string(),
  }),
  responses: {
    200: PublicDatasetSchema,
    404: z.object({
      message: z.string(),
    }),
  },
});

/* Delete Dataset */
const deleteDatasetContract = c.mutation({
  method: 'DELETE',
  path: '/datasets/:datasetId',
  pathParams: z.object({
    datasetId: z.string(),
  }),
  body: null,
  responses: {
    204: null,
    404: z.object({
      message: z.string(),
    }),
  },
});

export const datasetContracts = c.router({
  createDataset: createDatasetContract,
  updateDataset: updateDatasetContract,
  getDatasets: getDatasetsContract,
  getDataset: getDatasetContract,
  deleteDataset: deleteDatasetContract,
});

export const datasetQueryKeys = {
  getDatasets: ['datasets'],
  getDatasetsWithSearch: (search: GenericSearch & { projectId?: string }) => [
    'datasets',
    search,
  ],
  getDataset: (datasetId: string) => ['datasets', datasetId],
};
