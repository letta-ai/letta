import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { cloudContracts } from '@letta-cloud/sdk-cloud-api';
import type { SDKContext } from '../../../types';
import {
  getTemplateByName,
} from '@letta-cloud/utils-server';
import { environment } from '@letta-cloud/config-environment-variables';
import { startMigrateSingleAgent } from '@letta-cloud/lettuce-client';
import { getContextDataHack } from '../../../getContextDataHack/getContextDataHack';
import { validateVersionString } from '@letta-cloud/utils-shared';

type MigrateAgentRequest = ServerInferRequest<
  typeof cloudContracts.agents.migrateAgent
>;

type MigrateAgentResponse = ServerInferResponses<
  typeof cloudContracts.agents.migrateAgent
>;

export async function migrateAgent(
  req: MigrateAgentRequest,
  context: SDKContext,
): Promise<MigrateAgentResponse> {
  const { to_template, preserve_core_memories, preserve_tool_variables } =
    req.body;
  const { agent_id: agentIdToMigrate } = req.params;

  const { organizationId, lettaAgentsUserId } = getContextDataHack(
    req,
    context,
  );

  if (validateVersionString(to_template) === false) {
    return {
      status: 400,
      body: {
        message: `Invalid version string: ${to_template}. Please use a valid version format project_slug/template_name:version.`,
      },
    };
  }

  const template = await getTemplateByName({
    versionString: to_template,
    lettaAgentsId: lettaAgentsUserId,
    organizationId,
    includeAgents: true,
    includeBlocks: false,
  });

  if (!template) {
    return {
      status: 404,
      body: {
        message: 'Template version provided does not exist',
      },
    };
  }

  if (template.type !== 'classic') {
    return {
      status: 404,
      body: {
        message:
          'This route currently only works with "classic" agent templates.',
      },
    };
  }

  if (environment.TEMPORAL_LETTUCE_API_HOST) {
    await startMigrateSingleAgent({
      agentId: agentIdToMigrate,
      versionString: to_template,
      preserveCoreMemories: preserve_core_memories,
      preserveToolVariables: preserve_tool_variables,
      lettaAgentsId: lettaAgentsUserId,
      organizationId: organizationId,
    });
  } else {
    return {
      status: 500,
      body: {
        message: 'Migration failed due to missing Temporal Lettuce API host configuration.'
      },
    };
  }

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}
