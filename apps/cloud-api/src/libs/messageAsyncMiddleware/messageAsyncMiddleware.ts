import type { Request, Response, NextFunction } from 'express';
import { getAgentIdFromMessageRoute, getIsCreateMessageAsyncRoute } from '../../utils/getIsCreateMessageRoute'
import { getSingleFlag, getSingleFlagForAgent } from '@letta-cloud/service-feature-flags';



export async function messageAsyncMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (!req.actor) {
    next();
    return;
  }

  const isCreateMessageAsyncRoute = getIsCreateMessageAsyncRoute(req.path);

  if (!isCreateMessageAsyncRoute || req.method !== 'POST') {
    next();
    return;
  }

  const agentId = getAgentIdFromMessageRoute(req.path);

  if (!agentId) {
    next();
    return;
  }

  const orgFlag = await getSingleFlag('USE_TEMPORAL_MESSAGE_ASYNC', req.actor.cloudOrganizationId);
  const agentFlag = await getSingleFlagForAgent('USE_TEMPORAL_MESSAGE_ASYNC', agentId);

  if (orgFlag || agentFlag) {
    req.headers['X-Experimental-Message-Async'] = 'true';
  }

  next();
}
