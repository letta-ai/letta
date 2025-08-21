import type { Stripe } from 'stripe';
import {
  createRedisInstance,
  deleteRedisData,
  getRedisModelTransactionsKey,
} from '@letta-cloud/service-redis';
import { db, organizationBillingDetails } from '@letta-cloud/service-database';
import { eq } from 'drizzle-orm';
import { downgradeActiveAgents } from './downgradeActiveAgents/downgradeActiveAgents';
import { getCustomerSubscription } from '../getCustomerSubscription/getCustomerSubscription';
import { trackServerSideEvent } from '@letta-cloud/service-analytics/server';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';

export async function clearCustomerSubscriptionCache(
  organizationId: string,
): Promise<void> {
  const redis = createRedisInstance();

  await Promise.all([
    deleteRedisData('customerSubscription', {
      organizationId,
    }),
    redis.del(getRedisModelTransactionsKey('free', organizationId)),
    redis.del(getRedisModelTransactionsKey('premium', organizationId)),
  ]);
}

async function getOrganizationIdFromPaymentCustomerId(
  paymentCustomerId: string,
) {
  const billingDetails = await db.query.organizationBillingDetails.findFirst({
    where: eq(organizationBillingDetails.stripeCustomerId, paymentCustomerId),
    columns: {
      organizationId: true,
    },
  });

  if (!billingDetails) {
    return null;
  }

  return billingDetails.organizationId;
}

async function trackSubscriptionChange(organizationId: string) {
  const subscriptionTier = await getCustomerSubscription(organizationId);

  void trackServerSideEvent(AnalyticsEvent.SUBSCRIPTION_CHANGED, {
    tier: subscriptionTier.tier,
    organization_id: organizationId,
  });
}

export async function handleStripeCustomerChange(customerId: string) {
  const organizationId =
    await getOrganizationIdFromPaymentCustomerId(customerId);

  if (!organizationId) {
    return;
  }

  await clearCustomerSubscriptionCache(organizationId);

  await downgradeActiveAgents(organizationId);
}

export async function handleStripeEvents(event: Stripe.Event) {
  switch (event.type) {
    case 'customer.subscription.paused':
    case 'customer.subscription.resumed':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
    case 'customer.subscription.created': {
      const customerId = event.data.object.customer as string;

      await handleStripeCustomerChange(customerId);
      await trackSubscriptionChange(customerId);
    }
  }
}
