import pathToRegexp from 'path-to-regexp';
import type { NextFunction, Request, Response } from 'express';
import { DEFAULT_EMBEDDING_MODEL } from '@letta-cloud/types';

const foldersRoute = pathToRegexp('/v1/folders');
const sourcesRoute = pathToRegexp('/v1/sources');

export function datasourceMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // Skip if the request is not a POST request
  if (req.method !== 'POST') {
    next();
    return;
  }

  // Skip if the request does not match the folders route
  const isFolders = foldersRoute.exec(req.path);
  const isSources = sourcesRoute.exec(req.path);
  if (!isFolders && !isSources) {
    next();
    return;
  }

  // expose body
  // throw error if embedding_config is present in the body
  if (req.body?.embedding_config) {
    res.status(400).json({
      error: 'Embedding configuration is not allowed in cloud API',
    });
    return;
  }

  if (req.body?.embedding) {
    if (req.body.embedding !== DEFAULT_EMBEDDING_MODEL) {
      res.status(400).json({
        error: 'Embedding is not customizable in cloud API',
      });
      return;
    }
  }

  if (req.body?.embedding_chunk_size) {
    res.status(400).json({
      error: 'Embedding chunk size is not allowed in cloud API',
    });
    return;
  }

  // attach embedding to req.body
  req.body.embedding = DEFAULT_EMBEDDING_MODEL;

  next();
}
