import { getStripeClient } from '../getStripeClient/getStripeClient';
import { db, organizationBillingDetails } from '@letta-cloud/service-database';
import { eq } from 'drizzle-orm';

interface GetPaymentCustomerPayload {
  organizationId: string;
  name: string;
  email: string;
}

export async function createPaymentCustomer(
  payload: GetPaymentCustomerPayload,
) {
  const { organizationId, name, email } = payload;

  const stripeClient = getStripeClient();

  const client = await stripeClient.customers.search({
    query: `metadata["organizationId"]:"${organizationId}"`,
    limit: 1,
  });

  if (client.data.length > 0) {
    await db
      .update(organizationBillingDetails)
      .set({
        stripeCustomerId: client.data[0].id,
      })
      .where(eq(organizationBillingDetails.organizationId, organizationId));

    return client.data[0];
  }

  return stripeClient.customers.create({
    name,
    email,
    metadata: {
      organizationId,
    },
  });
}
