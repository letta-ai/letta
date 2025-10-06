import { getStripeClient } from '../getStripeClient/getStripeClient';
import { getPaymentCustomer } from '../getPaymentCustomer/getPaymentCustomer';

interface GetReceiptUrlParams {
  paymentIntentId: string;
  organizationId: string;
}

export async function getReceiptUrl({
  paymentIntentId,
  organizationId,
}: GetReceiptUrlParams) {
  const stripe = getStripeClient();

  if (!stripe) {
    return null;
  }

  const customer = await getPaymentCustomer(organizationId);

  if (!customer) {
    return null;
  }

   try {
     const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

     // Verify the payment intent belongs to this organization's customer
     if (paymentIntent.customer !== customer.id) {
       return null;
     }

     if (!paymentIntent.latest_charge) {
       return null;
     }

     const chargeId =
       typeof paymentIntent.latest_charge === 'string'
         ? paymentIntent.latest_charge
         : paymentIntent.latest_charge.id;

     const charge = await stripe.charges.retrieve(chargeId);

     return charge.receipt_url;
   } catch (_e) {
      return null;
   }
}
