import { getStripeClient } from '../getStripeClient/getStripeClient';
import { getPaymentCustomer } from '../getPaymentCustomer/getPaymentCustomer';
import { getCustomerSubscription } from '../getCustomerSubscription/getCustomerSubscription';
import {
  LEGACY_PRO_PLAN_PRICE_IDS,
  PRO_PLAN_PRICE_IDS,
  SCALE_PLAN_PRICE_IDS
} from '../constants';
import type { BillingTiersType } from '@letta-cloud/types';

interface UpgradeCustomerOptions {
  organizationId: string;
  tier: BillingTiersType;
  cardId: string;
}

export async function upgradeCustomer(options: UpgradeCustomerOptions) {
  const { tier, cardId, organizationId } = options;
  const stripeClient = getStripeClient();

  if (!stripeClient) {
    throw new Error('Stripe client not initialized');
  }

  const customer = await getPaymentCustomer(organizationId);

  if (!customer) {
    throw new Error('Customer not found');
  }

  if (!['pro-legacy', 'pro', 'scale'].includes(tier)) {
    throw new Error('Unsupported tier');
  }

  const sub = await getCustomerSubscription(organizationId);

  if (sub.tier === tier) {
    throw new Error('User already on that plan');
  }

  const plans = await stripeClient.plans.list();

  let priceId: string | undefined = '';

  if (tier === 'pro-legacy') {
    priceId = plans.data.find((price) =>
      LEGACY_PRO_PLAN_PRICE_IDS.includes(price.id),
    )?.id;
  } else if (tier === 'scale') {
    priceId = plans.data.find((price) => SCALE_PLAN_PRICE_IDS.includes(price.id))?.id;
  } else if (tier === 'pro') {
    priceId = plans.data.find((price) =>
      PRO_PLAN_PRICE_IDS.includes(price.id),
    )?.id;
  }

  if (!priceId) {
    throw new Error('No prices');
  }

  await stripeClient.subscriptions.create({
    customer: customer.id,
    default_payment_method: cardId,
    items: [
      {
        price: priceId,
      },
    ],
  });

  if (sub.id) {
    await stripeClient.subscriptions.cancel(sub.id);
  }
}
