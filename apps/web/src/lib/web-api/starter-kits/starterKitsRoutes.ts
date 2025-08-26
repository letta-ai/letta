import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '@letta-cloud/sdk-web';
import {
  isAStarterKitName,
  STARTER_KITS,
} from '@letta-cloud/config-agent-starter-kits';
import type { StarterKitTool } from '@letta-cloud/config-agent-starter-kits';
import { ToolsService } from '@letta-cloud/sdk-core';
import { getUserWithActiveOrganizationIdOrThrow } from '$web/server/auth';
import { agentTemplates, db, projects } from '@letta-cloud/service-database';
import { and, count, eq } from 'drizzle-orm';
import { cloudApiRouter } from 'tmp-cloud-api-router';
import {
  getActiveBillableAgentsCount,
  getCustomerSubscription,
} from '@letta-cloud/service-payments';
import { getUsageLimits } from '@letta-cloud/utils-shared';
import { getDefaultProject } from '@letta-cloud/utils-server';
import { DEFAULT_EMBEDDING_MODEL, DEFAULT_LLM_MODEL } from '@letta-cloud/types';
import { createTemplateFromAgentState } from '@letta-cloud/utils-server';

type CreateAgentFromStarterKitsRequest = ServerInferRequest<
  typeof contracts.starterKits.createAgentFromStarterKit
>;
type CreateAgentFromStarterKitsResponse = ServerInferResponses<
  typeof contracts.starterKits.createAgentFromStarterKit
>;

async function createToolsInStarterKit(
  tools: StarterKitTool[],
  lettaAgentsUserId: string,
) {
  let toolIdsToAttach: string[] = [];

  const existingTools = await ToolsService.listTools(
    {
      limit: 500,
    },
    {
      user_id: lettaAgentsUserId,
    },
  );

  const toolNameMap = (existingTools || []).reduce((acc, tool) => {
    acc.add(tool.name || '');

    return acc;
  }, new Set<string>());

  const toolsToCreate = tools.filter((tool) => {
    return !toolNameMap.has(tool.name);
  });

  const toolResponse = await Promise.all(
    toolsToCreate.map((tool) => {
      return ToolsService.createTool(
        {
          requestBody: {
            source_code: tool.code,
            description: 'A custom tool',
          },
        },
        {
          user_id: lettaAgentsUserId,
        },
      );
    }),
  );

  toolIdsToAttach = toolResponse.map((tool) => tool.id || '');

  return [
    ...toolIdsToAttach,
    ...(tools || []).map((tool) => {
      const existingTool = existingTools?.find(
        (existingTool) => existingTool.name === tool.name,
      );

      return existingTool?.id || '';
    }),
  ].filter(Boolean);
}

async function createAgentFromStarterKit(
  req: CreateAgentFromStarterKitsRequest,
): Promise<CreateAgentFromStarterKitsResponse> {
  const { starterKitId } = req.params;
  const { lettaAgentsId, activeOrganizationId, id } =
    await getUserWithActiveOrganizationIdOrThrow();

  let { projectId } = req.body;

  if (!projectId) {
    projectId = (
      await getDefaultProject({
        organizationId: activeOrganizationId,
      })
    ).id;
  }

  if (!isAStarterKitName(starterKitId)) {
    return {
      status: 400,
      body: {
        message: 'Invalid starter kit id',
      },
    };
  }

  const subscription = await getCustomerSubscription(activeOrganizationId);

  const limits = await getUsageLimits(subscription.tier);

  const agentsCount = await getActiveBillableAgentsCount(activeOrganizationId);

  if (agentsCount >= limits.agents) {
    return {
      status: 402,
      body: {
        message:
          'You have reached your limit for this resource, please upgrade your plan',
        limit: limits.agents,
      },
    };
  }

  const starterKit = STARTER_KITS[starterKitId];

  if (!starterKit) {
    return {
      status: 404,
      body: {
        message: 'Starter kit not found',
      },
    };
  }

  // lookup projectId
  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.organizationId, activeOrganizationId),
    ),
  });

  if (!project) {
    return {
      status: 404,
      body: {
        message: 'Project not found',
      },
    };
  }

  const toolIds =
    'tools' in starterKit
      ? await createToolsInStarterKit(starterKit.tools, lettaAgentsId)
      : [];

  const agent = await cloudApiRouter.agents.createAgent(
    {
      body: {
        ...starterKit.agentState,
        name: starterKit.name,
        model:
          'model' in starterKit.agentState
            ? starterKit.agentState.model
            : DEFAULT_LLM_MODEL,
        embedding: DEFAULT_EMBEDDING_MODEL,
        tool_ids: toolIds,
        project_id: project.id,
        initial_message_sequence: [],
      },
    },
    {
      request: {
        organizationId: activeOrganizationId,
        lettaAgentsUserId: lettaAgentsId,
        userId: id,
        source: 'web',
      },
    },
  );

  if (agent.status !== 201) {
    return {
      status: 500,
      body: {
        message: 'Failed to create agent',
      },
    };
  }

  return {
    status: 201,
    body: {
      projectSlug: project.slug,
      agentId: agent.body.id,
    },
  };
}

type CreateTemplateFromStarterKitsRequest = ServerInferRequest<
  typeof contracts.starterKits.createTemplateFromStarterKit
>;
type CreateTemplateFromStarterKitsResponse = ServerInferResponses<
  typeof contracts.starterKits.createTemplateFromStarterKit
>;

// this is the only way to create a template
async function createTemplateFromStarterKit(
  req: CreateTemplateFromStarterKitsRequest,
): Promise<CreateTemplateFromStarterKitsResponse> {
  const { starterKitId } = req.params;
  const {
    lettaAgentsId,
    activeOrganizationId,
    id: userId,
  } = await getUserWithActiveOrganizationIdOrThrow();
  let { projectId } = req.body;

  if (!projectId) {
    projectId = (
      await getDefaultProject({
        organizationId: activeOrganizationId,
      })
    ).id;
  }

  if (!isAStarterKitName(starterKitId)) {
    return {
      status: 400,
      body: {
        message: 'Invalid starter kit id',
      },
    };
  }

  const starterKit = STARTER_KITS[starterKitId];

  if (!starterKit) {
    return {
      status: 404,
      body: {
        message: 'Starter kit not found',
      },
    };
  }

  const subscription = await getCustomerSubscription(activeOrganizationId);

  const limits = await getUsageLimits(subscription.tier);

  const [templateDetails] = await db
    .select({ count: count() })
    .from(agentTemplates)
    .where(eq(agentTemplates.organizationId, activeOrganizationId));

  if (templateDetails.count >= limits.templates) {
    return {
      status: 402,
      body: {
        message:
          'You have reached your limit for this resource, please upgrade your plan',
        limit: limits.templates,
      },
    };
  }

  const data = await ToolsService.listTools(
    {
      limit: 2000,
    },
    {
      user_id: lettaAgentsId,
    },
  ).catch(() => {
    return null
  });

  if (!data) {
    return {
      status: 500,
      body: {
        message: 'Failed to fetch tools',
      },
    };
  }

  const toolIdsForStarterKit = data.filter(
    (tool) =>
      tool.name &&
      tool.tool_type &&
      ['letta_core', 'letta_sleeptime_core'].includes(tool.tool_type) &&
      [
        'conversation_search',
        'memory_insert',
        'memory_replace',
        'send_message',
      ].includes(tool.name),
  );

  const toolIds =
    'tools' in starterKit
      ? await createToolsInStarterKit(starterKit.tools, lettaAgentsId)
      : [];

  const template = await createTemplateFromAgentState({
    projectId,
    organizationId: activeOrganizationId,
    lettaAgentsId,
    userId,
    agentState: {
      ...starterKit.agentState,
      memory: {
        blocks: starterKit.agentState.memory_blocks,
      },
      // Use tool rules from the starter kit if defined, otherwise default to terminal rule for send_message
      tool_rules: starterKit.agentState.tool_rules || [
        {
          type: 'exit_loop',
          tool_name: 'send_message',
        },
      ],
      tools: [
        ...toolIds.map((toolId) => ({
          id: toolId,
        })),
        ...toolIdsForStarterKit,
      ],
      llm_config: {
        enable_reasoner: true,
        handle:
          'model' in starterKit.agentState
            ? starterKit.agentState.model
            : DEFAULT_LLM_MODEL,
      },
    },
  });

  return {
    status: 201,
    body: {
      projectSlug: template.projectSlug,
      templateName: template.lettaTemplate.name,
    },
  };
}

export const starterKitsRouter = {
  createAgentFromStarterKit,
  createTemplateFromStarterKit,
};
