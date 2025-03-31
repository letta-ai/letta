import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { GenericSearchSchema } from '../shared';
import type { GenericSearch } from '../shared';

const c = initContract();

const CostItem = z.object({
  modelId: z.string(),
  modelName: z.string(),
  brand: z.string(),
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
  responses: {
    200: CostsResponseSchema,
  },
});

const getStepCostByModelIdContract = c.query({
  method: 'GET',
  path: '/costs/:modelId',
  responses: {
    200: CostItem,
  },
  pathParams: z.object({
    modelId: z.string(),
  }),
});

export const costsContract = c.router({
  getStepCosts: getStepCostsContract,
  getStepCostByModelId: getStepCostByModelIdContract,
});

export const costsQueryKeys = {
  getStepCosts: ['getStepCosts'],
  getStepCostsWithSearch: (search: GenericSearch) => ['getStepCosts', search],
  getStepCostByModelId: (modelId: string) => ['getStepCostByModelId', modelId],
};
