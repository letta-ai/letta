import type { NextFunction, Request, Response } from 'express';
import { zodTypes } from '@letta-cloud/sdk-core';
import { contentModerationCheck } from '@letta-cloud/utils-server';
import { getIsCreateMessageRoute } from '../../utils/getIsCreateMessageRoute';

export function contentModerationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.actor) {
    next();
    return;
  }

  if (!req.actor?.cloudOrganizationId) {
    next();
    return;
  }

  const result = getIsCreateMessageRoute(req.path);

  if (!result || req.method !== 'POST') {
    next();
    return;
  }

  const body = zodTypes.LettaRequest.safeParse(req.body);

  if (!body.success) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }

  next();

  let message = '';

  body.data.messages.forEach((m) => {
    if ('content' in m) {
      if (typeof m.content === 'string') {
        message += m.content + ' ';
      } else {
        message += JSON.stringify(m.content) + ' ';
      }
    }
  });

  void contentModerationCheck({
    message,
    organizationId: req.actor.cloudOrganizationId,
  });
}
