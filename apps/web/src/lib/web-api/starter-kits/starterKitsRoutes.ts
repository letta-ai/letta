import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '@letta-cloud/web-api-client';
import {
  defaultEmbeddingConfig,
  defaultLLMConfig,
  isAStarterKitName,
  STARTER_KITS,
} from '@letta-cloud/agent-starter-kits';
import type { StarterKitTool } from '@letta-cloud/agent-starter-kits';
import { ToolsService } from '@letta-cloud/letta-agents-api';
import { getUserWithActiveOrganizationIdOrThrow } from '$web/server/auth';
import { sdkRouter } from '$web/sdk/router';
import { createTemplate } from '$web/server/lib/createTemplate/createTemplate';

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
    {},
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
  const { projectId } = req.body;
  const { lettaAgentsId, activeOrganizationId, id } =
    await getUserWithActiveOrganizationIdOrThrow();

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

  const toolIds =
    'tools' in starterKit
      ? await createToolsInStarterKit(starterKit.tools, lettaAgentsId)
      : [];

  const agent = await sdkRouter.agents.createAgent(
    {
      body: {
        ...starterKit.agentState,
        name: starterKit.id,
        llm_config: defaultLLMConfig,
        embedding_config: defaultEmbeddingConfig,
        tool_ids: toolIds,
        project_id: projectId,
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
  const { projectId } = req.body;
  const {
    lettaAgentsId,
    activeOrganizationId,
    id: userId,
  } = await getUserWithActiveOrganizationIdOrThrow();

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

  const toolIds =
    'tools' in starterKit
      ? await createToolsInStarterKit(starterKit.tools, lettaAgentsId)
      : [];

  const template = await createTemplate({
    projectId,
    organizationId: activeOrganizationId,
    lettaAgentsId,
    userId,
    createAgentState: {
      ...starterKit.agentState,
      tool_ids: toolIds,
      llm_config: defaultLLMConfig,
      embedding_config: defaultEmbeddingConfig,
    },
  });

  return {
    status: 201,
    body: {
      templateName: template.templateName,
    },
  };
}

export const starterKitsRouter = {
  createAgentFromStarterKit,
  createTemplateFromStarterKit,
};
