import { getStripeClient } from '../getStripeClient/getStripeClient';
import { getPaymentCustomer } from '../getPaymentCustomer/getPaymentCustomer';
import { getCustomerSubscription } from '../getCustomerSubscription/getCustomerSubscription';
import { LEGACY_PRO_PLAN_PRICE_IDS, PRO_PLAN_PRICE_IDS } from '../constants';
import { getSingleFlag } from '@letta-cloud/service-feature-flags';

export async function createProPaymentLink(organizationId: string) {
  const stripe = getStripeClient();

  if (!stripe) {
    return null;
  }

  const isBillingV3Enabled = await getSingleFlag('BILLING_V3', organizationId);

  const customer = await getPaymentCustomer(organizationId);

  if (!customer) {
    return null;
  }

  const subscription = await getCustomerSubscription(organizationId);

  if (subscription.tier !== 'free') {
    return null;
  }

  const response = await stripe.prices.list({
    active: true,
  });

  const correctPriceId = response.data.find((price) => {
    if (isBillingV3Enabled) {
      return PRO_PLAN_PRICE_IDS.includes(price.id);
    }

    return LEGACY_PRO_PLAN_PRICE_IDS.includes(price.id);
  });

  if (!correctPriceId) {
    return null;
  }

  const paymentLink = await stripe.checkout.sessions.create({
    line_items: [
      {
        price: correctPriceId.id,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    allow_promotion_codes: true,
    saved_payment_method_options: {
      payment_method_save: 'enabled',
    },
    customer: customer.id,
    success_url: `${process.env.NEXT_PUBLIC_CURRENT_HOST}/settings/organization/usage`,
    automatic_tax: {
      enabled: true,
    },
    customer_update: {
      address: 'auto',
    },
  });

  return paymentLink.url;
}
