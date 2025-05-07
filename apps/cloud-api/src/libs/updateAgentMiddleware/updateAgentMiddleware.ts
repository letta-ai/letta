import pathToRegexp from 'path-to-regexp';
import type { NextFunction, Request, Response } from 'express';
import { verifyUpdateAgent } from '@letta-cloud/utils-server';

const agentsRoute = pathToRegexp('/v1/agents/:agent_id');

export async function updateAgentMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.method !== 'PATCH') {
    next();
    return;
  }

  if (!req.actor?.cloudOrganizationId) {
    next();
    return;
  }

  const isAgentsRoute = agentsRoute.test(req.path);

  if (!isAgentsRoute) {
    next();
    return;
  }

  const agentId = agentsRoute.exec(req.path)?.[1] || '';

  if (!agentId) {
    res.status(400).json({ error: 'Agent ID is required' });
    return;
  }

  const response = await verifyUpdateAgent({
    agentId,
    coreUserId: req.actor.coreUserId,
    organizationId: req.actor.cloudOrganizationId,
    name: req.body.name,
  });

  if (!response) {
    next();

    return;
  }

  res.status(response.status).json({
    error: response.message,
  });

  return;
}
