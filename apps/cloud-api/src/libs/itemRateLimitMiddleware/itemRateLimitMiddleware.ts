import type { NextFunction, Request, Response } from 'express';
import { getCustomerSubscription } from '@letta-cloud/service-payments';
import { getUsageLimits } from '@letta-cloud/utils-shared';
import { shouldItemRateLimit } from '@letta-cloud/utils-server';
import * as Sentry from '@sentry/node';

export async function itemRateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (req.method !== 'POST') {
      next();
      return;
    }

    if (!req.actor?.cloudOrganizationId) {
      throw new Error(
        'This middlware must be used after verifyIdentityMiddleware',
      );
    }

    const subscription = await getCustomerSubscription(
      req.actor.cloudOrganizationId,
    );

    const limits = await getUsageLimits(subscription.tier);

    const limitResponse = await shouldItemRateLimit({
      path: req.path,
      actor: req.actor,
      limits,
    });

    if (limitResponse) {
      res.status(429).json({
        error:
          'You have reached your limit for this resource, please upgrade your plan',
        limit: limitResponse.currentLimit,
      });
    }

    next();
  } catch (e) {
    // if this code fails, this is our issue, so we should not throw an error
    Sentry.captureException(e);

    next();
  }
}
