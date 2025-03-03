import { getStripeClient } from '../getStripeClient/getStripeClient';
import { getPaymentCustomer } from '../getPaymentCustomer/getPaymentCustomer';

interface CreatePaymentPayload {
  organizationId: string;
  amountInCents: number;
}

export async function createPayment(payload: CreatePaymentPayload) {
  const stripe = getStripeClient();
  const { organizationId, amountInCents } = payload;
  const customer = await getPaymentCustomer(organizationId);

  if (!customer) {
    throw new Error('Failed to get customer');
  }

  return stripe.paymentIntents.create({
    amount: amountInCents,
    currency: 'usd',
    confirm: true,
    customer: customer.id,
    payment_method:
      typeof customer.invoice_settings.default_payment_method === 'string'
        ? customer.invoice_settings.default_payment_method
        : undefined,
    receipt_email: customer.email || undefined,
    automatic_payment_methods: {
      enabled: true,
      allow_redirects: 'never',
    },
  });
}
