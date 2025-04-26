import { getStripeClient } from '../getStripeClient/getStripeClient';
import { getPaymentCustomer } from '../getPaymentCustomer/getPaymentCustomer';

export async function cancelSubscription(organizationId: string) {
  const stripeClient = getStripeClient();
  if (!stripeClient) {
    throw new Error('Stripe client not initialized');
  }

  const customer = await getPaymentCustomer(organizationId);

  if (!customer) {
    throw new Error('Customer not found');
  }

  const subscriptions = await stripeClient.subscriptions.list({
    customer: customer.id,
  });

  /* Will set the subscription to cancel at the end of the billing period */
  await Promise.all(
    subscriptions.data.map(async (subscription) => {
      if (subscription.status === 'active') {
        await stripeClient.subscriptions.update(subscription.id, {
          cancel_at_period_end: true,
        });
      }
    }),
  );
}
