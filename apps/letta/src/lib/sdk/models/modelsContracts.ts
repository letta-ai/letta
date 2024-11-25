import { initContract } from '@ts-rest/core';
import {
  LLMConfigSchema,
  EmbeddingConfigSchema,
} from '@letta-web/letta-agents-api';
import { z } from 'zod';

const c = initContract();

const OptionsSchema = z.object({
  extended: z.boolean().optional(),
});

type OptionsType = z.infer<typeof OptionsSchema>;

export const ExtendedLLMSchema = LLMConfigSchema.extend({
  brand: z.string().optional(),
  isRecommended: z.boolean().optional(),
  tag: z.string().optional(),
  displayName: z.string().optional(),
});

const listLLMBackendsContract = c.query({
  method: 'GET',
  path: `/v1/models/`,
  query: OptionsSchema,
  responses: {
    200: z.array(ExtendedLLMSchema),
  },
});

export const ExtendedEmbeddingSchema = EmbeddingConfigSchema.extend({
  brand: z.string().optional(),
});

const listEmbeddingBackendsContract = c.query({
  method: 'GET',
  path: `/v1/models/embedding/`,
  query: OptionsSchema,
  responses: {
    200: z.array(ExtendedEmbeddingSchema),
  },
});

export const modelContracts = c.router({
  listLLMBackends: listLLMBackendsContract,
  listEmbeddingBackends: listEmbeddingBackendsContract,
});

export const modelQueryClientKeys = {
  listLLMBackends: ['listLLMBackends'],
  listLLMBackendsWithSearch: (options: OptionsType) => [
    ...modelQueryClientKeys.listLLMBackends,
    options,
  ],
  listEmbeddingBackends: ['listEmbeddingBackends'],
  listEmbeddingBackendsWithSearch: (options: OptionsType) => [
    ...modelQueryClientKeys.listEmbeddingBackends,
    options,
  ],
};
