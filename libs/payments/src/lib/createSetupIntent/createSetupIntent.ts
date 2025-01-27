import { getStripeClient } from '../getStripeClient/getStripeClient';
import { getPaymentCustomer } from '../getPaymentCustomer/getPaymentCustomer';

interface CreateSetupIntentOptions {
  organizationId: string;
}

export async function createSetupIntent({
  organizationId,
}: CreateSetupIntentOptions) {
  const customer = await getPaymentCustomer(organizationId);

  const stripeClient = getStripeClient();

  if (!stripeClient || !customer) {
    return null;
  }

  return stripeClient.setupIntents.create({
    customer: customer.id,
    payment_method_types: ['card'],
  });
}
