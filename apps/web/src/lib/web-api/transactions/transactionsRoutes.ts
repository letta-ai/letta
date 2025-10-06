import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '@letta-cloud/sdk-web';
import {
  db,
  organizationCreditTransactions,
} from '@letta-cloud/service-database';
import { getUserWithActiveOrganizationIdOrThrow } from '$web/server/auth';
import { and, desc, eq } from 'drizzle-orm';
import { ModelTiers } from '@letta-cloud/types';

type TransactionsRoutesRequest = ServerInferRequest<
  typeof contracts.transactions.listTransactions
>;
type TransactionsRoutesResponse = ServerInferResponses<
  typeof contracts.transactions.listTransactions
>;

async function listTransactions(
  req: TransactionsRoutesRequest,
): Promise<TransactionsRoutesResponse> {
  const { limit = 10, offset = 0, stepId } = req.query;
  const { activeOrganizationId } =
    await getUserWithActiveOrganizationIdOrThrow();

  const options = [
    eq(organizationCreditTransactions.organizationId, activeOrganizationId),
  ];

  if (stepId) {
    options.push(eq(organizationCreditTransactions.stepId, stepId));
  }

  const transactions = await db.query.organizationCreditTransactions.findMany({
    where: and(...options),
    limit: limit + 1,
    offset,
    orderBy: desc(organizationCreditTransactions.createdAt),
  });

  return {
    status: 200,
    body: {
      transactions: transactions.slice(0, limit).map((transaction) => {
        const tier = ModelTiers.safeParse(transaction.modelTier);

        return {
          type: transaction.transactionType,
          amount: parseInt(transaction.amount, 10),
          metadata: transaction.metadata || {},
          trueCost: parseInt(transaction.trueCost, 10),
          note: transaction.note || '',
          source: transaction.source || '',
          ...(transaction.stepId ? { stepId: transaction.stepId } : {}),
          createdAt: transaction.createdAt.toISOString(),
          modelTier: tier?.data || 'per-inference',
          id: transaction.id,
        };
      }),
      hasNextPage: transactions.length > limit,
    },
  };
}

export const transactionsRoutes = {
  listTransactions,
};
