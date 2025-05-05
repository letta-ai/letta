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
import { db, deployedAgentMetadata } from '@letta-cloud/service-database';
import { count, eq } from 'drizzle-orm';
import {
  IdentitiesService,
  SourcesService,
  ToolsService,
} from '@letta-cloud/sdk-core';

interface ShouldRateLimitPayload {
  path: string;
  limits: UsageLimits;
  actor: {
    cloudOrganizationId: string;
    cloudUserId: string;
    coreUserId: string;
  };
}

const agentsRoute = pathToRegexp('/v1/agents');
const toolsRoute = pathToRegexp('/v1/tools');
const sourcesRoute = pathToRegexp('/v1/sources');
// const groupsRoute = pathToRegexp('/v1/groups');
const identitiesRoute = pathToRegexp('/v1/identities');
// const blocksRoute = pathToRegexp('/v1/blocks');

async function canCreateAgent(
  payload: ShouldRateLimitPayload,
): Promise<ShouldItemRateLimitResponse | null> {
  const { limits, actor } = payload;

  const { cloudOrganizationId } = actor;

  const [agents] = await db
    .select({ count: count() })
    .from(deployedAgentMetadata)
    .where(eq(deployedAgentMetadata.organizationId, cloudOrganizationId));

  if (agents.count >= limits.agents) {
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
      includeBaseTools: false,
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

  if (sourcesCount >= limits.identities) {
    return {
      type: 'sources',
      currentLimit: limits.identities,
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
  if (agentsRoute.test(payload.path)) {
    return canCreateAgent(payload);
  }

  if (toolsRoute.test(payload.path)) {
    return canCreateTool(payload);
  }

  if (identitiesRoute.test(payload.path)) {
    return canCreateIdentity(payload);
  }

  if (sourcesRoute.test(payload.path)) {
    return canCreateSource(payload);
  }

  return null;
}
