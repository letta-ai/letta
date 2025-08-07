import type { ModelTiersType } from '@letta-cloud/types';
import {
  createRedisInstance,
  getRedisModelTransactionsKey,
} from '@letta-cloud/service-redis';
import {
  db,
  organizationCreditTransactions,
} from '@letta-cloud/service-database';
import { and, count, eq, gt } from 'drizzle-orm';
import { getCustomerSubscription } from '@letta-cloud/service-payments';
import * as Sentry from '@sentry/node';

export async function getRedisModelTransactions(
  type: ModelTiersType,
  organizationId: string,
) {
  const redis = createRedisInstance();

  const data = await redis.get(
    getRedisModelTransactionsKey(type, organizationId),
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

  let roundedExpireTime = 0;
  try {
    // should expire every day or when the subscription ends
    const expireTime = Math.min(
      new Date(subscription.billingPeriodEnd).getTime() - new Date().getTime(),
      24 * 60 * 60 * 1000, // at least one day
    );

    roundedExpireTime = Math.round(expireTime / 1000);

    // check if time is valid for expiration
    if (roundedExpireTime <= 0) {
      roundedExpireTime = 24 * 60 * 60 * 1000; // set to 1 second if the time is less than or equal to 0
    }

    await redis.setex(
      getRedisModelTransactionsKey(type, organizationId),
      roundedExpireTime,
      res[0].count,
    );
  } catch (error) {
    Sentry.captureException(error, {
      extra: {
        type,
        organizationId,
        subscription,
        roundedExpireTime,
        res,
      },
    });

    await redis.setex(
      getRedisModelTransactionsKey(type, organizationId),
      24 * 60 * 60 * 1000, // at least one day
      res[0].count,
    );
  }

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
    getRedisModelTransactionsKey(type, organizationId),
    amount,
  );
}
