import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { cloudContracts } from '@letta-cloud/sdk-cloud-api';
import type { SDKContext } from '../../../types';
import { db, deployedAgentVariables } from '@letta-cloud/service-database';
import { eq } from 'drizzle-orm';
import { getDeployedTemplateByVersion } from '@letta-cloud/utils-server';
import { updateAgentFromAgentId } from '@letta-cloud/utils-server';
import { environment } from '@letta-cloud/config-environment-variables';
import { startMigrateAgents } from '@letta-cloud/lettuce-client';
import { getSingleFlag } from '@letta-cloud/service-feature-flags';
import { getContextDataHack } from '../../../getContextDataHack/getContextDataHack';

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
  let { variables } = req.body;
  const { agent_id: agentIdToMigrate } = req.params;

  const { organizationId, lettaAgentsUserId } = getContextDataHack(
    req,
    context,
  );

  const split = to_template.split(':');
  const templateName = split[0];
  const version = split[1];

  if (!version) {
    return {
      status: 400,
      body: {
        message: `Please specify a version or add \`latest\` to the template name. Example: ${templateName}:latest`,
      },
    };
  }

  const deployedAgentTemplate = await getDeployedTemplateByVersion(
    to_template,
    organizationId,
  );

  if (!deployedAgentTemplate) {
    return {
      status: 404,
      body: {
        message: 'Template version provided does not exist',
      },
    };
  }

  if (environment.TEMPORAL_LETTUCE_API_HOST) {
    await startMigrateAgents({
      agentIds: [agentIdToMigrate],
      template: to_template,
      memoryVariables: variables,
      preserveCoreMemories: preserve_core_memories,
      preserveToolVariables: preserve_tool_variables,
      coreUserId: lettaAgentsUserId,
      organizationId: organizationId,
    });
  } else {
    if (!variables) {
      const deployedAgentVariablesItem =
        await db.query.deployedAgentVariables.findFirst({
          where: eq(deployedAgentVariables.deployedAgentId, agentIdToMigrate),
        });

      variables = deployedAgentVariablesItem?.value || {};
    }

    if (!deployedAgentTemplate?.id) {
      return {
        status: 404,
        body: {
          message: 'Template version provided does not exist',
        },
      };
    }

    await updateAgentFromAgentId({
      memoryVariables: variables || {},
      baseAgentId: deployedAgentTemplate.id,
      agentToUpdateId: agentIdToMigrate,
      lettaAgentsUserId,
      preserveCoreMemories: preserve_core_memories,
      preserveToolVariables: preserve_tool_variables,
      baseTemplateId: deployedAgentTemplate.agentTemplateId,
      templateId: deployedAgentTemplate.id,
    });
  }

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}
