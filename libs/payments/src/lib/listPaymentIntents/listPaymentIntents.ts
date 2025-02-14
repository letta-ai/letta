import type Stripe from 'stripe';
import { getStripeClient } from '../getStripeClient/getStripeClient';
import { getPaymentCustomer } from '../getPaymentCustomer/getPaymentCustomer';

interface ListPaymentIntents {
  organizationId: string;
  limit?: number;
  cursor?: string;
}

interface ListPaymentIntentsResponse {
  history: Stripe.PaymentIntent[];
  nextCursor: string | null | undefined;
}

export async function listPaymentIntents(
  payload: ListPaymentIntents,
): Promise<ListPaymentIntentsResponse> {
  const { organizationId, limit, cursor } = payload;

  const customer = await getPaymentCustomer(organizationId);

  const stripeClient = getStripeClient();

  if (!stripeClient || !customer) {
    return {
      history: [],
      nextCursor: undefined,
    };
  }

  const paymentIntents = await stripeClient.paymentIntents.search({
    query: `status:"succeeded" AND customer:"${customer.id}"`,
    limit,
    ...(cursor ? { page: cursor } : {}),
  });

  return {
    history: paymentIntents.data,
    nextCursor: paymentIntents.next_page,
  };
}
