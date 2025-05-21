import type { Stripe } from 'stripe';
import { deleteRedisData } from '@letta-cloud/service-redis';
import { db, organizationBillingDetails } from '@letta-cloud/service-database';
import { eq } from 'drizzle-orm';

function clearCustomerSubscriptionCache(organizationId: string): Promise<void> {
  return deleteRedisData('customerSubscription', {
    organizationId,
  });
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

export async function handleStripeEvents(event: Stripe.Event) {
  switch (event.type) {
    case 'customer.subscription.paused':
    case 'customer.subscription.resumed':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
    case 'customer.subscription.created': {
      const customerId = event.data.object.customer as string;

      const organizationId =
        await getOrganizationIdFromPaymentCustomerId(customerId);

      if (!organizationId) {
        return;
      }

      await clearCustomerSubscriptionCache(organizationId);
    }
  }
}
