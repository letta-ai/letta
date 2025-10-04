import type { ModelTiersType } from '@letta-cloud/types';

const MODEL_TRANSACTIONS_REDIS_KEY = 'modelTransactions_2';

export function getRedisModelTransactionsKey(
  type: ModelTiersType,
  organizationId: string,
) {
  return `${MODEL_TRANSACTIONS_REDIS_KEY}:${type}:${organizationId}`;
}

export function getRecurringCreditUsageKey(organizationId: string, subscription: { billingPeriodStart: string; billingPeriodEnd: string }) {
  return `recurringCreditUsage_1:${organizationId}:${subscription.billingPeriodStart}:${subscription.billingPeriodEnd}`;
}
