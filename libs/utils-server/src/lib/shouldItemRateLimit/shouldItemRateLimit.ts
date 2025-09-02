// applicable urls
/*
/v1/agents
/v1/tools
/v1/sources
/v1/groups
/v1/identities
/v1/blocks
 */

import type { UsageLimits } from '@letta-cloud/utils-shared';
import pathToRegexp from 'path-to-regexp';
import {
  BlocksService,
  IdentitiesService,
  SourcesService,
  ToolsService,
} from '@letta-cloud/sdk-core';
import { getActiveBillableAgentsCount } from '@letta-cloud/service-payments';

interface ShouldRateLimitPayload {
  path: string;
  limits: UsageLimits;
  actor: {
    cloudOrganizationId: string;
    cloudUserId: string;
    coreUserId: string;
  };
}

const agentsOtherRoute = pathToRegexp(
  '/v1/templates/:project/:template_version/agents',
);
const agentsRoute = pathToRegexp('/v1/agents');
const toolsRoute = pathToRegexp('/v1/tools');
const sourcesRoute = pathToRegexp('/v1/sources');
const foldersRoute = pathToRegexp('/v1/folders');

// const groupsRoute = pathToRegexp('/v1/groups');
const identitiesRoute = pathToRegexp('/v1/identities');
const blocksRoute = pathToRegexp('/v1/blocks');

async function canCreateAgent(
  payload: ShouldRateLimitPayload,
): Promise<ShouldItemRateLimitResponse | null> {
  const { limits, actor } = payload;

  const { cloudOrganizationId } = actor;

  const agentsCount = await getActiveBillableAgentsCount(cloudOrganizationId);

  if (agentsCount >= limits.agents) {
    return {
      type: 'agents',
      currentLimit: limits.agents,
    };
  }

  return null;
}

async function canCreateTool(
  payload: ShouldRateLimitPayload,
): Promise<ShouldItemRateLimitResponse | null> {
  const { limits, actor } = payload;

  const { coreUserId } = actor;

  const toolCount = await ToolsService.countTools(
    {
      excludeLettaTools: true,
    },
    {
      user_id: coreUserId,
    },
  );

  if (toolCount >= limits.tools) {
    return {
      type: 'tools',
      currentLimit: limits.tools,
    };
  }

  return null;
}

async function canCreateIdentity(
  payload: ShouldRateLimitPayload,
): Promise<ShouldItemRateLimitResponse | null> {
  const { limits, actor } = payload;

  const { coreUserId } = actor;

  const identitiesCount = await IdentitiesService.countIdentities(
    {},
    {
      user_id: coreUserId,
    },
  );

  if (identitiesCount >= limits.identities) {
    return {
      type: 'identities',
      currentLimit: limits.identities,
    };
  }

  return null;
}

async function canCreateSource(
  payload: ShouldRateLimitPayload,
): Promise<ShouldItemRateLimitResponse | null> {
  const { limits, actor } = payload;

  const { coreUserId } = actor;

  const sourcesCount = await SourcesService.countSources(
    {},
    {
      user_id: coreUserId,
    },
  );

  if (sourcesCount >= limits.dataSources) {
    return {
      type: 'sources',
      currentLimit: limits.dataSources,
    };
  }

  return null;
}

async function canCreateBlock(
  payload: ShouldRateLimitPayload,
): Promise<ShouldItemRateLimitResponse | null> {
  const { limits, actor } = payload;

  const { coreUserId } = actor;

  const blocksCount = await BlocksService.countBlocks(
    {},
    {
      user_id: coreUserId,
    },
  );

  if (blocksCount >= limits.blocks) {
    return {
      type: 'blocks',
      currentLimit: limits.blocks,
    };
  }

  return null;
}

interface ShouldItemRateLimitResponse {
  type: 'agents' | 'blocks' | 'groups' | 'identities' | 'sources' | 'tools';
  currentLimit: number;
}

export async function shouldItemRateLimit(
  payload: ShouldRateLimitPayload,
): Promise<ShouldItemRateLimitResponse | null> {
  if (agentsRoute.test(payload.path) || agentsOtherRoute.test(payload.path)) {
    return canCreateAgent(payload);
  }

  if (toolsRoute.test(payload.path)) {
    return canCreateTool(payload);
  }

  if (identitiesRoute.test(payload.path)) {
    return canCreateIdentity(payload);
  }

  if (blocksRoute.test(payload.path)) {
    return canCreateBlock(payload);
  }

  if (sourcesRoute.test(payload.path)) {
    return canCreateSource(payload);
  }

  if (foldersRoute.test(payload.path)) {
    return canCreateSource(payload);
  }

  return null;
}
