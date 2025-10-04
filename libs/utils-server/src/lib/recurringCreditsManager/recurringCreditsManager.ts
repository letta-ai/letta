import { db, organizationCreditTransactions } from '@letta-cloud/service-database';
import { createRedisInstance, getRecurringCreditUsageKey } from '@letta-cloud/service-redis';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import type { PaymentCustomerSubscription } from '@letta-cloud/types';
import { getRecurrentSubscriptionLimits } from '@letta-cloud/utils-shared';

async function buildRecurrantCreditUsage(organizationId: string, subscription: PaymentCustomerSubscription) {
  const redis = createRedisInstance();

  const [result] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${organizationCreditTransactions.trueCost}), 0)`,
    })
    .from(organizationCreditTransactions)
    .where(
      and(
        eq(organizationCreditTransactions.organizationId, organizationId),
        gte(organizationCreditTransactions.createdAt, new Date(subscription.billingPeriodStart)),
        lte(organizationCreditTransactions.createdAt, new Date(subscription.billingPeriodEnd))
      )
    );

  const totalAmount = Number(result?.total || 0);

  const key = getRecurringCreditUsageKey(organizationId, subscription);

  const subscriptionLimit = getRecurrentSubscriptionLimits(subscription);

  await redis.setex(
    key,
    // should expire every day
    24 * 60 * 60,
    Math.min(totalAmount, subscriptionLimit).toString()
  )

  return totalAmount;
}

async function createRedisEntryIfNotExists(organizationId: string, subscription: PaymentCustomerSubscription) {
  // check if exists, if not buildRecurrantCreditUsage

  const redis = createRedisInstance();

  const key = getRecurringCreditUsageKey(organizationId, subscription);
  const data = await redis.get(key);
  if (!data) {
    await buildRecurrantCreditUsage(organizationId, subscription);
  }

}

export async function incrementRecurrentCreditUsage(organizationId: string, subscription: PaymentCustomerSubscription, amount: number) {
  const redis = createRedisInstance();

  await createRedisEntryIfNotExists(organizationId, subscription);

  const key = getRecurringCreditUsageKey(organizationId, subscription);

  return redis.incrby(key, amount);
}


export async function decrementRecurrentCreditUsage(organizationId: string, subscription: PaymentCustomerSubscription, amount: number) {
  const redis = createRedisInstance();

  await createRedisEntryIfNotExists(organizationId, subscription);

  const key = getRecurringCreditUsageKey(organizationId, subscription);

  return redis.decrby(key, amount);
}

export async function getRemainingRecurrentCredits(organizationId: string, subscription: PaymentCustomerSubscription) {
  const redis = createRedisInstance();

  await createRedisEntryIfNotExists(organizationId, subscription);


  const key = getRecurringCreditUsageKey(organizationId, subscription);
  const data = await redis.get(key);

  const usedCredits = data ? Number(data) : 0;

  const limit = getRecurrentSubscriptionLimits(subscription);

  return Math.max(0, limit - usedCredits);
}
