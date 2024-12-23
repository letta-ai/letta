import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { sdkContracts } from '$web/sdk/contracts';
import type { SDKContext } from '$web/sdk/shared';
import {
  agentTemplates,
  db,
  deployedAgents,
  deployedAgentTemplates,
  deployedAgentVariables,
} from '@letta-web/database';
import { eq } from 'drizzle-orm';
import * as Sentry from '@sentry/node';
import { findUniqueAgentTemplateName } from '$web/server';
import { copyAgentById, updateAgentFromAgentId } from '$web/sdk';

type DeployAgentTemplateRequest = ServerInferRequest<
  typeof sdkContracts.agents.versionAgentTemplate
>;

type DeployAgentTemplateResponse = ServerInferResponses<
  typeof sdkContracts.agents.versionAgentTemplate
>;

export async function versionAgentTemplate(
  req: DeployAgentTemplateRequest,
  context: SDKContext
): Promise<DeployAgentTemplateResponse> {
  const { agent_id: agentId } = req.params;
  const { returnAgentState } = req.query;
  const { migrate_deployed_agents } = req.body;

  const existingDeployedAgentTemplateCount =
    await db.query.deployedAgentTemplates.findMany({
      where: eq(deployedAgentTemplates.agentTemplateId, agentId),
      columns: {
        id: true,
      },
    });

  const [agentTemplate, deployedAgent] = await Promise.all([
    db.query.agentTemplates.findFirst({
      where: eq(agentTemplates.id, agentId),
    }),
    db.query.deployedAgentTemplates.findFirst({
      where: eq(deployedAgentTemplates.id, agentId),
    }),
  ]);

  if (!agentTemplate && !deployedAgent) {
    return {
      status: 404,
      body: {
        message: 'Agent not found',
      },
    };
  }

  const projectId = agentTemplate?.projectId || deployedAgent?.projectId || '';

  if (!projectId) {
    Sentry.captureMessage('Project not found for agent template');

    return {
      status: 500,
      body: {
        message: 'Failed to version agent template',
      },
    };
  }

  let agentTemplateId = agentTemplate?.id;
  let agentTemplateName = agentTemplate?.name;

  // if agent is a deployed agent, create a new agent template
  if (!agentTemplateId) {
    const copiedAgent = await copyAgentById(
      agentId,
      context.request.lettaAgentsUserId
    );

    if (!copiedAgent?.id) {
      return {
        status: 500,
        body: {
          message: 'Failed to version agent template',
        },
      };
    }

    const name = await findUniqueAgentTemplateName();

    agentTemplateName = name;

    await db.insert(agentTemplates).values({
      id: copiedAgent.id,
      name,
      organizationId: context.request.organizationId,
      projectId,
    });

    agentTemplateId = copiedAgent.id;
  }

  const version = `${existingDeployedAgentTemplateCount.length + 1}`;

  const createdAgent = await copyAgentById(
    agentId,
    context.request.lettaAgentsUserId
  );

  const deployedAgentTemplateId = createdAgent?.id;

  if (!deployedAgentTemplateId) {
    return {
      status: 500,
      body: {
        message: 'Failed to version agent template',
      },
    };
  }

  await db.insert(deployedAgentTemplates).values({
    id: deployedAgentTemplateId,
    projectId,
    organizationId: context.request.organizationId,
    agentTemplateId,
    version,
  });

  if (migrate_deployed_agents) {
    if (!agentTemplate?.id) {
      return {
        status: 400,
        body: {
          message: 'Cannot migrate deployed agents from a deployed agent',
        },
      };
    }

    const deployedAgentsList = await db.query.deployedAgents.findMany({
      where: eq(deployedAgents.rootAgentTemplateId, agentTemplate.id),
    });

    void Promise.all(
      deployedAgentsList.map(async (deployedAgent) => {
        const deployedAgentVariablesItem =
          await db.query.deployedAgentVariables.findFirst({
            where: eq(deployedAgentVariables.deployedAgentId, deployedAgent.id),
          });

        await updateAgentFromAgentId({
          variables: deployedAgentVariablesItem?.value || {},
          baseAgentId: deployedAgentTemplateId,
          agentToUpdateId: deployedAgent.id,
          lettaAgentsUserId: context.request.lettaAgentsUserId,
          preserveCoreMemories: false,
        });
      })
    );
  }

  return {
    status: 201,
    body: {
      version,
      fullVersion: `${agentTemplateName}:${version}`,
      id: deployedAgentTemplateId,
      ...(returnAgentState ? { state: createdAgent } : {}),
    },
  };
}
