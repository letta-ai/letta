import { getStripeClient } from '../getStripeClient/getStripeClient';
import { db, organizationBillingDetails } from '@letta-cloud/service-database';
import { eq } from 'drizzle-orm';
import type {
  BillingTiersType,
  PaymentCustomerSubscription,
} from '@letta-cloud/types';
import { startOfMonth, endOfMonth } from 'date-fns';
import type { Stripe } from 'stripe';
import { LEGACY_PRO_PLAN_PRODUCT_IDS, SCALE_PLAN_PRODUCT_IDS } from '../constants';
import { getRedisData, setRedisData } from '@letta-cloud/service-redis';

function getProductFromStripeSubscription(
  subscription: Stripe.Subscription,
): BillingTiersType {
  const product = subscription.items.data[0].price.product as string;

  if (!product) {
    return 'free';
  }

  if (SCALE_PLAN_PRODUCT_IDS.includes(product)) {
    return 'scale';
  }

  if (LEGACY_PRO_PLAN_PRODUCT_IDS.includes(product)) {
    return 'pro-legacy';
  }

  return 'free';
}

async function getCustomerSubscriptionMainLogic(
  organizationId: string,
): Promise<PaymentCustomerSubscription> {
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

  const activeSubscription = subscriptions.data.find((sub) => {
    return sub.status === 'active' || sub.status === 'trialing';
  });

  if (!activeSubscription) {
    return {
      billingPeriodStart,
      billingPeriodEnd,
      tier: 'free',
    };
  }

  const tier = getProductFromStripeSubscription(activeSubscription);

  try {
    return {
      id: activeSubscription.id,
      billingPeriodEnd: new Date(
        activeSubscription.current_period_end * 1000,
      ).toISOString(),
      billingPeriodStart: new Date(
        activeSubscription.current_period_start * 1000,
      ).toISOString(),
      cancelled: activeSubscription.cancel_at_period_end,
      tier,
    };
  } catch (error) {
    console.error('Error parsing subscription data:', error);
    return {
      id: activeSubscription.id,
      billingPeriodStart,
      billingPeriodEnd,
      cancelled: activeSubscription.cancel_at_period_end,
      tier,
    };
  }
}

export async function getCustomerSubscription(
  organizationId: string,
): Promise<PaymentCustomerSubscription> {
  const cachedSubscription = await getRedisData('customerSubscription', {
    organizationId,
  });

  if (cachedSubscription) {
    return cachedSubscription;
  }

  const subscription = await getCustomerSubscriptionMainLogic(organizationId);

  // expires every hour or when the billing period ends
  const expiresAt = Math.min(
    new Date(subscription.billingPeriodEnd).getTime(),
    60 * 60 * 1000 + Date.now(),
  );

  await setRedisData(
    'customerSubscription',
    {
      organizationId,
    },
    {
      data: subscription,
      expiresAt,
    },
  );

  return subscription;
}
