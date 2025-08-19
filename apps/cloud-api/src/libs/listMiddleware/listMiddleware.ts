import type { NextFunction, Request, Response } from 'express';
import { getDefaultProject } from '@letta-cloud/utils-server';
import pathToRegexp from 'path-to-regexp';

/**
 * Middleware that sets the project_id in the query to the default project if not already set.
 * This ensures that requests have a project context when needed.
 */

const listAgentsRoute = pathToRegexp('/v1/agents');
const listBlocksRoute = pathToRegexp('/v1/blocks');
const listIdentitiesRoute = pathToRegexp('/v1/identities');

export async function listMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // Skip if no actor or organization
  if (!req.actor?.cloudOrganizationId) {
    next();
    return;
  }

  if (req.method !== 'GET') {
    next();
    return;
  }

  const isListAgents = listAgentsRoute.exec(req.path);
  const isListBlocks = listBlocksRoute.exec(req.path);
  const isListIdentities = listIdentitiesRoute.exec(req.path);

  if (!isListAgents && !isListBlocks && !isListIdentities) {
    next();
    return;
  }

  // always never show_hidden_agents
  if (req.query.show_hidden_agents) {
    res.status(400).json({
      error:
        'show_hidden_agents query parameter is not allowed in this endpoint.',
    });
    return;
  }

  // Skip if project_id is already present in query
  if (req.query.project_id) {
    next();
    return;
  }

  try {
    const { id: defaultProjectId } = await getDefaultProject({
      organizationId: req.actor.cloudOrganizationId,
    });

    // Set the default project_id in the query
    req.query.project_id = defaultProjectId;

    next();
  } catch (_error) {
    // If we can't get the default project, continue without setting it
    // This allows the request to proceed and potentially fail with appropriate error handling downstream
    res.status(400).json({
      error:
        'Could not determine default project for the organization. Please provide a project_id in the query.',
    });
  }
}
