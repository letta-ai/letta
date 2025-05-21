import Stripe from 'stripe';
import type { Request, Response } from 'express';
import express from 'express';
import { environment } from '@letta-cloud/config-environment-variables';
import { handleStripeEvents } from '@letta-cloud/service-payments';

const stripeWebhook = express();

stripeWebhook.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    if (!environment.STRIPE_WEBHOOK_SECRET || !environment.STRIPE_SECRET_KEY) {
      console.error('Stripe webhook secret or secret key is not set');
      res.status(500).send('Internal Server Error');
      return;
    }

    const stripe = new Stripe(environment.STRIPE_SECRET_KEY);
    const webhookSecret: string = environment.STRIPE_WEBHOOK_SECRET;

    const sig = req.headers['stripe-signature'] as string;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      res.status(400).send(`Webhook Error: ${JSON.stringify(err, null, 2)}`);
      return;
    }

    await handleStripeEvents(event);

    res.json({ received: true });
  },
);

export { stripeWebhook };
