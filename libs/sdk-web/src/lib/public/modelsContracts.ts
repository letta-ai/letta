import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { EmbeddingConfigSchema, LLMConfigSchema } from '@letta-cloud/sdk-core';
import { ModelTiers } from '@letta-cloud/types';

const c = initContract();

export const LLMType = z.enum(['letta', 'byok']);

export const ExtendedLLMSchema = LLMConfigSchema.extend({
  brand: z.string(),
  displayName: z.string(),
  id: z.string(),
  type: LLMType,
  tier: ModelTiers.optional(),
});

const ListInferenceModelsContract = c.query({
  method: 'GET',
  path: '/models/llm/',
  responses: {
    200: z.array(ExtendedLLMSchema),
  },
});

export const ExtendedEmbeddingSchema = EmbeddingConfigSchema.extend({
  brand: z.string().optional(),
});

const ListEmbeddingModelsContract = c.query({
  method: 'GET',
  path: '/models/embedding/',
  responses: {
    200: z.array(ExtendedEmbeddingSchema),
  },
});

export const modelContracts = c.router({
  listInferenceModels: ListInferenceModelsContract,
  listEmbeddingModels: ListEmbeddingModelsContract,
});

export const modelQueryClientKeys = {
  listInferenceModels: ['listInferenceModels'],
  listEmbeddingModels: ['listEmbeddingModels'],
};
