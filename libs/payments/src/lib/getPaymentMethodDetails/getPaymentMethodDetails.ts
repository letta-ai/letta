import { getStripeClient } from '../getStripeClient/getStripeClient';

export async function getPaymentMethodDetails(
  customerId: string,
  paymentMethodId: string,
) {
  const stripe = getStripeClient();

  if (!stripe) {
    return null;
  }

  return stripe.customers.retrievePaymentMethod(customerId, paymentMethodId);
}
