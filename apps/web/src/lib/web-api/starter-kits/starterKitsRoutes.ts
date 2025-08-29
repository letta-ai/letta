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
import { DEFAULT_EMBEDDING_MODEL, DEFAULT_LLM_MODEL, DEFAULT_SYSTEM_PROMPT } from '@letta-cloud/types';
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
      ? await createToolsInStarterKit(starterKit.tools || [], lettaAgentsId)
      : [];

  // Don't pass tool_rules at all - let backend handle via include_base_tool_rules
  const { tool_rules, ...agentStateWithoutToolRules } = starterKit.agentState;

  const agentBody: Record<string, unknown> = {
    ...agentStateWithoutToolRules,
    name: starterKit.name,
    model:
      'model' in starterKit.agentState
        ? starterKit.agentState.model
        : DEFAULT_LLM_MODEL,
    embedding: DEFAULT_EMBEDDING_MODEL,
    project_id: project.id,
    initial_message_sequence: [],
    // Backend will add tool rules via include_base_tool_rules (defaults to true)
  };

  // Only add tool_ids if we have custom tools
  if (toolIds.length > 0) {
    agentBody.tool_ids = toolIds;
  }

  const agent = await cloudApiRouter.agents.createAgent(
    {
      body: agentBody,
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

  // Include tool types - memory_insert and memory_replace have type letta_sleeptime_core
  // but we need them for all v2 agents, not just sleeptime
  const toolTypesToInclude = ['letta_core', 'letta_memory_core', 'letta_sleeptime_core'];

  // Base tools that all agents get
  const baseToolNames = [
    'conversation_search',
    'memory_insert',
    'memory_replace',
    'send_message',
  ];

  // Sleeptime agents also get these additional tools
  const sleeptimeToolNames = starterKit.architecture === 'sleeptime'
    ? ['memory_rethink', 'memory_finish_edits']
    : [];

  const allowedToolNames = [...baseToolNames, ...sleeptimeToolNames];

  // Get all matching tools
  const toolIdsForStarterKit = data.filter(
    (tool) =>
      tool.name &&
      tool.tool_type &&
      toolTypesToInclude.includes(tool.tool_type) &&
      allowedToolNames.includes(tool.name)
  );

  const toolIds =
    'tools' in starterKit
      ? await createToolsInStarterKit(starterKit.tools || [], lettaAgentsId)
      : [];

  // Also find and attach any tools specified in agentState.tools (like web_search)
  const additionalToolIds: string[] = [];
  if (starterKit.agentState.tools && Array.isArray(starterKit.agentState.tools)) {
    for (const toolName of starterKit.agentState.tools) {
      const existingTool = data.find(tool => tool.name === toolName);
      if (existingTool?.id) {
        additionalToolIds.push(existingTool.id);
      }
    }
  }

  const template = await createTemplateFromAgentState({
    projectId,
    organizationId: activeOrganizationId,
    lettaAgentsId,
    userId,
    agentState: {
      ...starterKit.agentState,
      system: starterKit.agentState.system || DEFAULT_SYSTEM_PROMPT,
      tags: starterKit.agentState.tags || [],
      identity_ids: starterKit.agentState.identity_ids || [],
      memory: {
        blocks: starterKit.agentState.memory_blocks || [],
      },
      tool_exec_environment_variables: [],
      // Build tool rules similar to what the backend does
      tool_rules: (() => {
        const rules: Array<{type: 'exit_loop' | 'continue_loop', tool_name: string}> = [];

        // Add terminal rule for send_message (and memory_finish_edits for sleeptime)
        const terminalTools = ['send_message'];
        if (starterKit.architecture === 'sleeptime') {
          terminalTools.push('memory_finish_edits');
        }

        for (const toolName of terminalTools) {
          if (toolIdsForStarterKit.some(tool => tool.name === toolName)) {
            rules.push({
              type: 'exit_loop' as const,
              tool_name: toolName,
            });
          }
        }

        // Add continue rules for base memory tools
        const continueTools = [
          'conversation_search',
          'memory_insert',
          'memory_replace',
          ...(starterKit.architecture === 'sleeptime' ? ['memory_rethink'] : [])
        ];

        for (const toolName of continueTools) {
          // Only add if the tool is actually included
          if (toolIdsForStarterKit.some(tool => tool.name === toolName)) {
            rules.push({
              type: 'continue_loop' as const,
              tool_name: toolName,
            });
          }
        }

        return rules;
      })(),
      tools: [
        ...toolIds.map((toolId) => ({
          id: toolId,
        })),
        ...additionalToolIds.map((toolId) => ({
          id: toolId,
        })),
        ...toolIdsForStarterKit.filter(tool => tool.id).map((tool) => ({
          id: tool.id,
          name: tool.name,
          tool_type: tool.tool_type,
        })),
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
