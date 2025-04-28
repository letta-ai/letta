import { getStripeClient } from '../getStripeClient/getStripeClient';
import { db, organizationBillingDetails } from '@letta-cloud/service-database';
import { eq } from 'drizzle-orm';
import type { BillingTiersType } from '@letta-cloud/types';
import { startOfMonth, endOfMonth } from 'date-fns';

interface GetCustomerSubscriptionResponse {
  tier: BillingTiersType;
  billingPeriodEnd: string;
  billingPeriodStart: string;
  cancelled?: boolean;
}

export async function getCustomerSubscription(
  organizationId: string,
): Promise<GetCustomerSubscriptionResponse> {
  const stripeClient = getStripeClient();

  // start of the month
  const billingPeriodStart = startOfMonth(new Date()).toISOString();
  const billingPeriodEnd = endOfMonth(new Date()).toISOString();

  if (!stripeClient) {
    return {
      billingPeriodStart,
      billingPeriodEnd,
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
      billingPeriodStart,
      billingPeriodEnd,
      tier: 'free',
    };
  }

  if (!customer.stripeCustomerId) {
    return {
      billingPeriodStart,
      billingPeriodEnd,
      tier: 'free',
    };
  }

  if (customer?.billingTier === 'enterprise') {
    return {
      billingPeriodStart,
      billingPeriodEnd,
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
      billingPeriodStart,
      billingPeriodEnd,
      tier: 'free',
    };
  }

  return {
    billingPeriodEnd: new Date(
      activeSubscriptions.current_period_end * 1000,
    ).toISOString(),
    billingPeriodStart: new Date(
      activeSubscriptions.current_period_start * 1000,
    ).toISOString(),
    cancelled: activeSubscriptions.cancel_at_period_end,
    tier: 'pro',
  };
}
