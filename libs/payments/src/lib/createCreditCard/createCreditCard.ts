import { getPaymentCustomer } from '../getPaymentCustomer/getPaymentCustomer';
import { getStripeClient } from '../getStripeClient/getStripeClient';

interface CreateCreditCardPayload {
  organizationId: string;
  source: string;
}

export async function createCreditCard(payload: CreateCreditCardPayload) {
  const { organizationId, source } = payload;

  const customer = await getPaymentCustomer(organizationId);

  const stripeClient = getStripeClient();

  if (!stripeClient || !customer) {
    return null;
  }

  return stripeClient.customers.createSource(customer.id, {
    source,
  });
}
