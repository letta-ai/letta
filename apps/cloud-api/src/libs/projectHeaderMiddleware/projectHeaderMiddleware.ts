import type { NextFunction, Request, Response } from 'express';
import { getProjectBySlug } from '@letta-cloud/utils-server';

/* If `x-project` is present in the headers and we're a POST request, we will look for the project add attach project_id to the request */
export async function projectHeaderMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const projectHeader = req.headers['x-project'];

  if (!req.actor) {
    next();
    return;
  }

  if (typeof projectHeader !== 'string') {
    next();
    return;
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    next();
    return;
  }

  // if project_id is already present, we don't need to do anything
  if (Object.prototype.hasOwnProperty.call(req.body, 'project_id')) {
    next();
    return;
  }

  const project = await getProjectBySlug(
    projectHeader,
    req.actor.cloudOrganizationId,
  );

  if (!project) {
    res
      .status(404)
      .json({ error: 'x-project does not refer to a project slug' });
    return;
  }

  req.body = {
    ...req.body,
    project_id: project.id,
  };

  delete req.headers['x-project'];

  next();
}
