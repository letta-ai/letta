import type { NextFunction, Request, Response } from 'express';
import * as Sentry from '@sentry/node';
import { trackServerSideEvent } from '@letta-cloud/service-analytics/server';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';
import { getIsCreateMessageRoute } from '../../utils/getIsCreateMessageRoute';

export async function trackingMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    if (!req.actor) {
      next();
      return;
    }

    const result = getIsCreateMessageRoute(req.path);

    if (!result || req.method !== 'POST') {
      next();
      return;
    }

    void trackServerSideEvent(
      AnalyticsEvent.CLOUD_AGENT_MESSAGE_CREATED_IN_API,
      {
        organizationId: req.actor.cloudOrganizationId,
      },
    );

    next();
  } catch (e) {
    // if this code fails, this is our issue, so we should not throw an error
    Sentry.captureException(e);

    next();
  }
}
