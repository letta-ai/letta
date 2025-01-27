import Stripe from 'stripe';
import { environment } from '@letta-cloud/environmental-variables';

export function getStripeClient() {
  if (!environment.STRIPE_SECRET_KEY) {
    throw new Error('Stripe secret key not found, please add it via just env');
  }

  return new Stripe(environment.STRIPE_SECRET_KEY || '');
}
