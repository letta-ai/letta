import pathToRegexp from 'path-to-regexp';
import type { NextFunction, Request, Response } from 'express';
import { DEFAULT_EMBEDDING_MODEL } from '@letta-cloud/types';

const agentsImportRoute = pathToRegexp('/v1/agents/import');

/**
 * Middleware that adds X-Override-Embedding-Model header to POST requests
 * to /v1/agents/import, ensuring the backend always uses the DEFAULT_EMBEDDING_MODEL
 * regardless of what's specified in the form data.
 *
 * This middleware:
 * - Only processes POST requests to /v1/agents/import
 * - Adds X-Override-Embedding-Model header with DEFAULT_EMBEDDING_MODEL value
 * - Backend Python code should prioritize this header over form data
 */
export function agentFileUploadMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  // Only handle POST requests to /v1/agents/import
  if (req.method !== 'POST') {
    next();
    return;
  }

  const isAgentsImportRoute = agentsImportRoute.test(req.path);
  if (!isAgentsImportRoute) {
    next();
    return;
  }

  // Add header to override embedding model
  req.headers['x-override-embedding-model'] = DEFAULT_EMBEDDING_MODEL;


  next();
}
