import { getStripeClient } from '../getStripeClient/getStripeClient';
import { getPaymentCustomer } from '../getPaymentCustomer/getPaymentCustomer';

interface SetDefaultPaymentMethodPayload {
  paymentMethodId: string;
  organizationId: string;
}

export async function setDefaultPaymentMethod(
  payload: SetDefaultPaymentMethodPayload,
) {
  const { paymentMethodId, organizationId } = payload;

  const stripeClient = getStripeClient();

  if (!stripeClient) {
    return null;
  }

  const stripeCustomer = await getPaymentCustomer(organizationId);

  if (!stripeCustomer) {
    throw new Error('Stripe customer not found');
  }

  return stripeClient.customers.update(stripeCustomer.id, {
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  });
}
