import { getStripeClient } from '../getStripeClient/getStripeClient';
import { getPaymentCustomer } from '../getPaymentCustomer/getPaymentCustomer';
import * as process from 'node:process';

export async function generateManagePlanLink(organizationId: string) {
  const stripe = getStripeClient();

  if (!stripe) {
    return null;
  }

  const customer = await getPaymentCustomer(organizationId);

  if (!customer) {
    return null;
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customer.id,
    return_url: `${process.env.NEXT_PUBLIC_CURRENT_HOST}/settings/organization/usage`,
  });

  return session.url;
}
