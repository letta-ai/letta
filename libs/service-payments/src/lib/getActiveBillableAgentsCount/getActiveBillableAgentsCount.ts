import { activeAgents, db } from '@letta-cloud/service-database';
import { and, count, eq, gte } from 'drizzle-orm';
import { getCustomerSubscription } from '../getCustomerSubscription/getCustomerSubscription';

export async function getActiveBillableAgentsCount(organizationId: string) {
  const subscription = await getCustomerSubscription(organizationId);

  const [res] = await db
    .select({ count: count() })
    .from(activeAgents)
    .where(
      and(
        eq(activeAgents.organizationId, organizationId),
        gte(
          activeAgents.lastActiveAt,
          new Date(subscription.billingPeriodStart),
        ),
      ),
    );

  if (!res) {
    return 0;
  }

  return res.count || 0;
}
