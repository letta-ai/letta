import type { NextFunction, Request, Response } from 'express';
import { getCustomerSubscription } from '@letta-cloud/service-payments';
import { getUsageLimits } from '@letta-cloud/utils-shared';
import { shouldItemRateLimit } from '@letta-cloud/utils-server';
import * as Sentry from '@sentry/node';
import { getSingleFlag } from '@letta-cloud/service-feature-flags';

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
      next();
      return;
    }

    const [subscription, shouldRateLimitUser] = await Promise.all([
      getCustomerSubscription(req.actor.cloudOrganizationId),
      getSingleFlag('PRO_PLAN', req.actor.cloudOrganizationId),
    ]);

    if (!shouldRateLimitUser) {
      next();
      return;
    }

    const limits = await getUsageLimits(subscription.tier);

    const limitResponse = await shouldItemRateLimit({
      path: req.path,
      actor: req.actor,
      limits,
    });

    if (limitResponse) {
      res.status(402).json({
        error:
          'You have reached your limit for this resource, please upgrade your plan',
        limit: limitResponse.currentLimit,
      });
      return;
    }

    next();
  } catch (e) {
    // if this code fails, this is our issue, so we should not throw an error
    Sentry.captureException(e);

    next();
  }
}
