import { getStripeClient } from '../getStripeClient/getStripeClient';
import { db, organizationBillingDetails } from '@letta-cloud/service-database';
import { eq } from 'drizzle-orm';
import type { BillingTiersType } from '@letta-cloud/types';

export async function getCustomerBillingTier(
  organizationId: string,
): Promise<BillingTiersType> {
  const stripeClient = getStripeClient();

  if (!stripeClient) {
    return 'free';
  }

  const customer = await db.query.organizationBillingDetails.findFirst({
    columns: {
      stripeCustomerId: true,
      billingTier: true,
    },
    where: eq(organizationBillingDetails.organizationId, organizationId),
  });

  if (!customer) {
    return 'free';
  }

  if (!customer.stripeCustomerId) {
    return 'free';
  }

  if (customer?.billingTier === 'enterprise') {
    return 'enterprise';
  }

  const subscriptions = await stripeClient.subscriptions.list({
    customer: customer.stripeCustomerId,
  });

  const activeSubscriptions = subscriptions.data.filter((sub) => {
    return sub.status === 'active';
  });

  if (activeSubscriptions.length === 0) {
    return 'free';
  }

  return 'pro';
}
