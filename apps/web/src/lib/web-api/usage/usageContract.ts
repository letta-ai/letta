import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

const GetUsageByModelItemSchema = z.object({
  modelKey: z.string(),
  modelName: z.string(),
  totalTokens: z.number(),
  totalCost: z.number(),
  brand: z.string(),
  totalRequests: z.number(),
});

export type GetUsageByModelItem = z.infer<typeof GetUsageByModelItemSchema>;

const GetUsageMyModelSummaryQuerySchema = z.object({
  startDate: z.number(),
  endDate: z.number(),
});

type GetUsageMyModelSummaryQuery = z.infer<
  typeof GetUsageMyModelSummaryQuerySchema
>;

const getUsageByModelSummaryContract = c.query({
  method: 'GET',
  path: '/usage/model-summary',
  query: GetUsageMyModelSummaryQuerySchema,
  responses: {
    200: z.array(GetUsageByModelItemSchema),
  },
});

export const usageContracts = {
  getUsageByModelSummary: getUsageByModelSummaryContract,
};

export const usageQueryKeys = {
  getUsageByModelSummary: (query: GetUsageMyModelSummaryQuery) => [
    'usage',
    'model-summary',
    query,
  ],
};
