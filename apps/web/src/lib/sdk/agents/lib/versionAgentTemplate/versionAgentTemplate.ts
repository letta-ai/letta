import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import { AgentsService } from '@letta-cloud/letta-agents-api';
import type { sdkContracts } from '@letta-cloud/letta-agents-api';
import type { SDKContext } from '$web/sdk/shared';
import {
  agentTemplates,
  db,
  deployedAgentTemplates,
  deployedAgentVariables,
} from '@letta-cloud/database';
import { eq } from 'drizzle-orm';
import * as Sentry from '@sentry/node';
import { findUniqueAgentTemplateName } from '$web/server';
import { migrateAgent } from '../migrateAgent/migrateAgent';
import { copyAgentById } from '$web/server/lib/copyAgentById/copyAgentById';

type DeployAgentTemplateRequest = ServerInferRequest<
  typeof sdkContracts.agents.versionAgentTemplate
>;

type DeployAgentTemplateResponse = ServerInferResponses<
  typeof sdkContracts.agents.versionAgentTemplate
>;

export async function versionAgentTemplate(
  req: DeployAgentTemplateRequest,
  context: SDKContext,
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
      context.request.lettaAgentsUserId,
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
    context.request.lettaAgentsUserId,
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

    const deployedAgentsList = await AgentsService.listAgents(
      {
        baseTemplateId: agentTemplate.id,
      },
      {
        user_id: context.request.lettaAgentsUserId,
      },
    );

    void Promise.all(
      deployedAgentsList.map(async (deployedAgent) => {
        const deployedAgentVariablesItem =
          await db.query.deployedAgentVariables.findFirst({
            where: eq(deployedAgentVariables.deployedAgentId, deployedAgent.id),
          });

        return migrateAgent(
          {
            body: {
              to_template: `${agentTemplateName}:${version}`,
              variables: deployedAgentVariablesItem?.value || {},
              preserve_core_memories: false,
            },
            params: {
              agent_id: deployedAgent.id,
            },
          },
          context,
        );
      }),
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
