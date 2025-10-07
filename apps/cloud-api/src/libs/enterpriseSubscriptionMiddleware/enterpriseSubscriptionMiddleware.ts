import pathToRegexp from 'path-to-regexp';
import type { Request, Response, NextFunction } from 'express';
import { getCustomerSubscription } from '@letta-cloud/service-payments';
import * as Sentry from '@sentry/node';

const providersRoute = pathToRegexp('/v1/providers/?', [], { end: true, strict: false, sensitive: true });

export async function enterpriseSubscriptionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const isProvidersRoute = providersRoute.test(req.path);
    if (!isProvidersRoute || req.method !== 'POST') {
      next();
      return;
    }

    if (!req.actor?.cloudOrganizationId) {
      next();
      return;
    }

    const subscription = await getCustomerSubscription(
      req.actor.cloudOrganizationId,
    );

    if (subscription.tier !== 'enterprise') {
      res.status(403).json({
        error: 'This endpoint is only available for enterprise customers',
      });
      return;
    }

    next();
  } catch (e) {
    Sentry.captureException(e);
    next();
  }
}
