import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { AgentState } from '@letta-cloud/sdk-core';
import { AgentsService } from '@letta-cloud/sdk-core';
import {
  db,
  simulatedAgent,
  simulatedAgentDeprecated,
  agentTemplateV2,
} from '@letta-cloud/service-database';
import { and, eq, desc } from 'drizzle-orm';
import { getUserWithActiveOrganizationIdOrThrow } from '$web/server/auth';
import type { contracts } from '@letta-cloud/sdk-web';
import {
  createSimulatedAgent as createSimulatedAgentUtil,
  updateAgentFromAgentTemplateId,
  createEntitiesFromTemplate,
} from '@letta-cloud/utils-server';
import * as Sentry from '@sentry/nextjs';
import { syncAgentTemplateWithState } from './sync/syncAgentTemplateWithState';
import {
  convertMemoryVariablesV1ToRecordMemoryVariables,
  convertRecordMemoryVariablesToMemoryVariablesV1,
} from '@letta-cloud/utils-shared';

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

  let simulatedAgentResponse = await db.query.simulatedAgent.findFirst({
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
          lettaTemplateId: true,
          name: true,
          id: true,
        },
      },
    },
  });

  if (!simulatedAgentResponse) {
    // If no default agent found, create one
    const agentTemplate = await db.query.agentTemplateV2.findFirst({
      where: eq(agentTemplateV2.id, agentTemplateId),
      columns: {
        name: true,
        id: true,
        projectId: true,
        lettaTemplateId: true,
      },
    });

    if (!agentTemplate) {
      return {
        status: 404,
        body: {
          message: 'Agent template not found',
        },
      };
    }

    try {
      // first see if simulated agent v1 exists
      const existingSimulatedAgent =
        await db.query.simulatedAgentDeprecated.findFirst({
          where: and(
            eq(simulatedAgentDeprecated.agentTemplateId, agentTemplate.id),
            eq(simulatedAgentDeprecated.organizationId, activeOrganizationId),
            eq(simulatedAgentDeprecated.isDefault, true),
          ),
        });

      // if it exists, make the new simulated agent from it
      if (existingSimulatedAgent) {
        // Save to database
        const [res] = await db
          .insert(simulatedAgent)
          .values({
            agentId: existingSimulatedAgent.agentId,
            projectId: agentTemplate.projectId,
            organizationId: activeOrganizationId,
            isDefault: true,
            agentTemplateId,
            memoryVariables: convertRecordMemoryVariablesToMemoryVariablesV1(
              {},
            ),
          })
          .returning();

        simulatedAgentResponse = {
          id: res.id,
          agentId: res.agentId,
          agentTemplate: {
            id: agentTemplate.id,
            name: agentTemplate.name,
            lettaTemplateId: agentTemplate.lettaTemplateId,
          },
        };
      } else {
        const response = await createSimulatedAgentUtil({
          projectId: agentTemplate.projectId,
          lettaTemplateId: agentTemplate.lettaTemplateId,
          agentTemplateId: agentTemplate.id,
          organizationId: activeOrganizationId,
          lettaAgentsId,
          memoryVariables: {},
          isDefault: true,
        });

        if (!response.simulatedAgentRecord) {
          const record = await db.query.simulatedAgent.findFirst({
            where: and(
              eq(simulatedAgent.agentTemplateId, agentTemplateId),
              eq(simulatedAgent.isDefault, true),
              eq(simulatedAgent.organizationId, activeOrganizationId),
            ),
          });

          if (record) {
            response.simulatedAgentRecord = record;
          }

          if (!response.simulatedAgentRecord) {
            return {
              status: 500,
              body: {
                message: 'Failed to create default simulated agent',
              },
            };
          }
        }

        simulatedAgentResponse = {
          id: response.simulatedAgentRecord.id,
          agentId: response.agent.id,
          agentTemplate: {
            id: agentTemplate.id,
            name: agentTemplate.name,
            lettaTemplateId: agentTemplate.lettaTemplateId,
          },
        };
      }
    } catch (error) {
      console.error('Failed to create default simulated agent:', error);
      return {
        status: 500,
        body: {
          message: 'Failed to create default simulated agent',
        },
      };
    }
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
  const { agentTemplateId, memoryVariables = {} } = req.body;
  const { activeOrganizationId, lettaAgentsId } =
    await getUserWithActiveOrganizationIdOrThrow();

  // Check if simulated agent already exists for this combination
  const whereConditions = [
    eq(simulatedAgent.agentTemplateId, agentTemplateId),
    eq(simulatedAgent.organizationId, activeOrganizationId),
  ];

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

    // Get agent template for the response
    const template = await db.query.agentTemplateV2.findFirst({
      where: eq(agentTemplateV2.id, existingAgent.agentTemplateId),
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
        isCorrupted,
      },
    };
  }

  // Check if agent template exists
  const template = await db.query.agentTemplateV2.findFirst({
    where: eq(agentTemplateV2.id, agentTemplateId),
    with: {
      lettaTemplate: {
        columns: {
          id: true,
          name: true,
          projectId: true,
        },
      },
    },
  });

  if (!template?.lettaTemplate) {
    return {
      status: 400,
      body: {
        message: 'Agent template does not exist',
      },
    };
  }

  // Create the simulated agent
  let agent;
  try {
    const result = await createSimulatedAgentUtil({
      memoryVariables,
      projectId: template.projectId,
      agentTemplateId,
      organizationId: activeOrganizationId,
      lettaAgentsId,
      lettaTemplateId: template.lettaTemplate.id,
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
      memoryVariables: true,
    },
    with: {
      agentTemplate: {
        columns: {
          name: true,
          id: true,
        },
        with: {
          lettaTemplate: true,
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

  if (!simulatedAgentRecord.agentTemplate?.lettaTemplate) {
    return {
      status: 404,
      body: {
        message: 'Agent template not found',
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
    const [agent] = await createEntitiesFromTemplate({
      template: simulatedAgentRecord.agentTemplate.lettaTemplate,
      projectId: simulatedAgentRecord.projectId,
      lettaAgentsId,
      overrides: {
        hidden: true,
        memoryVariables: simulatedAgentRecord.memoryVariables
          ? convertMemoryVariablesV1ToRecordMemoryVariables(
              simulatedAgentRecord.memoryVariables,
            )
          : {},
        name: simulatedAgentRecord.agentTemplate.name,
      },
    });

    if (!agent?.id || !agent?.project_id) {
      return {
        status: 500,
        body: {
          message: 'Failed to create new simulated agent',
        },
      };
    }
    // Insert new record with the new agent ID
    await db
      .update(simulatedAgent)
      .set({
        agentId: agent.id,
      })
      .where(eq(simulatedAgent.id, simulatedAgentId));

    return {
      status: 200,
      body: {
        name: agent.name || 'Unknown Agent',
        id: simulatedAgentId,
        agentId: agent.id,
        agentTemplateId: simulatedAgentRecord.agentTemplateId,
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
      memoryVariables: true,
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
    const updatedAgent = await updateAgentFromAgentTemplateId({
      agentToUpdateId: simulatedAgentRecord.agentId,
      agentTemplateId: simulatedAgentRecord.agentTemplateId,
      organizationId: activeOrganizationId,
      lettaAgentsUserId: lettaAgentsId,
      preserveCoreMemories: false,
      memoryVariables: simulatedAgentRecord.memoryVariables
        ? convertMemoryVariablesV1ToRecordMemoryVariables(
            simulatedAgentRecord.memoryVariables,
          )
        : {},
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

    return {
      status: 200,
      body: {
        name: updatedAgent.name || 'Unknown Agent',
        id: updatedAgent.id,
        agentId: updatedAgent.id,
        agentTemplateId: simulatedAgentRecord.agentTemplateId,
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

type SyncDefaultSimulatedAgentRequest = ServerInferRequest<
  typeof contracts.simulatedAgents.syncDefaultSimulatedAgent
>;

type SyncDefaultSimulatedAgentResponse = ServerInferResponses<
  typeof contracts.simulatedAgents.syncDefaultSimulatedAgent
>;

async function syncDefaultSimulatedAgent(
  req: SyncDefaultSimulatedAgentRequest,
): Promise<SyncDefaultSimulatedAgentResponse> {
  const { agentTemplateId } = req.params;
  const { activeOrganizationId, lettaAgentsId } =
    await getUserWithActiveOrganizationIdOrThrow();

  try {
    // Find the default simulated agent for the template
    const defaultSimulatedAgent = await db.query.simulatedAgent.findFirst({
      where: and(
        eq(simulatedAgent.agentTemplateId, agentTemplateId),
        eq(simulatedAgent.organizationId, activeOrganizationId),
        eq(simulatedAgent.isDefault, true),
      ),
      with: {
        agentTemplate: {
          columns: {
            name: true,
          },
        },
      },
    });

    if (!defaultSimulatedAgent) {
      return {
        status: 404,
        body: {
          message: 'Default simulated agent not found for this template',
        },
      };
    }

    const agent = await AgentsService.retrieveAgent(
      {
        agentId: defaultSimulatedAgent.agentId,
        includeRelationships: [],
      },
      {
        user_id: lettaAgentsId,
      },
    ).catch((e) => {
      Sentry.captureException(e);
      return null;
    });

    if (!agent) {
      return {
        status: 500,
        body: {
          message: 'Agent not found in Letta service',
        },
      };
    }

    // Synchronize the agent template with the current agent state
    await syncAgentTemplateWithState({
      agentTemplateId,
      organizationId: activeOrganizationId,
      agentState: agent,
      projectId: defaultSimulatedAgent.projectId,
      lettaAgentsId,
    });

    const simulatedAgentRecord = await db.query.simulatedAgent.findFirst({
      where: and(
        eq(simulatedAgent.agentId, agent.id),
        eq(simulatedAgent.organizationId, activeOrganizationId),
      ),
      columns: {
        memoryVariables: true,
      },
    });

     await updateAgentFromAgentTemplateId({
      agentToUpdateId: agent.id,
      agentTemplateId: agentTemplateId,
      organizationId: activeOrganizationId,
      lettaAgentsUserId: lettaAgentsId,
      preserveCoreMemories: false,
      memoryVariables: simulatedAgentRecord?.memoryVariables
        ? convertMemoryVariablesV1ToRecordMemoryVariables(
          simulatedAgentRecord.memoryVariables,
        )
        : {},
    });

    return {
      status: 200,
      body: {
        success: true,
      },
    };
  } catch (error) {
    Sentry.captureException(error);
    return {
      status: 500,
      body: {
        message: 'Failed to sync default simulated agent',
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
      memoryVariables:  simulatedAgentRecord.memoryVariables ? convertMemoryVariablesV1ToRecordMemoryVariables(
        simulatedAgentRecord.memoryVariables,
      ) : {},
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
          convertRecordMemoryVariablesToMemoryVariablesV1(memoryVariables),
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
  const { agentTemplateId, offset = 0, limit = 10 } = req.query;
  const { activeOrganizationId, lettaAgentsId } =
    await getUserWithActiveOrganizationIdOrThrow();

  // Build where conditions
  const whereConditions = [
    eq(simulatedAgent.organizationId, activeOrganizationId),
  ];

  if (agentTemplateId) {
    whereConditions.push(eq(simulatedAgent.agentTemplateId, agentTemplateId));
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
        return {
          name: agent?.name || sa.agentTemplate.name || 'Unknown Agent',
          id: sa.agentId,
          agentId: sa.agentId,
          agentTemplateId: sa.agentTemplate.id,
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
  syncDefaultSimulatedAgent,
  getSimulatedAgentVariables,
  updateSimulatedAgentVariables,
  listSimulatedAgents,
};
