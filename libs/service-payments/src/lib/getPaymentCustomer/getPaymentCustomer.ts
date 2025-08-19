import { getStripeClient } from '../getStripeClient/getStripeClient';
import {
  db,
  organizationBillingDetails,
  organizations,
  organizationUsers,
  users,
} from '@letta-cloud/service-database';
import { and, eq } from 'drizzle-orm';
import { createPaymentCustomer } from '../createPaymentCustomer/createPaymentCustomer';
import { getRedisData, setRedisData } from '@letta-cloud/service-redis';
import type Stripe from 'stripe';
import type { PaymentCustomer } from '@letta-cloud/types';

function getDefaultPaymentMethod(
  customer: Stripe.Customer,
): string | undefined {
  if (typeof customer.invoice_settings.default_payment_method === 'string') {
    return customer.invoice_settings.default_payment_method;
  }

  return undefined;
}

async function mainLogic(
  organizationId: string,
): Promise<PaymentCustomer | null> {
  const stripeClient = getStripeClient();

  if (!stripeClient) {
    return null;
  }

  const customerId = await db.query.organizationBillingDetails.findFirst({
    columns: {
      stripeCustomerId: true,
    },
    where: eq(organizationBillingDetails.organizationId, organizationId),
  });

  if (customerId?.stripeCustomerId) {
    try {
      const customer = await stripeClient.customers.retrieve(
        customerId.stripeCustomerId,
      );

      if (customer && !customer.deleted) {
        return {
          id: customer.id,
          defaultPaymentMethod: getDefaultPaymentMethod(customer),
        };
      }
    } catch (_error) {
      //
    }
  }

  const customerResponse = await stripeClient.customers.search({
    query: `metadata["organizationId"]:"${organizationId}"`,
    limit: 1,
  });

  if (customerResponse?.data[0]) {
    await db
      .update(organizationBillingDetails)
      .set({
        stripeCustomerId: customerResponse.data[0].id,
      })
      .where(eq(organizationBillingDetails.organizationId, organizationId));

    return {
      id: customerResponse.data[0].id,
      defaultPaymentMethod: getDefaultPaymentMethod(customerResponse.data[0]),
    };
  }

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });

  if (!organization) {
    throw new Error('Organization not found');
  }

  // get first admin user

  const admin = await db.query.organizationUsers.findFirst({
    where: and(
      eq(organizationUsers.organizationId, organizationId),
      eq(organizationUsers.role, 'admin'),
    ),
  });

  if (!admin) {
    throw new Error('This organization does not have an admin user');
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, admin.userId),
  });

  if (!user) {
    throw new Error('Admin user not found');
  }

  const customer = await createPaymentCustomer({
    organizationId,
    name: organization.name,
    email: user.email,
  });

  if (!customer) {
    throw new Error('Failed to create customer');
  }

  await db
    .update(organizationBillingDetails)
    .set({
      stripeCustomerId: customer.id,
    })
    .where(eq(organizationBillingDetails.organizationId, organizationId));

  return {
    id: customer.id,
    defaultPaymentMethod: getDefaultPaymentMethod(customer),
  };
}

export async function getPaymentCustomer(
  organizationId: string,
): Promise<PaymentCustomer | null> {
  const customerDetails = await getRedisData('paymentCustomer', {
    organizationId,
  });

  if (customerDetails?.id) {
    return customerDetails;
  }

  const response = await mainLogic(organizationId);

  if (!response) {
    return null;
  }

  await setRedisData(
    'paymentCustomer',
    {
      organizationId,
    },
    {
      data: response,
      // 24 hours
      expiresAt: Date.now() + 1000 * 60 * 60 * 24,
    },
  );

  return response;
}
