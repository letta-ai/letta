import { getStripeClient } from '../getStripeClient/getStripeClient';
import { getPaymentCustomer } from '../getPaymentCustomer/getPaymentCustomer';
import { getCustomerSubscription } from '../getCustomerSubscription/getCustomerSubscription';

export async function upgradeUserToProPlan(organizationId: string) {
  const stripeClient = getStripeClient();

  if (!stripeClient) {
    throw new Error('Stripe client not initialized');
  }

  const customer = await getPaymentCustomer(organizationId);

  if (!customer) {
    throw new Error('Customer not found');
  }

  const tier = await getCustomerSubscription(organizationId);

  if (tier.tier === 'pro') {
    throw new Error('User already on pro plan');
  }

  const priceId = await stripeClient.plans.list();

  const proPlan = priceId.data.find((plan) => {
    return (
      // sandbox pro plan = https://dashboard.stripe.com/test/prices/price_1RH71QIITVhFnB4W94dbGkOr;
      plan.id === 'price_1RH71QIITVhFnB4W94dbGkOr' ||
      // live pro plan = https://dashboard.stripe.com/prices/price_1RH6z1IITVhFnB4Wya5Ln5fy
      plan.id === 'price_1RH6z1IITVhFnB4Wya5Ln5fy'
    );
  });

  if (!proPlan) {
    throw new Error('Pro plan not found');
  }

  await stripeClient.subscriptions.create({
    customer: customer.id,
    items: [
      {
        price: proPlan.id,
      },
    ],
  });
}
