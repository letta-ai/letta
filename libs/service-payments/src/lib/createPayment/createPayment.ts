import { getStripeClient } from '../getStripeClient/getStripeClient';
import { getPaymentCustomer } from '../getPaymentCustomer/getPaymentCustomer';
import { getDefaultContactEmails } from '@letta-cloud/service-email';

interface CreatePaymentPayload {
  organizationId: string;
  amountInCents: number;
  cardId: string;
}

export async function createPayment(payload: CreatePaymentPayload) {
  const stripe = getStripeClient();
  const { organizationId, amountInCents, cardId } = payload;
  const customer = await getPaymentCustomer(organizationId);

  if (!customer) {
    throw new Error('Failed to get customer');
  }

  return stripe.paymentIntents.create({
    amount: amountInCents,
    currency: 'usd',
    confirm: true,
    customer: customer.id,
    payment_method: cardId,
    receipt_email: (await getDefaultContactEmails({ organizationId }))[0],
    automatic_payment_methods: {
      enabled: true,
      allow_redirects: 'never',
    },
  });
}
