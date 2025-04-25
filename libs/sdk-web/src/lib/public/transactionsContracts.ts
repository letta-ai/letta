import { z } from 'zod';
import { initContract } from '@ts-rest/core';
import { ModelTiers } from '@letta-cloud/types';

const c = initContract();

const TransactionSchema = z.object({
  type: z.enum(['addition', 'subtraction']),
  amount: z.number(),
  note: z.string().optional(),
  source: z.string().optional(),
  stepId: z.string().optional(),
  modelTier: ModelTiers,
  createdAt: z.string(),
  id: z.string(),
});

export type PublicCreditTransactionType = z.infer<typeof TransactionSchema>;

const QuerySchema = z.object({
  limit: z
    .string()
    .or(z.number())
    .transform(Number)
    .refine((val) => val > 0 && val <= 100, {
      message: 'Limit must be between 1 and 25',
    }),
  offset: z
    .string()
    .or(z.number())
    .transform(Number)
    .refine((val) => val >= 0, {
      message: 'Offset must be greater than or equal to 0',
    }),
});

type ListTransactionsQuery = z.infer<typeof QuerySchema>;

const listTransactionsContract = c.query({
  path: '/transactions',
  method: 'GET',
  query: QuerySchema,
  responses: {
    200: z.object({
      transactions: z.array(TransactionSchema),
      hasNextPage: z.boolean(),
    }),
  },
});

export const transactionsContracts = c.router({
  listTransactions: listTransactionsContract,
});

export const transactionsQueryKeys = {
  listTransactions: ['transactions'] as const,
  listTransactionsWithSearch: (search: ListTransactionsQuery) =>
    ['transactions', search] as const,
};
