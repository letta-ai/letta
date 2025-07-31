import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { AgentState } from '@letta-cloud/sdk-core';
import { AgentsService } from '@letta-cloud/sdk-core';
import {
  db,
  agentTemplates,
  simulatedAgent,
} from '@letta-cloud/service-database';
import { and, eq, desc } from 'drizzle-orm';
import { getUserWithActiveOrganizationIdOrThrow } from '$web/server/auth';
import type { contracts } from '@letta-cloud/sdk-web';
import { copyAgentById } from '@letta-cloud/utils-server';
import * as Sentry from '@sentry/nextjs';

type GetDefaultSimulatedAgentRequest = ServerInferRequest<
  typeof contracts.simulatedAgents.getDefaultSimulatedAgent
>;

type GetDefaultSimulatedAgentResponse = ServerInferResponses<
  typeof contracts.simulatedAgents.getDefaultSimulatedAgent
>;

interface CreateSimulatedAgentArgs {
  memoryVariables: Record<string, string>;
  toolVariables: Record<string, string>;
  agentTemplateId: string;
  lettaAgentsId: string;
}

async function createSimulatedAgent(args: CreateSimulatedAgentArgs) {
  const { memoryVariables, toolVariables, agentTemplateId, lettaAgentsId } =
    args;

  const newAgent = await copyAgentById(agentTemplateId, lettaAgentsId, {
    memoryVariables,
    toolVariables,
  });

  return newAgent;
}

async function getDefaultSimulatedAgent(
  req: GetDefaultSimulatedAgentRequest,
): Promise<GetDefaultSimulatedAgentResponse> {
  const { agentTemplateId } = req.params;
  const { memoryVariables, toolVariables } = req.query;
  const { activeOrganizationId, lettaAgentsId } =
    await getUserWithActiveOrganizationIdOrThrow();

  let simulatedAgentResponse = await db.query.simulatedAgent.findFirst({
    where: and(
      eq(simulatedAgent.agentTemplateId, agentTemplateId),
      eq(simulatedAgent.isDefault, true),
    ),
    columns: {
      agentId: true,
    },
    with: {
      agentTemplate: {
        columns: {
          name: true,
          id: true,
        },
      },
    },
  });

  let agent: AgentState;

  if (!simulatedAgentResponse) {
    const template = await db.query.agentTemplates.findFirst({
      where: eq(agentTemplates.id, agentTemplateId),
    });

    if (!template) {
      return {
        status: 400,
        body: {
          message: 'This templateId does not exist',
        },
      };
    }

    agent = await createSimulatedAgent({
      memoryVariables,
      toolVariables,
      agentTemplateId,
      lettaAgentsId,
    });

    if (!agent?.id || !agent?.project_id) {
      return {
        status: 500,
        body: {
          message: 'Failed to create simulated agent',
        },
      };
    }

    await db.insert(simulatedAgent).values({
      agentId: agent.id || '',
      projectId: agent.project_id,
      organizationId: activeOrganizationId,
      isDefault: true,
      agentTemplateId,
      variables: {
        memoryVariables,
        toolVariables,
      },
    });

    simulatedAgentResponse = {
      agentId: agent.id,
      agentTemplate: {
        id: template.id,
        name: template.name,
      },
    };
  } else {
    if (!simulatedAgentResponse.agentTemplate?.id) {
      return {
        status: 400,
        body: {
          message: 'This templateId does not exist',
        },
      };
    }

    // simulated agent exists
    agent = await AgentsService.retrieveAgent({
      agentId: simulatedAgentResponse.agentId,
      includeRelationships: [],
    });

    if (!agent) {
      agent = await createSimulatedAgent({
        memoryVariables,
        toolVariables,
        agentTemplateId,
        lettaAgentsId,
      });
    }
  }

  if (!agent) {
    return {
      status: 500,
      body: {
        message: 'failed to create simulated agent (SA-1)',
      },
    };
  }

  return {
    status: 200,
    body: {
      name: agent.name || '',
      id: agent.id,
      agentTemplateId: simulatedAgentResponse.agentTemplate?.id || '',
      deployedAgentTemplateId: null,
      agentTemplateFullName: `${simulatedAgentResponse.agentTemplate?.name || 'Unknown'}:current`,
      agentTemplateName: simulatedAgentResponse.agentTemplate?.name || '',
      isCorrupted: null,
    },
  };
}

type DeleteSimulatedAgentRequest = ServerInferRequest<
  typeof contracts.simulatedAgents.deleteSimulatedAgent
>;

type DeleteSimulatedAgentResponse = ServerInferResponses<
  typeof contracts.simulatedAgents.deleteSimulatedAgent
>;

async function deleteSimulatedAgent(
  req: DeleteSimulatedAgentRequest,
): Promise<DeleteSimulatedAgentResponse> {
  const { simulatedAgentId } = req.params;
  const { activeOrganizationId } =
    await getUserWithActiveOrganizationIdOrThrow();

  // Find the simulated agent to verify ownership and get agent details
  const simulatedAgentRecord = await db.query.simulatedAgent.findFirst({
    where: and(
      eq(simulatedAgent.agentId, simulatedAgentId),
      eq(simulatedAgent.organizationId, activeOrganizationId),
    ),
  });

  if (!simulatedAgentRecord) {
    return {
      status: 404,
      body: {
        message: 'Simulated agent not found',
      },
    };
  }

  try {
    // Delete the agent from Letta service
    await AgentsService.deleteAgent({
      agentId: simulatedAgentId,
    }).catch((e) => {
      Sentry.captureException(e);
      return null;
    });

    // Delete from database
    await db
      .delete(simulatedAgent)
      .where(
        and(
          eq(simulatedAgent.agentId, simulatedAgentId),
          eq(simulatedAgent.organizationId, activeOrganizationId),
        ),
      );

    return {
      status: 200,
      body: {
        success: true,
      },
    };
  } catch (error) {
    console.error('Error deleting simulated agent:', error);
    return {
      status: 500,
      body: {
        message: 'Failed to delete simulated agent',
      },
    };
  }
}

type ListSimulatedAgentsRequest = ServerInferRequest<
  typeof contracts.simulatedAgents.listSimulatedAgents
>;

type ListSimulatedAgentsResponse = ServerInferResponses<
  typeof contracts.simulatedAgents.listSimulatedAgents
>;

async function listSimulatedAgents(
  req: ListSimulatedAgentsRequest,
): Promise<ListSimulatedAgentsResponse> {
  const {
    agentTemplateId,
    deployedAgentTemplateId,
    offset = 0,
    limit = 10,
  } = req.query;
  const { activeOrganizationId } =
    await getUserWithActiveOrganizationIdOrThrow();

  // Build where conditions
  const whereConditions = [
    eq(simulatedAgent.organizationId, activeOrganizationId),
  ];

  if (agentTemplateId) {
    whereConditions.push(eq(simulatedAgent.agentTemplateId, agentTemplateId));
  }

  if (deployedAgentTemplateId) {
    whereConditions.push(
      eq(simulatedAgent.deployedAgentTemplateId, deployedAgentTemplateId),
    );
  }

  try {
    // Get simulated agents with pagination
    const results = await db.query.simulatedAgent.findMany({
      where: and(...whereConditions),
      limit: limit + 1, // Get one extra to check if there are more
      offset,
      with: {
        agentTemplate: {
          columns: {
            name: true,
            id: true,
          },
        },
        deployedAgentTemplate: {
          columns: {
            id: true,
            version: true,
          },
        },
      },
      orderBy: [desc(simulatedAgent.createdAt)],
    });

    const hasMore = results.length > limit;
    const agents = results.slice(0, limit);

    // Get agent details from Letta service for each simulated agent
    const agentDetails = await Promise.allSettled(
      agents.map(async (sa) => {
        try {
          const agent = await AgentsService.retrieveAgent({
            agentId: sa.agentId,
            includeRelationships: [],
          });
          return { simulatedAgent: sa, agent, isCorrupted: false };
        } catch (error) {
          console.warn(`Failed to get agent details for ${sa.agentId}:`, error);
          return { simulatedAgent: sa, agent: null, isCorrupted: true };
        }
      }),
    );

    const formattedAgents = agentDetails
      .filter(
        (
          result,
        ): result is PromiseFulfilledResult<{
          simulatedAgent: (typeof agents)[0];
          agent: AgentState | null;
          isCorrupted: boolean;
        }> => result.status === 'fulfilled',
      )
      .map(({ value: { simulatedAgent: sa, agent, isCorrupted } }) => {
        const deployedAgentTemplateVersion = sa.deployedAgentTemplate?.version;
        const agentTemplateFullName = deployedAgentTemplateVersion
          ? `${sa.agentTemplate.name}:${deployedAgentTemplateVersion}`
          : `${sa.agentTemplate.name}:current`;

        return {
          name: agent?.name || sa.agentTemplate.name || 'Unknown Agent',
          id: sa.agentId,
          agentTemplateId: sa.agentTemplateId,
          deployedAgentTemplateId: sa.deployedAgentTemplateId,
          agentTemplateFullName,
          agentTemplateName: sa.agentTemplate.name,
          isCorrupted,
        };
      });

    return {
      status: 200,
      body: {
        agents: formattedAgents,
        hasMore,
      },
    };
  } catch (error) {
    console.error('Error listing simulated agents:', error);
    return {
      status: 500,
      body: {
        message: 'Failed to list simulated agents',
      },
    };
  }
}

export const simulatedAgentsRouter = {
  getDefaultSimulatedAgent,
  deleteSimulatedAgent,
  listSimulatedAgents,
};
