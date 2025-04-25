import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import { AgentsService } from '@letta-cloud/sdk-core';
import type { SDKContext } from '../../../types';
import {
  agentTemplates,
  db,
  deployedAgentTemplates,
  deployedAgentVariables,
} from '@letta-cloud/service-database';
import { eq } from 'drizzle-orm';
import * as Sentry from '@sentry/node';
import { findUniqueAgentTemplateName } from '@letta-cloud/utils-server';
import { migrateAgent } from '../migrateAgent/migrateAgent';
import { copyAgentById } from '@letta-cloud/utils-server';
import { findMemoryBlockVariables } from '@letta-cloud/utils-shared';
import type { cloudContracts } from '@letta-cloud/sdk-cloud-api';
import { environment } from '@letta-cloud/config-environment-variables';
import { startMigrateAgents } from '@letta-cloud/lettuce-client';
import { getSingleFlag } from '@letta-cloud/service-feature-flags';
import { getContextDataHack } from '../../../getContextDataHack/getContextDataHack';

type DeployAgentTemplateRequest = ServerInferRequest<
  typeof cloudContracts.agents.versionAgentTemplate
>;

type DeployAgentTemplateResponse = ServerInferResponses<
  typeof cloudContracts.agents.versionAgentTemplate
>;

export async function versionAgentTemplate(
  req: DeployAgentTemplateRequest,
  context: SDKContext,
): Promise<DeployAgentTemplateResponse> {
  const { agent_id: agentId } = req.params;
  const { returnAgentState } = req.query;
  const { migrate_deployed_agents, message } = req.body;

  const { organizationId, userId, source, lettaAgentsUserId } =
    getContextDataHack(req, context);
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
    const copiedAgent = await copyAgentById(agentId, lettaAgentsUserId);

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
      organizationId,
      projectId,
    });

    agentTemplateId = copiedAgent.id;
  }

  const version = `${existingDeployedAgentTemplateCount.length + 1}`;

  const createdAgent = await copyAgentById(agentId, lettaAgentsUserId);

  const deployedAgentTemplateId = createdAgent?.id;

  if (!deployedAgentTemplateId) {
    return {
      status: 500,
      body: {
        message: 'Failed to version agent template',
      },
    };
  }

  const memoryVariables = findMemoryBlockVariables(createdAgent);

  await db.insert(deployedAgentTemplates).values({
    id: deployedAgentTemplateId,
    projectId,
    message,
    memoryVariables: {
      version: '1',
      data: memoryVariables.map((variable) => ({
        key: variable,
        type: 'string',
        label: variable,
      })),
    },
    organizationId: organizationId,
    agentTemplateId,
    version,
  });

  const nextVersion = `${agentTemplateName}:${version}`;

  if (migrate_deployed_agents) {
    if (!agentTemplate?.id) {
      return {
        status: 400,
        body: {
          message: 'Cannot migrate deployed agents from a deployed agent',
        },
      };
    }

    const shouldUseTemporal = await getSingleFlag(
      'USE_TEMPORAL_FOR_MIGRATIONS',
      organizationId,
    );

    if (environment.TEMPORAL_LETTUCE_API_HOST && shouldUseTemporal) {
      await startMigrateAgents({
        template: nextVersion,
        preserveCoreMemories: false,
        coreUserId: lettaAgentsUserId,
        organizationId: organizationId,
      });
    } else {
      const deployedAgentsList = await AgentsService.listAgents(
        {
          baseTemplateId: agentTemplate.id,
        },
        {
          user_id: lettaAgentsUserId,
        },
      );

      void Promise.all(
        deployedAgentsList.map(async (deployedAgent) => {
          const deployedAgentVariablesItem =
            await db.query.deployedAgentVariables.findFirst({
              where: eq(
                deployedAgentVariables.deployedAgentId,
                deployedAgent.id,
              ),
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
            {
              request: {
                userId,
                source,
                lettaAgentsUserId,
                organizationId,
              },
            },
          );
        }),
      );
    }
  }

  return {
    status: 201,
    body: {
      version,
      fullVersion: nextVersion,
      id: deployedAgentTemplateId,
      ...(returnAgentState ? { state: createdAgent } : {}),
    },
  };
}
