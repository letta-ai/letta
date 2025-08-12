import type { Request, Response, NextFunction } from 'express';
import { handleMessageRateLimiting } from '@letta-cloud/utils-server';
import { type MessageCreate, zodTypes } from '@letta-cloud/sdk-core';
import { getAgentIdFromMessageRoute } from '../../utils/getIsCreateMessageRoute';




export async function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.actor) {
    next();
    return;
  }

  const agentId = getAgentIdFromMessageRoute(req.path);


  if (!agentId || req.method !== 'POST') {
    next();
    return;
  }


  console.log(`Rate limiting for agent ${agentId} in path ${req.path}`);

  if (process.env.IS_API_STABILITY_TEST === 'yes') {
    next();
    return;
  }

  const body = zodTypes.LettaRequest.safeParse(req.body);

  if (!body.success) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }

  // @ts-expect-error - this is a valid type
  const { isRateLimited, reasons } = await handleMessageRateLimiting(req, {
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
