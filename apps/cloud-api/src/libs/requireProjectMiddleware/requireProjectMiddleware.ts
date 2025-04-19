/* for the following urls, require project_id in the body or x-project in the header
    POST /v1/agents
    POST /v1/identities
    POST /v1/agents/import
 */

import type { NextFunction, Request, Response } from 'express';
import pathToRegexp from 'path-to-regexp';
import { findProjectBySlugOrId } from '@letta-cloud/utils-server';

// agents route is handled in the agentsRouter itself
// const agentsRoute = pathToRegexp('/v1/agents');
const identitiesRoute = pathToRegexp('/v1/identities');
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

  const pathname = req.path;
  const method = req.method;

  if (method !== 'POST') {
    next();
    return;
  }

  const isIdentitiesRoute = identitiesRoute.test(pathname);
  const isAgentsImportRoute = agentsImportRoute.test(pathname);

  if (!isIdentitiesRoute && !isAgentsImportRoute) {
    next();
    return;
  }

  const projectHeader = req.headers['x-project'];
  const projectId = req.body?.project_id || req.query?.project_id;

  if (!projectHeader && !projectId && !req.body?.from_template) {
    res.status(400).json({ error: 'Missing x-project header or project_id' });
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
