import pathToRegexp from 'path-to-regexp';
import type { Request, Response, NextFunction } from 'express';
import { getSingleFlag } from '@letta-cloud/service-feature-flags';

const agentsRoute = pathToRegexp('/v1/agents/?', [], { end: true, strict: false, sensitive: true });

export async function experimentalFlagMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (!req.actor) {
    next();
    return;
  }

  const isAgentsRoute = agentsRoute.test(req.path);
  if (!isAgentsRoute || req.method !== 'POST') {
    next();
    return;
  }

  const flag = await getSingleFlag('USE_LETTA_V1_AGENT', req.actor.cloudOrganizationId);

  if (flag) {
    req.headers['X-Experimental-Letta-V1-Agent'] = 'true';
  }

  next();
}
