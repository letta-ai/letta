import Stripe from 'stripe';

export function getStripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe secret key not found, please add it via just env');
  }

  return new Stripe(process.env.STRIPE_SECRET_KEY || '');
}
