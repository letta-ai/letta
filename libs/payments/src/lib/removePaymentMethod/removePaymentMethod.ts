import { getStripeClient } from '../getStripeClient/getStripeClient';

interface RemovePaymentMethodPayload {
  paymentMethodId: string;
}

export async function removePaymentMethod(payload: RemovePaymentMethodPayload) {
  const { paymentMethodId } = payload;

  const stripeClient = getStripeClient();

  if (!stripeClient) {
    return null;
  }

  return stripeClient.paymentMethods.detach(paymentMethodId);
}
