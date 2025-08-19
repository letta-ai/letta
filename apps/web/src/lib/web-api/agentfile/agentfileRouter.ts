import { AgentsService } from '@letta-cloud/sdk-core';
import type { contracts } from '@letta-cloud/sdk-web';
import type { ServerInferResponses, ServerInferRequest } from '@ts-rest/core';
import {
  userHasAgentfileAccess,
  getAgentfilePermissions,
  SERVER_CODE,
} from './helpers';
import { getUser } from '$web/server/auth';
import { getOrganizationLettaServiceAccountId } from '$web/server/lib/getOrganizationLettaServiceAccountId/getOrganizationLettaServiceAccountId';
import {
  db,
  agentfilePermissions,
  organizations,
  agentfileStats,
} from '@letta-cloud/service-database';
import { and, count, desc, eq, ilike, sql } from 'drizzle-orm';

type AgentfileResponse = ServerInferResponses<
  typeof contracts.agentfile.getAgentfile
>;

type AgentfileRequest = ServerInferRequest<
  typeof contracts.agentfile.getAgentfile
>;

export async function getAgentfile(
  request: AgentfileRequest,
): Promise<AgentfileResponse> {
  const { agentId } = request.params;
  if (!agentId) {
    return {
      status: SERVER_CODE.CLIENT_ERROR,
      body: 'Agent ID is required',
    };
  }

  const user = await getUser();
  const permissions = await getAgentfilePermissions(agentId);

  if (!permissions) {
    return {
      status: SERVER_CODE.FAILED_DEPENDENCY,
      body: 'Agentfile permissions not found',
    };
  }

  const downloadIsAllowed = await userHasAgentfileAccess(user, permissions);
  if (!downloadIsAllowed) {
    return {
      status: SERVER_CODE.FORBIDDEN,
      body: 'You do not have access to this agentfile',
    };
  }

  const serviceAccountId = await getOrganizationLettaServiceAccountId(
    permissions.organizationId,
  );
  if (!serviceAccountId) {
    return {
      status: SERVER_CODE.FAILED_DEPENDENCY,
      body: 'Service Account ID not found',
    };
  }

  const exportedAgentfile = await AgentsService.exportAgentSerialized(
    {
      agentId,
    },
    {
      user_id: serviceAccountId,
    },
  );

  await db
    .update(agentfileStats)
    .set({
      totalDownloads: sql`${agentfileStats.totalDownloads}
      + 1`,
    })
    .where(eq(agentfileStats.agentId, agentId));

  if (!exportedAgentfile) {
    return {
      status: SERVER_CODE.NOT_FOUND,
      body: 'Agentfile not found',
    };
  }

  return {
    status: SERVER_CODE.OK,
    body: Object.assign({}, exportedAgentfile, {
      name: permissions.name || '',
      description: permissions.description || '',
      summary: permissions.summary || '',
    }),
  };
}

type UpdateAgentfileAccessLevelRequest = ServerInferRequest<
  typeof contracts.agentfile.updateAgentfileAccessLevel
>;

export async function updateAgentfileAccessLevel(
  request: UpdateAgentfileAccessLevelRequest,
): Promise<AgentfileResponse> {
  const { agentId } = request.params;
  const agentfileDetails = request.body;

  const user = await getUser();
  if (!user) {
    return {
      status: SERVER_CODE.UNAUTHORIZED,
      body: 'Must be logged in to use agent in Letta Cloud',
    };
  }

  const permissions = await getAgentfilePermissions(agentId);
  if (!permissions) {
    return {
      status: SERVER_CODE.FAILED_DEPENDENCY,
      body: 'Agentfile permissions not found',
    };
  }

  const isOwner = user.activeOrganizationId === permissions.organizationId;
  if (!isOwner) {
    return {
      status: SERVER_CODE.UNAUTHORIZED,
      body: 'You do not have permission to update this agentfile access level',
    };
  }

  const [updatedAccessLevel] = await db
    .update(agentfilePermissions)
    .set(agentfileDetails)
    .where(eq(agentfilePermissions.agentId, agentId))
    .returning({ accessLevel: agentfilePermissions.accessLevel });

  return {
    status: SERVER_CODE.OK,
    body: {
      agentId,
      accessLevel: updatedAccessLevel.accessLevel,
    },
  };
}

type GetAgentfileMetadataRequest = ServerInferRequest<
  typeof contracts.agentfile.getAgentfileMetadata
>;

type GetAgentfileMetadataResponse = ServerInferResponses<
  typeof contracts.agentfile.getAgentfileMetadata
>;

export async function getAgentfileMetadata(
  request: GetAgentfileMetadataRequest,
): Promise<GetAgentfileMetadataResponse> {
  const { agentId } = request.params;

  const permissions = await getAgentfilePermissions(agentId);

  if (!permissions) {
    return {
      status: SERVER_CODE.NOT_FOUND,
      body: 'Agentfile metadata not found',
    };
  }

  return {
    status: SERVER_CODE.OK,
    body: {
      name: permissions.name || '',
      description: permissions.description || '',
      summary: permissions.summary || '',
      accessLevel: permissions?.accessLevel || 'none',
      agentId,
    },
  };
}

type CreateAgentfileMetadataRequest = ServerInferRequest<
  typeof contracts.agentfile.createAgentfileMetadata
>;

type CreateAgentfileMetadataResponse = ServerInferResponses<
  typeof contracts.agentfile.createAgentfileMetadata
>;

export async function createAgentfileMetadata(
  request: CreateAgentfileMetadataRequest,
): Promise<CreateAgentfileMetadataResponse> {
  const { agentId } = request.params;
  const { accessLevel, name, description, summary } = request.body;

  const user = await getUser();
  if (!user) {
    return {
      status: SERVER_CODE.UNAUTHORIZED,
      body: 'Must be logged in to use agent in Letta Cloud',
    };
  }

  const organizationId = user.activeOrganizationId;

  if (!organizationId) {
    return {
      status: SERVER_CODE.FAILED_DEPENDENCY,
      body: 'Organization ID not found',
    };
  }

  const [createdPermissions] = await db
    .insert(agentfilePermissions)
    .values({
      agentId,
      organizationId,
      accessLevel,
      name: name || '',
      description: description || '',
      summary: summary || '',
    })
    .returning({
      accessLevel: agentfilePermissions.accessLevel,
      name: agentfilePermissions.name,
      description: agentfilePermissions.description,
      summary: agentfilePermissions.summary,
      organizationId: agentfilePermissions.organizationId,
    });

  await db.insert(agentfileStats).values({
    agentId,
    organizationId,
    totalDownloads: 0,
  });

  return {
    status: SERVER_CODE.OK,
    body: {
      name: createdPermissions.name || '',
      description: createdPermissions.description || '',
      summary: createdPermissions.summary || '',
      agentId,
      accessLevel: createdPermissions.accessLevel,
    },
  };
}

type GetAgentfileSummaryRequest = ServerInferRequest<
  typeof contracts.agentfile.getAgentfileSummary
>;

type GetAgentfileSummaryResponse = ServerInferResponses<
  typeof contracts.agentfile.getAgentfileSummary
>;

export async function getAgentfileSummary(
  request: GetAgentfileSummaryRequest,
): Promise<GetAgentfileSummaryResponse> {
  const { agentId } = request.params;

  const permissions = await getAgentfilePermissions(agentId);

  if (!permissions) {
    return {
      status: SERVER_CODE.NOT_FOUND,
      body: 'Agentfile permissions not found',
    };
  }

  const [serviceAccountId, organization] = await Promise.all([
    getOrganizationLettaServiceAccountId(permissions.organizationId),
    db.query.organizations.findFirst({
      where: eq(organizations.id, permissions.organizationId),
      columns: {
        name: true,
      },
    }),
  ]);

  if (!serviceAccountId) {
    return {
      status: SERVER_CODE.FAILED_DEPENDENCY,
      body: 'Service Account ID not found',
    };
  }

  const { tools, memory, system } = await AgentsService.retrieveAgent(
    {
      agentId,
    },
    {
      user_id: serviceAccountId,
    },
  );

  return {
    status: SERVER_CODE.OK,
    body: {
      memory: memory.blocks.map((block) => ({
        label: block.label || '',
        value: block.value || '',
      })),
      tools: tools.map((tool) => ({
        name: tool.name || '',
        source_type: tool.source_type || '',
        description: tool.description || '',
      })),
      system: system || '',
      description: permissions.description || '',
      summary: permissions.summary || '',
      name: permissions.name || '',
      author: organization?.name || '',
    },
  };
}

type GetAgentfileDetailsRequest = ServerInferRequest<
  typeof contracts.agentfile.getAgentfileDetails
>;

type GetAgentfileDetailsResponse = ServerInferResponses<
  typeof contracts.agentfile.getAgentfileDetails
>;

export async function getAgentfileDetails(
  request: GetAgentfileDetailsRequest,
): Promise<GetAgentfileDetailsResponse> {
  const { agentId } = request.params;

  const user = await getUser();
  const permissions = await getAgentfilePermissions(agentId);
  if (!permissions) {
    return {
      status: SERVER_CODE.NOT_FOUND,
      body: 'Agentfile permissions not found',
    };
  }

  const downloadIsAllowed = await userHasAgentfileAccess(user, permissions);
  if (!downloadIsAllowed) {
    return {
      status: SERVER_CODE.FORBIDDEN,
      body: 'You do not have access to this agentfile',
    };
  }

  const [serviceAccountId, organization, stats] = await Promise.all([
    getOrganizationLettaServiceAccountId(permissions.organizationId),
    db.query.organizations.findFirst({
      where: eq(organizations.id, permissions.organizationId),
      columns: {
        name: true,
      },
    }),
    db.query.agentfileStats.findFirst({
      where: eq(agentfileStats.agentId, agentId),
      columns: {
        totalDownloads: true,
      },
    }),
  ]);

  if (!serviceAccountId) {
    return {
      status: SERVER_CODE.FAILED_DEPENDENCY,
      body: 'Service Account ID not found',
    };
  }

  const {
    tools,
    memory,
    system,
    llm_config,
    tool_rules,
    tool_exec_environment_variables,
  } = await AgentsService.retrieveAgent(
    {
      agentId,
    },
    {
      user_id: serviceAccountId,
    },
  );

  return {
    status: SERVER_CODE.OK,
    body: {
      downloadCount: stats?.totalDownloads || 0,
      upvotes: 0,
      downvotes: 0,
      memory: memory.blocks.map((block) => ({
        label: block.label || '',
        value: block.value || '',
      })),
      tools: tools.map((tool) => ({
        name: tool.name || '',
        source_type: tool.source_type || '',
        description: tool.description || '',
      })),
      llmConfig: {
        handle: llm_config?.handle || llm_config.model,
        temperature: llm_config?.temperature || 0,
        maxTokens: llm_config?.max_tokens || 0,
      },
      system: system || '',
      description: permissions.description || '',
      summary: permissions.summary || '',
      name: permissions.name || '',
      author: organization?.name || '',
      toolRules: tool_rules || [], // Assuming tool_rules is an array of objects
      publishedAt: permissions.createdAt.toISOString(),
      toolVariables: (tool_exec_environment_variables || []).map(
        (variable) => ({
          name: variable.key || '',
          value: variable.value || '',
        }),
      ),
    },
  };
}

type ListAgentfilesRequest = ServerInferRequest<
  typeof contracts.agentfile.listAgentfiles
>;

type ListAgentfilesResponse = ServerInferResponses<
  typeof contracts.agentfile.listAgentfiles
>;

export async function listAgentfiles(
  request: ListAgentfilesRequest,
): Promise<ListAgentfilesResponse> {
  const { limit = 5, offset = 0, search } = request.query;

  const query = [eq(agentfilePermissions.accessLevel, 'public')];

  if (search) {
    query.push(ilike(agentfilePermissions.name, `%${search}%`));
  }

  const where = and(...query);

  const [agentfiles, metrics] = await Promise.all([
    db.query.agentfilePermissions.findMany({
      where,
      with: {
        agentfileStats: true,
        organization: {
          columns: {
            name: true,
          },
        },
      },
      orderBy: desc(agentfilePermissions.createdAt),
      limit: limit + 1,
      offset,
    }),
    db.select({ count: count() }).from(agentfilePermissions).where(where),
  ]);

  const formattedAgentfiles = agentfiles
    .map((agent) => {
      return {
        agentId: agent.agentId,
        name: agent.name,
        description: agent.description,
        summary: agent.summary,
        author: agent.organization?.name || 'Unknown',
        downloadCount: agent.agentfileStats?.totalDownloads || 0,
      };
    })
    .slice(0, limit);

  return {
    status: SERVER_CODE.OK,
    body: {
      totalCount: metrics[0].count || 0,
      items: formattedAgentfiles,
      hasNextPage: agentfiles.length > limit,
    },
  };
}

export const agentfileRouter = {
  getAgentfile,
  createAgentfileMetadata,
  getAgentfileMetadata,
  getAgentfileSummary,
  updateAgentfileAccessLevel,
  getAgentfileDetails,
  listAgentfiles,
};
