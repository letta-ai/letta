import { getStripeClient } from '../getStripeClient/getStripeClient';

export async function getPaymentCharge(chargeId: string) {
  const stripe = getStripeClient();

  if (!stripe) {
    return null;
  }

  return stripe.charges.retrieve(chargeId);
}
