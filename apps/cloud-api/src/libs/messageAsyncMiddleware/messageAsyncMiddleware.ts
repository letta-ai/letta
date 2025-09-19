import type { Request, Response, NextFunction } from 'express';
import { getIsCreateMessageAsyncRoute } from '../../utils/getIsCreateMessageRoute'
import { getSingleFlag } from '@letta-cloud/service-feature-flags';



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

  const flag = await getSingleFlag('USE_TEMPORAL_MESSAGE_ASYNC');

  if (flag) {
    req.headers['X-Experimental-Message-Async'] = 'true';
  }

  next();
}
