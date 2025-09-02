import type { ModelTiersType } from '@letta-cloud/types';

const MODEL_TRANSACTIONS_REDIS_KEY = 'modelTransactions_2';

export function getRedisModelTransactionsKey(
  type: ModelTiersType,
  organizationId: string,
) {
  return `${MODEL_TRANSACTIONS_REDIS_KEY}:${type}:${organizationId}`;
}
