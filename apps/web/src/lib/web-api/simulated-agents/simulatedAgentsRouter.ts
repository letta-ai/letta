import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { AgentState } from '@letta-cloud/sdk-core';
import { AgentsService } from '@letta-cloud/sdk-core';
import {
  db,
  agentTemplates,
  simulatedAgent,
  deployedAgentTemplates,
} from '@letta-cloud/service-database';
import { and, eq, desc, isNull } from 'drizzle-orm';
import { getUserWithActiveOrganizationIdOrThrow } from '$web/server/auth';
import type { contracts } from '@letta-cloud/sdk-web';
import {
  createSimulatedAgent as createSimulatedAgentUtil,
  copyAgentById,
  updateAgentFromAgentId,
  recordMemoryVariablesToMemoryVariablesV1,
} from '@letta-cloud/utils-server';
import * as Sentry from '@sentry/nextjs';
import { MemoryVariableVersionOne } from '@letta-cloud/types';

type GetDefaultSimulatedAgentRequest = ServerInferRequest<
  typeof contracts.simulatedAgents.getDefaultSimulatedAgent
>;

type GetDefaultSimulatedAgentResponse = ServerInferResponses<
  typeof contracts.simulatedAgents.getDefaultSimulatedAgent
>;

async function getDefaultSimulatedAgent(
  req: GetDefaultSimulatedAgentRequest,
): Promise<GetDefaultSimulatedAgentResponse> {
  const { agentTemplateId } = req.params;
  const { activeOrganizationId, lettaAgentsId } =
    await getUserWithActiveOrganizationIdOrThrow();

  const simulatedAgentResponse = await db.query.simulatedAgent.findFirst({
    where: and(
      eq(simulatedAgent.agentTemplateId, agentTemplateId),
      eq(simulatedAgent.isDefault, true),
      eq(simulatedAgent.organizationId, activeOrganizationId),
    ),
    columns: {
      id: true,
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

  if (!simulatedAgentResponse) {
    return {
      status: 404,
      body: {
        message: 'Default simulated agent not found',
      },
    };
  }

  if (!simulatedAgentResponse.agentTemplate?.id) {
    return {
      status: 404,
      body: {
        message: 'Agent template not found',
      },
    };
  }

  // Get agent details from Letta service
  let agent: AgentState | null = null;
  let isCorrupted = false;

  try {
    agent = await AgentsService.retrieveAgent(
      {
        agentId: simulatedAgentResponse.agentId,
        includeRelationships: [],
      },
      {
        user_id: lettaAgentsId,
      },
    );
  } catch (error) {
    console.warn(
      `Failed to get agent details for ${simulatedAgentResponse.agentId}:`,
      error,
    );
    isCorrupted = true;
  }

  return {
    status: 200,
    body: {
      name:
        agent?.name ||
        simulatedAgentResponse.agentTemplate.name ||
        'Unknown Agent',
      id: simulatedAgentResponse.id,
      agentId: simulatedAgentResponse.agentId,
      agentTemplateId: simulatedAgentResponse.agentTemplate.id,
      deployedAgentTemplateId: null,
      agentTemplateFullName: `${simulatedAgentResponse.agentTemplate.name || 'Unknown'}:current`,
      agentTemplateName: simulatedAgentResponse.agentTemplate.name || '',
      isCorrupted,
    },
  };
}

type CreateSimulatedAgentRequest = ServerInferRequest<
  typeof contracts.simulatedAgents.createSimulatedAgent
>;

type CreateSimulatedAgentResponse = ServerInferResponses<
  typeof contracts.simulatedAgents.createSimulatedAgent
>;

async function createSimulatedAgent(
  req: CreateSimulatedAgentRequest,
): Promise<CreateSimulatedAgentResponse> {
  const {
    agentTemplateId,
    deployedAgentTemplateId = null,
    memoryVariables = {},
  } = req.body;
  const { activeOrganizationId, lettaAgentsId } =
    await getUserWithActiveOrganizationIdOrThrow();

  // Check if simulated agent already exists for this combination
  const whereConditions = [
    eq(simulatedAgent.agentTemplateId, agentTemplateId),
    eq(simulatedAgent.organizationId, activeOrganizationId),
  ];

  if (deployedAgentTemplateId) {
    whereConditions.push(
      eq(simulatedAgent.deployedAgentTemplateId, deployedAgentTemplateId),
    );
  } else {
    whereConditions.push(isNull(simulatedAgent.deployedAgentTemplateId));
  }

  const existingAgent = await db.query.simulatedAgent.findFirst({
    where: and(...whereConditions),
  });

  if (existingAgent) {
    // Get agent details from Letta service for existing agent
    let agent: AgentState | null = null;
    let isCorrupted = false;

    try {
      agent = await AgentsService.retrieveAgent({
        agentId: existingAgent.agentId,
        includeRelationships: [],
      });
    } catch (error) {
      console.warn(
        `Failed to get agent details for ${existingAgent.agentId}:`,
        error,
      );
      isCorrupted = true;
    }

    // Get deployed template version if needed
    let deployedTemplate = null;
    if (existingAgent.deployedAgentTemplateId) {
      deployedTemplate = await db.query.deployedAgentTemplates.findFirst({
        where: eq(
          deployedAgentTemplates.id,
          existingAgent.deployedAgentTemplateId,
        ),
        columns: {
          version: true,
        },
      });
    }

    // Get agent template for the response
    const template = await db.query.agentTemplates.findFirst({
      where: eq(agentTemplates.id, existingAgent.agentTemplateId),
      columns: {
        name: true,
        id: true,
      },
    });

    if (!template) {
      return {
        status: 400,
        body: {
          message: 'Agent template does not exist',
        },
      };
    }

    return {
      status: 200,
      body: {
        name: agent?.name || template.name || 'Unknown Agent',
        id: existingAgent.agentId,
        agentId: existingAgent.agentId,
        agentTemplateId: existingAgent.agentTemplateId,
        deployedAgentTemplateId: existingAgent.deployedAgentTemplateId,
        agentTemplateFullName: deployedTemplate
          ? `${template.name}:${deployedTemplate.version}`
          : `${template.name}:current`,
        agentTemplateName: template.name,
        isCorrupted,
      },
    };
  }

  // Check if agent template exists
  const template = await db.query.agentTemplates.findFirst({
    where: eq(agentTemplates.id, agentTemplateId),
  });

  if (!template) {
    return {
      status: 400,
      body: {
        message: 'Agent template does not exist',
      },
    };
  }

  // If deployedAgentTemplateId is provided, check if it exists and get version
  let deployedTemplate = null;
  if (deployedAgentTemplateId) {
    deployedTemplate = await db.query.deployedAgentTemplates.findFirst({
      where: eq(deployedAgentTemplates.id, deployedAgentTemplateId),
      columns: {
        version: true,
      },
    });

    if (!deployedTemplate) {
      return {
        status: 400,
        body: {
          message: 'Deployed agent template does not exist',
        },
      };
    }
  }

  // Create the simulated agent
  let agent;
  try {
    const result = await createSimulatedAgentUtil({
      memoryVariables,
      projectId: template.projectId,
      agentTemplateId,
      deployedAgentTemplateId,
      organizationId: activeOrganizationId,
      lettaAgentsId,
      isDefault: deployedAgentTemplateId === null, // Only set as default if no specific deployed template
    });
    agent = result.agent;
  } catch (_error) {
    return {
      status: 500,
      body: {
        message: 'Failed to create simulated agent',
      },
    };
  }

  return {
    status: 201,
    body: {
      name: agent.name || '',
      id: agent.id,
      agentId: agent.id,
      agentTemplateId: template.id,
      deployedAgentTemplateId,
      agentTemplateFullName: deployedTemplate
        ? `${template.name}:${deployedTemplate.version}`
        : `${template.name}:current`,
      agentTemplateName: template.name,
      isCorrupted: null,
    },
  };
}

type FlushSimulatedAgentRequest = ServerInferRequest<
  typeof contracts.simulatedAgents.flushSimulatedAgent
>;

type FlushSimulatedAgentResponse = ServerInferResponses<
  typeof contracts.simulatedAgents.flushSimulatedAgent
>;

async function flushSimulatedAgent(
  req: FlushSimulatedAgentRequest,
): Promise<FlushSimulatedAgentResponse> {
  const { simulatedAgentId } = req.params;
  const { activeOrganizationId, lettaAgentsId } =
    await getUserWithActiveOrganizationIdOrThrow();

  // Find the simulated agent to verify ownership and get agent details
  const simulatedAgentRecord = await db.query.simulatedAgent.findFirst({
    where: and(
      eq(simulatedAgent.id, simulatedAgentId),
      eq(simulatedAgent.organizationId, activeOrganizationId),
    ),
    columns: {
      agentId: true,
      projectId: true,
      organizationId: true,
      isDefault: true,
      agentTemplateId: true,
      deployedAgentTemplateId: true,
      memoryVariables: true,
    },
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
    // Delete the existing agent from Letta service
    void AgentsService.deleteAgent({
      agentId: simulatedAgentId,
    }).catch((e) => {
      Sentry.captureException(e);
      // Continue even if delete fails - we'll create a new one
    });

    // Create a new agent directly using copyAgentById
    const agent = await copyAgentById(
      simulatedAgentRecord.agentTemplateId,
      lettaAgentsId,
      {
        projectId: simulatedAgentRecord.projectId,
        memoryVariables: memoryVariablesV1ToRecordVariables(
          simulatedAgentRecord.memoryVariables,
        ),
        hidden: true,
      },
    );

    if (!agent?.id || !agent?.project_id) {
      throw new Error('Failed to create new agent');
    }
    // Insert new record with the new agent ID
    await db
      .update(simulatedAgent)
      .set({
        agentId: agent.id,
      })
      .where(eq(simulatedAgent.id, simulatedAgentId));

    const deployedTemplate = simulatedAgentRecord.deployedAgentTemplate;
    const agentTemplate = simulatedAgentRecord.agentTemplate;

    return {
      status: 200,
      body: {
        name: agent.name || agentTemplate.name || 'Unknown Agent',
        id: simulatedAgentId,
        agentId: agent.id,
        agentTemplateId: simulatedAgentRecord.agentTemplateId,
        deployedAgentTemplateId: simulatedAgentRecord.deployedAgentTemplateId,
        agentTemplateFullName: deployedTemplate
          ? `${agentTemplate.name}:${deployedTemplate.version}`
          : `${agentTemplate.name}:current`,
        agentTemplateName: agentTemplate.name,
        isCorrupted: null,
      },
    };
  } catch (error) {
    console.error('Error flushing simulated agent:', error);
    return {
      status: 500,
      body: {
        message: 'Failed to flush simulated agent',
      },
    };
  }
}

function memoryVariablesV1ToRecordVariables(
  memoryVariables: unknown,
): Record<string, string> {
  const out = MemoryVariableVersionOne.safeParse(memoryVariables);

  if (!out.success) {
    return {};
  }

  return out.data.data.reduce(
    (v, c) => ({
      ...v,
      [c.key]: c.label,
    }),
    {} as Record<string, string>,
  );
}

type RefreshSimulatedSessionRequest = ServerInferRequest<
  typeof contracts.simulatedAgents.refreshSimulatedSession
>;

type RefreshSimulatedSessionResponse = ServerInferResponses<
  typeof contracts.simulatedAgents.refreshSimulatedSession
>;

async function refreshSimulatedSession(
  req: RefreshSimulatedSessionRequest,
): Promise<RefreshSimulatedSessionResponse> {
  const { simulatedAgentId } = req.params;
  const { activeOrganizationId, lettaAgentsId } =
    await getUserWithActiveOrganizationIdOrThrow();

  // Find the simulated agent to verify ownership and get agent details
  const simulatedAgentRecord = await db.query.simulatedAgent.findFirst({
    where: and(
      eq(simulatedAgent.id, simulatedAgentId),
      eq(simulatedAgent.organizationId, activeOrganizationId),
    ),
    columns: {
      agentId: true,
      projectId: true,
      organizationId: true,
      isDefault: true,
      agentTemplateId: true,
      deployedAgentTemplateId: true,
      memoryVariables: true,
    },
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
    // Update the agent to match the current template state
    const updatedAgent = await updateAgentFromAgentId({
      agentToUpdateId: simulatedAgentRecord.agentId,
      baseAgentId: simulatedAgentRecord.agentTemplateId,
      lettaAgentsUserId: lettaAgentsId,
      memoryVariables: memoryVariablesV1ToRecordVariables(
        simulatedAgentRecord.memoryVariables,
      ),
    });

    if (!updatedAgent) {
      throw new Error('Failed to update agent from template');
    }

    // Update only the updatedAt timestamp since we're using existing variables
    await db
      .update(simulatedAgent)
      .set({
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(simulatedAgent.agentId, simulatedAgentId),
          eq(simulatedAgent.organizationId, activeOrganizationId),
        ),
      );

    const deployedTemplate = simulatedAgentRecord.deployedAgentTemplate;
    const agentTemplate = simulatedAgentRecord.agentTemplate;

    return {
      status: 200,
      body: {
        name: updatedAgent.name || agentTemplate.name || 'Unknown Agent',
        id: updatedAgent.id,
        agentId: updatedAgent.id,
        agentTemplateId: simulatedAgentRecord.agentTemplateId,
        deployedAgentTemplateId: simulatedAgentRecord.deployedAgentTemplateId,
        agentTemplateFullName: deployedTemplate
          ? `${agentTemplate.name}:${deployedTemplate.version}`
          : `${agentTemplate.name}:current`,
        agentTemplateName: agentTemplate.name,
        isCorrupted: null,
      },
    };
  } catch (error) {
    console.error('Error refreshing simulated session:', error);
    return {
      status: 500,
      body: {
        message: 'Failed to refresh simulated session',
      },
    };
  }
}

type GetSimulatedAgentVariablesRequest = ServerInferRequest<
  typeof contracts.simulatedAgents.getSimulatedAgentVariables
>;

type GetSimulatedAgentVariablesResponse = ServerInferResponses<
  typeof contracts.simulatedAgents.getSimulatedAgentVariables
>;

async function getSimulatedAgentVariables(
  req: GetSimulatedAgentVariablesRequest,
): Promise<GetSimulatedAgentVariablesResponse> {
  const { simulatedAgentId } = req.params;
  const { activeOrganizationId } =
    await getUserWithActiveOrganizationIdOrThrow();

  // Find the simulated agent to verify ownership and get variables
  const simulatedAgentRecord = await db.query.simulatedAgent.findFirst({
    where: and(
      eq(simulatedAgent.id, simulatedAgentId),
      eq(simulatedAgent.organizationId, activeOrganizationId),
    ),
    columns: {
      memoryVariables: true,
    },
  });

  if (!simulatedAgentRecord) {
    return {
      status: 404,
      body: {
        message: 'Simulated agent not found',
      },
    };
  }

  return {
    status: 200,
    body: {
      memoryVariables: memoryVariablesV1ToRecordVariables(
        simulatedAgentRecord.memoryVariables,
      ),
    },
  };
}

type UpdateSimulatedAgentVariablesRequest = ServerInferRequest<
  typeof contracts.simulatedAgents.updateSimulatedAgentVariables
>;

type UpdateSimulatedAgentVariablesResponse = ServerInferResponses<
  typeof contracts.simulatedAgents.updateSimulatedAgentVariables
>;

async function updateSimulatedAgentVariables(
  req: UpdateSimulatedAgentVariablesRequest,
): Promise<UpdateSimulatedAgentVariablesResponse> {
  const { simulatedAgentId } = req.params;
  const { memoryVariables = {} } = req.body;
  const { activeOrganizationId } =
    await getUserWithActiveOrganizationIdOrThrow();

  // Find the simulated agent to verify ownership
  const simulatedAgentRecord = await db.query.simulatedAgent.findFirst({
    where: and(
      eq(simulatedAgent.id, simulatedAgentId),
      eq(simulatedAgent.organizationId, activeOrganizationId),
    ),
    columns: {
      memoryVariables: true,
    },
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
    // Update the database record with new variables
    await db
      .update(simulatedAgent)
      .set({
        memoryVariables:
          recordMemoryVariablesToMemoryVariablesV1(memoryVariables),
      })
      .where(
        and(
          eq(simulatedAgent.id, simulatedAgentId),
          eq(simulatedAgent.organizationId, activeOrganizationId),
        ),
      );

    return {
      status: 200,
      body: {
        memoryVariables,
      },
    };
  } catch (error) {
    console.error('Error updating simulated agent variables:', error);
    return {
      status: 500,
      body: {
        message: 'Failed to update simulated agent variables',
      },
    };
  }
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
  const { activeOrganizationId, lettaAgentsId } =
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
          const agent = await AgentsService.retrieveAgent(
            {
              agentId: sa.agentId,
              includeRelationships: [],
            },
            {
              user_id: lettaAgentsId,
            },
          );
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
          agentId: sa.agentId,
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
  } catch (_e) {
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
  createSimulatedAgent,
  deleteSimulatedAgent,
  flushSimulatedAgent,
  refreshSimulatedSession,
  getSimulatedAgentVariables,
  updateSimulatedAgentVariables,
  listSimulatedAgents,
};
