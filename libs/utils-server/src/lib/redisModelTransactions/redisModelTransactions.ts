import type { ModelTiersType } from '@letta-cloud/types';
import { createRedisInstance } from '@letta-cloud/service-redis';
import {
  db,
  organizationCreditTransactions,
} from '@letta-cloud/service-database';
import { and, count, eq, gt } from 'drizzle-orm';
import { getCustomerSubscription } from '@letta-cloud/service-payments';

const MODEL_TRANSACTIONS_REDIS_KEY = 'modelTransactions_1';

export async function getRedisModelTransactions(
  type: ModelTiersType,
  organizationId: string,
) {
  const redis = createRedisInstance();

  const data = await redis.get(
    `${MODEL_TRANSACTIONS_REDIS_KEY}:${type}:${organizationId}`,
  );

  if (data) {
    return parseInt(data, 10);
  }

  const subscription = await getCustomerSubscription(organizationId);

  if (!subscription) {
    throw new Error(`Could not find organization with id ${organizationId}`);
  }

  const res = await db
    .select({ count: count() })
    .from(organizationCreditTransactions)
    .where(
      and(
        eq(organizationCreditTransactions.modelTier, type),
        eq(organizationCreditTransactions.organizationId, organizationId),
        gt(
          organizationCreditTransactions.createdAt,
          new Date(subscription.billingPeriodStart),
        ),
      ),
    );

  if (!res) {
    throw new Error(
      `Could not find organization credits for organization with id ${organizationId}`,
    );
  }

  const expireTime =
    new Date(subscription.billingPeriodEnd).getTime() - Date.now();

  await redis.setex(
    `${MODEL_TRANSACTIONS_REDIS_KEY}:${type}:${organizationId}`,
    Math.round(expireTime),
    res[0].count,
  );

  return res[0].count;
}

export async function incrementRedisModelTransactions(
  type: ModelTiersType,
  organizationId: string,
  amount: number,
) {
  const redis = createRedisInstance();

  await getRedisModelTransactions(type, organizationId);

  return redis.incrby(
    `${MODEL_TRANSACTIONS_REDIS_KEY}:${type}:${organizationId}`,
    amount,
  );
}
