import { createRedisInstance } from '@letta-cloud/service-redis';
import {
  db,
  organizationCreditTransactions,
} from '@letta-cloud/service-database';
import { and, count, eq, gt, sql } from 'drizzle-orm';

const MODEL_INFERENCE_USAGE_LIMIT = 'modelInferenceUsageLimit_1';
type ModelTier = 'free' | 'premium';

function getKey(organizationId: string, tier: ModelTier) {
  return `${MODEL_INFERENCE_USAGE_LIMIT}:${organizationId}:${tier}`;
}

/*
 * What's going on here:
 *
 * We're doing rate limiting based on the number of requests made to the model.
 *
 * We can validate with the database by checking transactions made in the last month to that tier, otherwise
 * we should cache the result in Redis for 30 days.
 */

export async function getModelUsageLimit(
  organizationId: string,
  tier: ModelTier,
) {
  const redis = createRedisInstance();

  const data = await redis.get(getKey(organizationId, tier));

  if (data) {
    return parseInt(data, 10);
  }

  const [out] = await db
    .select({ count: count() })
    .from(organizationCreditTransactions)
    .where(
      and(
        eq(organizationCreditTransactions.organizationId, organizationId),
        gt(
          organizationCreditTransactions.createdAt,
          sql`date_trunc('month', now())`,
        ),
      ),
    );

  void redis.setex(getKey(organizationId, tier), 30 * 24 * 60 * 60, out.count);

  return out.count;
}

export async function incrementModelUsageLimit(
  organizationId: string,
  tier: ModelTier,
) {
  const redis = createRedisInstance();

  await getModelUsageLimit(organizationId, tier);

  await redis.incr(getKey(organizationId, tier));
}
