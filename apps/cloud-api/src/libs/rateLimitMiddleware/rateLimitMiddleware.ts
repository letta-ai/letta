import type { Request, Response, NextFunction } from 'express';
import { handleMessageRateLimiting } from '@letta-cloud/utils-server';
import { type MessageCreate, zodTypes } from '@letta-cloud/sdk-core';

const EXPLICIT_RATE_LIMIT_ROUTE = new RegExp(
  '/v1/agents/([A-Za-z0-9-]+)/messages(/stream|/async)?',
);

export async function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.actor) {
    next();
    return;
  }

  const result = EXPLICIT_RATE_LIMIT_ROUTE.exec(req.path);

  if (!result || req.method !== 'POST') {
    next();
    return;
  }

  if (process.env.IS_API_STABILITY_TEST === 'yes') {
    next();
    return;
  }

  const agentId = result[1];

  const body = zodTypes.LettaRequest.safeParse(req.body);

  if (!body.success) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }

  const { isRateLimited, reasons } = await handleMessageRateLimiting({
    organizationId: req.actor.cloudOrganizationId,
    agentId,
    messages: body.data.messages as MessageCreate[],
    type: 'inference',
    lettaAgentsUserId: req.actor.coreUserId,
  });

  if (isRateLimited) {
    const statusCode = (reasons || []).includes('not-enough-credits')
      ? 402
      : 429;

    res.status(statusCode).json({ error: 'Rate limited', reasons });
    return;
  }

  next();
}
