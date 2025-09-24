import type { NextFunction, Request, Response } from 'express';
import * as Sentry from '@sentry/node';
import { trackServerSideEvent } from '@letta-cloud/service-analytics/server';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';
import { getIsCreateMessageRoute } from '../../utils/getIsCreateMessageRoute';

function handleToolsPath(normalizedPath: string): string {
  let result = normalizedPath;

  // Handle MCP server paths
  // Examples:
  // tools/mcp/servers/Deepwiki/some_tool -> tools/mcp/servers/mcp_server_name/mcp_tool_name
  // tools/mcp/servers/Deepwiki/tools -> tools/mcp/servers/mcp_server_name/tools (preserve /tools endpoint)
  if (result.includes('tools/mcp/servers/')) {
    // Replace mcp server name: tools/mcp/servers/{anything}/...
    result = result.replace(
      /^(tools\/mcp\/servers\/)([^/]+)(\/?.*)$/,
      '$1mcp_server_name$3',
    );

    // Replace mcp tool name in paths: .../servers/{server_name}/{mcp_tool_name}
    // But exclude paths that end with '/tools' as that's a different endpoint
    result = result.replace(
      /^(.*\/servers\/mcp_server_name\/)([^/]+)$/,
      (match, prefix, segment) => {
        if (segment === 'tools') {
          return match; // Don't replace if it's the '/tools' endpoint
        }
        return prefix + 'mcp_tool_name';
      },
    );

    // Replace tool name in MCP paths: .../tools/{anything}/execute
    result = result.replace(
      /^(.*\/tools\/)([^/]+)(\/execute)$/,
      '$1tool_name$3',
    );
  }


  return result;
}

function handleSourcesPath(normalizedPath: string): string {
  // Handle source name paths: sources/name/{anything}
  if (normalizedPath.includes('sources/name/')) {
    return normalizedPath.replace(
      /^(sources\/name\/)([^/]+)$/,
      '$1source_name',
    );
  }
  return normalizedPath;
}

function handleFoldersPath(normalizedPath: string): string {
  // Handle folder name paths: folders/name/{anything}
  if (normalizedPath.includes('folders/name/')) {
    return normalizedPath.replace(
      /^(folders\/name\/)([^/]+)$/,
      '$1folder_name',
    );
  }
  return normalizedPath;
}

function handleTemplatesPath(normalizedPath: string): string {
  // Handle template paths: templates/{project}/{template_name_or_version}/...
  return normalizedPath.replace(
    /^(templates\/[^/]+\/)([^/]+)(\/?.*)$/,
    '$1template_name$3',
  );
}

function normalizeEndpointPath(path: string): string {
  // Extract the part after /v1/
  const v1Index = path.indexOf('/v1/');
  if (v1Index === -1) {
    return path;
  }

  const afterV1 = path.substring(v1Index + 4); // +4 for '/v1/'

  // Normalize all IDs with a single regex pattern
  const normalizedPath = afterV1.replace(
    /(agent|source|file|folder|tool|block|memory|run|batch|job|step|group|identity|provider|message|user|org|session|template|token)-[a-zA-Z0-9_-]+/g,
    (match) => {
      const prefix = match.split('-')[0];
      return prefix + '_id';
    },
  );

  // Get the first segment after /v1/
  const firstSegment = normalizedPath.split('/')[0];

  switch (firstSegment) {
    case 'tools':
      return '/v1/' + handleToolsPath(normalizedPath);

    case 'sources':
      return '/v1/' + handleSourcesPath(normalizedPath);

    case 'folders':
      return '/v1/' + handleFoldersPath(normalizedPath);

    case 'templates':
      return '/v1/' + handleTemplatesPath(normalizedPath);

    default:
      // For other endpoints, just return the normalized /v1/ part
      return '/v1/' + normalizedPath;
  }
}

export async function trackingMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    if (!req.actor) {
      next();
      return;
    }

    if (req.actor.source === 'api') {
      void trackServerSideEvent(AnalyticsEvent.API_VISIT, {
        user_id: req.actor.cloudUserId,
        organization_id: req.actor.cloudOrganizationId || '',
        endpoint: normalizeEndpointPath(req.path) || '',
        method: req.method || '',
        body: req.body || '', // Relevant to track things like message roles
        route: req.method + ' ' + normalizeEndpointPath(req.path),
      });
    }

    const result = getIsCreateMessageRoute(req.path);

    if (!result || req.method !== 'POST') {
      next();
      return;
    }

    next();
  } catch (e) {
    // if this code fails, this is our issue, so we should not throw an error
    Sentry.captureException(e);

    next();
  }
}
