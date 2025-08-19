/* for the following urls, require project_id in the body or x-project in the header
    POST /v1/agents
    POST /v1/identities
    POST /v1/agents/import
 */

import type { NextFunction, Request, Response } from 'express';
import pathToRegexp from 'path-to-regexp';
import {
  findProjectBySlugOrId,
  getDefaultProject,
} from '@letta-cloud/utils-server';

// agents route is handled in the agentsRouter itself
const agentsRoute = pathToRegexp('/v1/agents');
const identitiesRoute = pathToRegexp('/v1/identities');
const blocksRoute = pathToRegexp('/v1/blocks');
const agentsImportRoute = pathToRegexp('/v1/agents/import');

export async function requireProjectMiddleware(
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

  const pathname = req.path;
  const method = req.method;

  if (method === 'GET' && agentsRoute.test(pathname)) {
    // if GET request to /v1/agents, we should check the project_id if present

    // query
    const projectId = req.query?.project_id;
    const projectHeader = req.headers['x-project'];

    if (!projectHeader && !projectId) {
      // no check if neither project_id nor x-project header is present
      next();
      return;
    }

    const real = await findProjectBySlugOrId({
      projectId: projectId as string,
      projectSlug: projectHeader as string,
    });

    if (!real) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    next();
    return;
  }

  if (method !== 'POST' && method !== 'PUT') {
    next();
    return;
  }

  const isIdentitiesRoute = identitiesRoute.test(pathname);
  const isAgentsImportRoute = agentsImportRoute.test(pathname);
  const isBlocksRoute = blocksRoute.test(pathname);

  if (!isIdentitiesRoute && !isAgentsImportRoute && !isBlocksRoute) {
    next();
    return;
  }

  const projectHeader = req.headers['x-project'];
  const projectId = req.body?.project_id || req.query?.project_id;

  if (!projectHeader && !projectId && !req.body?.from_template) {
    // if no project_id or x-project header is present use the default project

    const { id: defaultProject } = await getDefaultProject({
      organizationId: req.actor.cloudOrganizationId,
    });

    req.body = {
      ...req.body,
      project_id: defaultProject,
    };

    next();
    return;
  }

  if (projectId && typeof projectId !== 'string') {
    res.status(400).json({ error: 'project_id must be a string' });
    return;
  }

  if (projectId && projectHeader) {
    res
      .status(400)
      .json({ error: 'Cannot use both x-project header and project_id' });
    return;
  }

  const real = await findProjectBySlugOrId({
    projectId: projectId as string,
    projectSlug: projectHeader as string,
  });

  if (!real) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  next();
}
