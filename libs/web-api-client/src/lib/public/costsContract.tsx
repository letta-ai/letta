import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { GenericSearchSchema } from '../shared';
import type { GenericSearch } from '../shared';

const c = initContract();

const CostItem = z.object({
  modelId: z.string(),
  modelName: z.string(),
  costMap: z.record(z.number()),
});

export type CostItemType = z.infer<typeof CostItem>;

const CostsResponseSchema = z.object({
  stepCosts: CostItem.array(),
  hasNextPage: z.boolean(),
});

const getStepCostsContract = c.query({
  method: 'GET',
  path: '/costs',
  query: GenericSearchSchema,
  responses: {
    200: CostsResponseSchema,
  },
});

export const costsContract = c.router({
  getStepCosts: getStepCostsContract,
});

export const costsQueryKeys = {
  getStepCosts: ['getStepCosts'],
  getStepCostsWithSearch: (search: GenericSearch) => ['getStepCosts', search],
};
