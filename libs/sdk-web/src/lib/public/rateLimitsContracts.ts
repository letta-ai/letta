import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { GenericSearchSchema } from '../shared';
import type { GenericSearch } from '../shared';
const c = initContract();

const RateLimitSchema = z.object({
  model: z.string(),
  tokensPerMinute: z.number(),
  requestsPerMinute: z.number(),
});

export type RateLimit = z.infer<typeof RateLimitSchema>;

const RateLimitResponseSchema = z.object({
  rateLimits: z.array(RateLimitSchema),
  hasNextPage: z.boolean(),
});

const getInferenceRateLimitsContract = c.query({
  path: '/rate-limits/inference',
  method: 'GET',
  query: GenericSearchSchema,
  responses: {
    200: RateLimitResponseSchema,
  },
});

const getEmbeddingRateLimitsContract = c.query({
  path: '/rate-limits/embedding',
  method: 'GET',
  query: GenericSearchSchema,
  responses: {
    200: RateLimitResponseSchema,
  },
});

export const rateLimitsContracts = c.router({
  getInferenceRateLimits: getInferenceRateLimitsContract,
  getEmbeddingRateLimits: getEmbeddingRateLimitsContract,
});

export const rateLimitQueryClientKeys = {
  getInferenceRateLimits: ['rateLimits', 'inference'],
  getInferenceRateLimitsWithSearch: (search: GenericSearch) => [
    ...rateLimitQueryClientKeys.getInferenceRateLimits,
    search,
  ],
  getEmbeddingRateLimits: ['rateLimits', 'embedding'],
  getEmbeddingRateLimitsWithSearch: (search: GenericSearch) => [
    ...rateLimitQueryClientKeys.getEmbeddingRateLimits,
    search,
  ],
};
