import { initContract } from '@ts-rest/core';
import {
  LLMConfigSchema,
  EmbeddingConfigSchema
} from '@letta-web/letta-agents-api';
import { z } from 'zod';

const c = initContract();


const listLLMBackendsContract = c.query({
  method: 'GET',
  path: `/v1/models/`,
  responses: {
    200: z.array(LLMConfigSchema),
  },
});

const listEmbeddingBackendsContract = c.query({
  method: 'GET',
  path: `/v1/models/embedding/`,
  responses: {
    200: z.array(EmbeddingConfigSchema),
  },
});

export const modelContracts = c.router({
  listLLMBackends: listLLMBackendsContract,
  listEmbeddingBackends: listEmbeddingBackendsContract,
});
