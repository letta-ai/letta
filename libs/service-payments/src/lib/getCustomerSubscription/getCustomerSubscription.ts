import { getStripeClient } from '../getStripeClient/getStripeClient';
import { db, organizationBillingDetails } from '@letta-cloud/service-database';
import { eq } from 'drizzle-orm';
import type { BillingTiersType } from '@letta-cloud/types';

interface GetCustomerSubscriptionResponse {
  tier: BillingTiersType;
  billingPeriodEnd?: string;
  cancelled?: boolean;
}

export async function getCustomerSubscription(
  organizationId: string,
): Promise<GetCustomerSubscriptionResponse> {
  const stripeClient = getStripeClient();

  if (!stripeClient) {
    return {
      tier: 'free',
    };
  }

  const customer = await db.query.organizationBillingDetails.findFirst({
    columns: {
      stripeCustomerId: true,
      billingTier: true,
    },
    where: eq(organizationBillingDetails.organizationId, organizationId),
  });

  if (!customer) {
    return {
      tier: 'free',
    };
  }

  if (!customer.stripeCustomerId) {
    return {
      tier: 'free',
    };
  }

  if (customer?.billingTier === 'enterprise') {
    return {
      tier: 'enterprise',
    };
  }

  const subscriptions = await stripeClient.subscriptions.list({
    customer: customer.stripeCustomerId,
  });

  const activeSubscriptions = subscriptions.data.find((sub) => {
    return sub.status === 'active';
  });

  if (!activeSubscriptions) {
    return {
      tier: 'free',
    };
  }

  return {
    billingPeriodEnd: new Date(
      activeSubscriptions.current_period_end * 1000,
    ).toISOString(),
    cancelled: activeSubscriptions.cancel_at_period_end,
    tier: 'pro',
  };
}
