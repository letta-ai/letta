import { getStripeClient } from '../getStripeClient/getStripeClient';
import { getPaymentCustomer } from '../getPaymentCustomer/getPaymentCustomer';

interface ListCreditCardsPayload {
  organizationId: string;
}

export async function listCreditCards(payload: ListCreditCardsPayload) {
  const { organizationId } = payload;

  const customer = await getPaymentCustomer(organizationId);

  const stripeClient = getStripeClient();

  if (!stripeClient || !customer) {
    return [];
  }

  return stripeClient.paymentMethods
    .list({
      type: 'card',
      customer: customer.id,
      limit: 4, // we only support three cards per organization
    })
    .then((paymentMethods) =>
      paymentMethods.data.map((paymentMethod) => ({
        ...paymentMethod,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        card: paymentMethod.card!,
      })),
    );
}
