import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import {
  EmbeddingConfigSchema,
  LLMConfigSchema,
} from '@letta-web/letta-agents-api';
import { GenericSearchSchema } from '../shared';

const c = initContract();

export const InferenceModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  brand: z.string(),
  config: LLMConfigSchema.optional()?.nullable(),
  isRecommended: z.boolean(),
  tag: z.string(),
  disabledAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type AdminInferenceModelType = z.infer<typeof InferenceModelSchema>;

const GetModelSearchSchema = GenericSearchSchema.extend({
  brand: z.string().optional(),
  disabled: z.boolean().optional(),
  modelName: z.string().optional(),
  modelEndpoint: z.string().optional(),
  fromAgents: z.boolean().optional(),
});

type GetModelSearch = z.infer<typeof GetModelSearchSchema>;

const GetInferenceModelResponseSchema = z.object({
  inferenceModels: z.array(InferenceModelSchema),
  hasNextPage: z.boolean(),
});

const getAdminInferenceModelsContract = c.query({
  method: 'GET',
  path: '/admin/models/inference',
  query: GetModelSearchSchema,
  responses: {
    200: GetInferenceModelResponseSchema,
  },
});

/* Get InferenceModel by ID */
const getAdminInferenceModelByIdContract = c.query({
  method: 'GET',
  path: '/admin/models/inference/:id',
  responses: {
    200: InferenceModelSchema,
  },
  pathParams: z.object({
    id: z.string(),
  }),
});

/* Import Inference Model */
const ImportInferenceModelRequestBodySchema = z.object({
  modelName: z.string(),
  modelEndpoint: z.string(),
});

const createAdminInferenceModelContract = c.mutation({
  method: 'POST',
  path: '/admin/models/inference',
  body: ImportInferenceModelRequestBodySchema,
  responses: {
    201: InferenceModelSchema,
  },
});

/* Update Inference Model */
const UpdateInferenceModelRequestBodySchema = z.object({
  brand: z.string().optional(),
  disabled: z.boolean().optional(),
  name: z.string().optional(),
  tag: z.string().optional(),
  isRecommended: z.boolean().optional(),
});

const updateAdminInferenceModelContract = c.mutation({
  method: 'PATCH',
  path: '/admin/models/inference/:id',
  body: UpdateInferenceModelRequestBodySchema,
  responses: {
    200: InferenceModelSchema,
  },
  pathParams: z.object({
    id: z.string(),
  }),
});

/* Delete Inference Model */
const deleteAdminInferenceModelContract = c.mutation({
  method: 'DELETE',
  path: '/admin/models/inference/:id',
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
  },
  body: z.undefined(),
  pathParams: z.object({
    id: z.string(),
  }),
});

/* Get Embedding Models */
export const EmbeddingModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  brand: z.string(),
  config: EmbeddingConfigSchema.optional()?.nullable(),
  disabledAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type AdminEmbeddingModelType = z.infer<typeof EmbeddingModelSchema>;

const EmbeddingModelResponseSchema = z.object({
  embeddingModels: z.array(EmbeddingModelSchema),
  hasNextPage: z.boolean(),
});

const getAdminEmbeddingModelsContract = c.query({
  method: 'GET',
  path: '/admin/models/embedding',
  query: GetModelSearchSchema,
  responses: {
    200: EmbeddingModelResponseSchema,
  },
});

/* get Embedding Model by ID */
const getAdminEmbeddingModelContract = c.query({
  method: 'GET',
  path: '/admin/models/embedding/:id',
  responses: {
    200: EmbeddingModelSchema,
  },
  pathParams: z.object({
    id: z.string(),
  }),
});

/* Import Embedding Model */
const ImportEmbeddingModelRequestBodySchema = z.object({
  modelName: z.string(),
  modelEndpoint: z.string(),
});

const createAdminEmbeddingModelContract = c.mutation({
  method: 'POST',
  path: '/admin/models/embedding',
  body: ImportEmbeddingModelRequestBodySchema,
  responses: {
    201: EmbeddingModelSchema,
  },
});

/* Update Embedding Model */
const UpdateEmbeddingModelRequestBodySchema = z.object({
  brand: z.string().optional(),
  disabled: z.boolean().optional(),
  name: z.string().optional(),
});

const updateAdminEmbeddingModelContract = c.mutation({
  method: 'PATCH',
  path: '/admin/models/embedding/:id',
  body: UpdateEmbeddingModelRequestBodySchema,
  responses: {
    200: EmbeddingModelSchema,
  },
  pathParams: z.object({
    id: z.string(),
  }),
});

/* Delete Embedding Model */
const deleteAdminEmbeddingModelContract = c.mutation({
  method: 'DELETE',
  path: '/admin/models/embedding/:id',
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
  },
  body: z.undefined(),
  pathParams: z.object({
    id: z.string(),
  }),
});

export const adminModelsContracts = {
  getAdminEmbeddingModels: getAdminEmbeddingModelsContract,
  getAdminEmbeddingModel: getAdminEmbeddingModelContract,
  createAdminEmbeddingModel: createAdminEmbeddingModelContract,
  updateAdminEmbeddingModel: updateAdminEmbeddingModelContract,
  deleteAdminEmbeddingModel: deleteAdminEmbeddingModelContract,
  getAdminInferenceModels: getAdminInferenceModelsContract,
  getAdminInferenceModel: getAdminInferenceModelByIdContract,
  createAdminInferenceModel: createAdminInferenceModelContract,
  updateAdminInferenceModel: updateAdminInferenceModelContract,
  deleteAdminInferenceModel: deleteAdminInferenceModelContract,
};

export const adminModelsQueryClientKeys = {
  getAdminEmbeddingModels: ['getAdminEmbeddingModels'],
  getAdminEmbeddingModelsWithSearch: (search: GetModelSearch) => [
    ...adminModelsQueryClientKeys.getAdminEmbeddingModels,
    search,
  ],
  getAdminInferenceModelById: (id: string) => [
    'getAdminInferenceModelById',
    id,
  ],
  getAdminInferenceModels: ['getAdminInferenceModels'],
  getAdminInferenceModelsWithSearch: (search: GetModelSearch) => [
    ...adminModelsQueryClientKeys.getAdminInferenceModels,
    search,
  ],
  getAdminEmbeddingModelById: (id: string) => [
    'getAdminEmbeddingModelById',
    id,
  ],
};
