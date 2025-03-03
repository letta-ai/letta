import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { sdkContracts } from '@letta-cloud/sdk-core';
import type { SDKContext } from '$web/sdk/shared';
import { db, deployedAgentVariables } from '@letta-cloud/service-database';
import { eq } from 'drizzle-orm';
import { getDeployedTemplateByVersion } from '@letta-cloud/utils-server';
import { updateAgentFromAgentId } from '$web/server/lib/updateAgentFromAgentId/updateAgentFromAgentId';

type MigrateAgentRequest = ServerInferRequest<
  typeof sdkContracts.agents.migrateAgent
>;

type MigrateAgentResponse = ServerInferResponses<
  typeof sdkContracts.agents.migrateAgent
>;

export async function migrateAgent(
  req: MigrateAgentRequest,
  context: SDKContext,
): Promise<MigrateAgentResponse> {
  const { to_template, preserve_core_memories } = req.body;
  let { variables } = req.body;
  const { agent_id: agentIdToMigrate } = req.params;
  const { lettaAgentsUserId } = context.request;

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
    context.request.organizationId,
  );

  if (!deployedAgentTemplate) {
    return {
      status: 404,
      body: {
        message: 'Template version provided does not exist',
      },
    };
  }

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
    baseTemplateId: deployedAgentTemplate.agentTemplateId,
    templateId: deployedAgentTemplate.id,
  });

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}
