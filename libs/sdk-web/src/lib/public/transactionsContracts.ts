import { z } from 'zod';
import { initContract } from '@ts-rest/core';

const c = initContract();

const TransactionSchema = z.object({
  type: z.enum(['addition', 'subtraction']),
  amount: z.number(),
  note: z.string().optional(),
  source: z.string().optional(),
  stepId: z.string().optional(),
  createdAt: z.string(),
  id: z.string(),
});

export type PublicCreditTransactionType = z.infer<typeof TransactionSchema>;

const QuerySchema = z.object({
  limit: z.number().max(50).optional(),
  offset: z.number().optional(),
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
