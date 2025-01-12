import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '../contracts';
import {
  getUserOrThrow,
  getUserWithActiveOrganizationIdOrThrow,
} from '$web/server/auth';
import { and, desc, eq, ilike, isNull } from 'drizzle-orm';
import {
  agentSimulatorSessions,
  agentTemplates,
  db,
  deployedAgentTemplates,
} from '@letta-cloud/database';
import { copyAgentById, agentsRouter, updateAgentFromAgentId } from '$web/sdk';
import { AgentsService } from '@letta-cloud/letta-agents-api';
import { getDeployedTemplateByVersion } from '$web/server/lib/getDeployedTemplateByVersion/getDeployedTemplateByVersion';
import type { AgentState } from '@letta-cloud/letta-agents-api';

function randomThreeDigitNumber() {
  return Math.floor(Math.random() * 1000);
}

function getDateAsAlphanumericString(date: Date): string {
  return date.valueOf().toString(36) + randomThreeDigitNumber().toString(36);
}

type ListAgentTemplatesQueryRequest = ServerInferRequest<
  typeof contracts.agentTemplates.listAgentTemplates
>;

type ListAgentTemplatesQueryResponse = ServerInferResponses<
  typeof contracts.agentTemplates.listAgentTemplates
>;

export async function listAgentTemplates(
  req: ListAgentTemplatesQueryRequest,
): Promise<ListAgentTemplatesQueryResponse> {
  const {
    search,
    offset,
    includeLatestDeployedVersion,
    includeAgentState,
    limit = 10,
    projectId,
  } = req.query;

  const { activeOrganizationId: organizationId, lettaAgentsId } =
    await getUserOrThrow();

  if (!organizationId) {
    return {
      status: 404,
      body: {},
    };
  }

  const where = [
    eq(agentTemplates.organizationId, organizationId),
    isNull(agentTemplates.deletedAt),
  ];

  if (projectId) {
    where.push(eq(agentTemplates.projectId, projectId));
  }

  if (search) {
    where.push(ilike(agentTemplates.name, `%${search}%`));
  }

  const agentTemplatesResponse = await db.query.agentTemplates.findMany({
    where: and(...where),
    limit: limit + 1,
    offset,
    with: {
      ...(includeLatestDeployedVersion && {
        deployedAgentTemplates: {
          limit: 1,
          where: isNull(deployedAgentTemplates.deletedAt),
          orderBy: [desc(deployedAgentTemplates.createdAt)],
        },
      }),
    },
    orderBy: [desc(agentTemplates.createdAt)],
    columns: {
      name: true,
      id: true,
      updatedAt: true,
    },
  });

  const hasNextPage = agentTemplatesResponse.length > limit;

  const agentStateMap = new Map<string, AgentState>();
  if (includeAgentState) {
    const agentStates = await Promise.all(
      agentTemplatesResponse.map((agentTemplate) =>
        AgentsService.getAgent(
          {
            agentId: agentTemplate.id,
          },
          {
            user_id: lettaAgentsId,
          },
        ),
      ),
    );

    agentStates.forEach((agentState, index) => {
      agentStateMap.set(agentTemplatesResponse[index].id, agentState);
    });
  }

  return {
    status: 200,
    body: {
      agentTemplates: agentTemplatesResponse
        .slice(0, limit)
        .map((agentTemplate) => {
          return {
            name: agentTemplate.name,
            id: agentTemplate.id,

            updatedAt: agentTemplate.updatedAt.toISOString(),
            ...(includeAgentState
              ? {
                  agentState: {
                    description:
                      agentStateMap.get(agentTemplate.id)?.description || '',
                  },
                }
              : {}),
            ...(includeLatestDeployedVersion
              ? {
                  latestDeployedVersion:
                    agentTemplate.deployedAgentTemplates[0]?.version,
                  latestDeployedId: agentTemplate.deployedAgentTemplates[0]?.id,
                }
              : {}),
          };
        }),
      hasNextPage,
    },
  };
}

type ForkAgentTemplateRequest = ServerInferRequest<
  typeof contracts.agentTemplates.forkAgentTemplate
>;

type ForkAgentTemplateResponse = ServerInferResponses<
  typeof contracts.agentTemplates.forkAgentTemplate
>;

export async function forkAgentTemplate(
  req: ForkAgentTemplateRequest,
): Promise<ForkAgentTemplateResponse> {
  const { agentTemplateId, projectId } = req.params;
  const {
    activeOrganizationId,
    lettaAgentsId,
    id: userId,
  } = await getUserWithActiveOrganizationIdOrThrow();

  const testingAgent = await db.query.agentTemplates.findFirst({
    where: and(
      isNull(agentTemplates.deletedAt),
      eq(agentTemplates.organizationId, activeOrganizationId),
      eq(agentTemplates.projectId, projectId),
      eq(agentTemplates.id, agentTemplateId),
    ),
  });

  if (!testingAgent) {
    return {
      status: 404,
      body: {},
    };
  }

  const agentDetails = await AgentsService.getAgent(
    {
      agentId: testingAgent.id,
    },
    {
      user_id: lettaAgentsId,
    },
  );

  const name = `forked-${testingAgent.name}-${getDateAsAlphanumericString(new Date())}`;

  const copiedAgent = await agentsRouter.createAgent(
    {
      body: {
        name,
        // project_id: projectId,
        llm_config: agentDetails.llm_config,
        embedding_config: agentDetails.embedding_config,
        system: agentDetails.system,
        tool_ids: agentDetails.tools
          .map((tool) => tool.id)
          .filter(Boolean) as string[],
        memory_blocks: agentDetails.memory.blocks.map((block) => {
          return {
            limit: block.limit,
            label: block.label || '',
            value: block.value,
          };
        }),
        template: true,
      },
    },
    {
      request: {
        organizationId: activeOrganizationId,
        userId,
        lettaAgentsUserId: lettaAgentsId,
        source: 'api',
      },
    },
  );

  if (copiedAgent.status !== 201) {
    return {
      status: 500,
      body: {
        message: 'Failed to copy agent',
      },
    };
  }

  return {
    status: 201,
    body: {
      id: copiedAgent.body.id,
      name,
      updatedAt: new Date().toISOString(),
    },
  };
}

type GetAgentTemplateSimulatorSessionRequest = ServerInferRequest<
  typeof contracts.agentTemplates.getAgentTemplateSimulatorSession
>;

type GetAgentTemplateSimulatorSessionResponse = ServerInferResponses<
  typeof contracts.agentTemplates.getAgentTemplateSimulatorSession
>;

async function getAgentTemplateSimulatorSession(
  req: GetAgentTemplateSimulatorSessionRequest,
): Promise<GetAgentTemplateSimulatorSessionResponse> {
  const { agentTemplateId } = req.params;
  const { activeOrganizationId, lettaAgentsId } =
    await getUserWithActiveOrganizationIdOrThrow();

  const agentTemplate = await db.query.agentTemplates.findFirst({
    where: and(
      isNull(agentTemplates.deletedAt),
      eq(agentTemplates.organizationId, activeOrganizationId),
      eq(agentTemplates.id, agentTemplateId),
    ),
  });

  if (!agentTemplate) {
    return {
      status: 404,
      body: {},
    };
  }

  const simulatorSession = await db.query.agentSimulatorSessions.findFirst({
    where: eq(agentSimulatorSessions.agentTemplateId, agentTemplateId),
  });

  let agentId = '';
  let id = '';

  if (!simulatorSession) {
    const newAgent = await copyAgentById(agentTemplate.id, lettaAgentsId);

    agentId = newAgent.id;

    // create new simulator session
    const [simulatorSession] = await db
      .insert(agentSimulatorSessions)
      .values({
        agentId: newAgent.id,
        agentTemplateId: agentTemplate.id,
        organizationId: activeOrganizationId,
        variables: {},
      })
      .returning({
        id: agentSimulatorSessions.id,
        agentId: agentSimulatorSessions.agentId,
      })
      .onConflictDoNothing();

    if (!simulatorSession) {
      if (newAgent.id) {
        try {
          setTimeout(() => {
            AgentsService.deleteAgent(
              {
                agentId: newAgent.id,
              },
              {
                user_id: lettaAgentsId,
              },
            );
          }, 500);
        } catch (e) {
          console.error('Failed to delete agent', e);
        }
      }

      return {
        status: 409,
        body: {
          message: 'Simulator session already exists',
        },
      };
    }

    id = simulatorSession.id;
  } else {
    agentId = simulatorSession.agentId;
    id = simulatorSession.id;
  }

  const agent = await AgentsService.getAgent(
    {
      agentId,
    },
    {
      user_id: lettaAgentsId,
    },
  );

  return {
    status: 200,
    body: {
      agent,
      agentId,
      id,
      memoryVariables:
        (simulatorSession?.variables as Record<string, string>) || {},
      toolVariables: Object.fromEntries(
        (agent.tool_exec_environment_variables || []).map((item) => [
          item.key,
          item.value,
        ]),
      ),
    },
  };
}

type CreateAgentTemplateSimulatorSessionRequest = ServerInferRequest<
  typeof contracts.agentTemplates.createAgentTemplateSimulatorSession
>;

type CreateAgentTemplateSimulatorSessionResponse = ServerInferResponses<
  typeof contracts.agentTemplates.createAgentTemplateSimulatorSession
>;

async function createAgentTemplateSimulatorSession(
  req: CreateAgentTemplateSimulatorSessionRequest,
): Promise<CreateAgentTemplateSimulatorSessionResponse> {
  const { agentTemplateId } = req.params;
  const { memoryVariables, toolVariables } = req.body;
  const { activeOrganizationId, lettaAgentsId } =
    await getUserWithActiveOrganizationIdOrThrow();

  const agentTemplate = await db.query.agentTemplates.findFirst({
    where: and(
      isNull(agentTemplates.deletedAt),
      eq(agentTemplates.organizationId, activeOrganizationId),
      eq(agentTemplates.id, agentTemplateId),
    ),
  });

  if (!agentTemplate) {
    return {
      status: 404,
      body: {},
    };
  }

  // if there is already a simulator session, update instead
  const existingSimulatorSession =
    await db.query.agentSimulatorSessions.findFirst({
      where: eq(agentSimulatorSessions.agentTemplateId, agentTemplateId),
    });

  if (existingSimulatorSession) {
    const { memoryVariables } = req.body;

    // update existing simulator session
    const existingTemplate = await AgentsService.getAgent(
      {
        agentId: agentTemplate.id,
      },
      {
        user_id: lettaAgentsId,
      },
    );

    if (!existingTemplate?.id) {
      return {
        status: 500,
        body: {
          message: 'Failed to get agent',
        },
      };
    }

    const agentState = await updateAgentFromAgentId({
      agentToUpdateId: existingSimulatorSession.agentId,
      baseAgentId: existingTemplate.id,
      preserveCoreMemories: false,
      memoryVariables,
      toolVariables,
      lettaAgentsUserId: lettaAgentsId,
    });

    await db
      .update(agentSimulatorSessions)
      .set({
        variables: memoryVariables,
        agentId: existingSimulatorSession.agentId,
      })
      .where(eq(agentSimulatorSessions.id, existingSimulatorSession.id));

    return {
      status: 200,
      body: {
        agent: agentState,
        agentId: existingSimulatorSession.agentId,
        id: existingSimulatorSession.id,
        memoryVariables,
        toolVariables: Object.fromEntries(
          (agentState.tool_exec_environment_variables || []).map((item) => [
            item.key,
            item.value,
          ]),
        ),
      },
    };
  }

  const newAgent = await copyAgentById(agentTemplate.id, lettaAgentsId, {
    memoryVariables,
    toolVariables,
  });

  if (!newAgent?.id) {
    return {
      status: 500,
      body: {
        message: 'Failed to copy agent',
      },
    };
  }

  const newAgentId = newAgent.id;

  const [simulatorSession] = await db
    .insert(agentSimulatorSessions)
    .values({
      agentId: newAgentId,
      agentTemplateId: agentTemplate.id,
      organizationId: activeOrganizationId,
      variables: memoryVariables,
    })
    .returning({
      id: agentSimulatorSessions.id,
    });

  return {
    status: 201,
    body: {
      agent: newAgent,
      id: simulatorSession.id,
      agentId: newAgentId,
      memoryVariables,
      toolVariables,
    },
  };
}

type RefreshAgentTemplateSimulatorSessionRequest = ServerInferRequest<
  typeof contracts.agentTemplates.refreshAgentTemplateSimulatorSession
>;

type RefreshAgentTemplateSimulatorSessionResponse = ServerInferResponses<
  typeof contracts.agentTemplates.refreshAgentTemplateSimulatorSession
>;

async function refreshAgentTemplateSimulatorSession(
  req: RefreshAgentTemplateSimulatorSessionRequest,
): Promise<RefreshAgentTemplateSimulatorSessionResponse> {
  const { agentTemplateId, agentSessionId } = req.params;
  const { activeOrganizationId, lettaAgentsId } =
    await getUserWithActiveOrganizationIdOrThrow();

  const agentTemplate = await db.query.agentTemplates.findFirst({
    where: and(
      isNull(agentTemplates.deletedAt),
      eq(agentTemplates.organizationId, activeOrganizationId),
      eq(agentTemplates.id, agentTemplateId),
    ),
  });

  if (!agentTemplate) {
    return {
      status: 404,
      body: {},
    };
  }

  const simulatorSession = await db.query.agentSimulatorSessions.findFirst({
    where: and(
      eq(agentSimulatorSessions.agentTemplateId, agentTemplateId),
      eq(agentSimulatorSessions.id, agentSessionId),
      eq(agentSimulatorSessions.organizationId, activeOrganizationId),
    ),
  });

  if (!simulatorSession) {
    return {
      status: 404,
      body: {},
    };
  }

  const agent = await updateAgentFromAgentId({
    memoryVariables:
      (simulatorSession.variables as Record<string, string>) || {},
    baseAgentId: agentTemplate.id,
    agentToUpdateId: simulatorSession.agentId,
    lettaAgentsUserId: lettaAgentsId,
    preserveCoreMemories: false,
  });

  return {
    status: 200,
    body: {
      agent,
      agentId: simulatorSession.agentId,
      id: simulatorSession.id,
      memoryVariables: simulatorSession.variables as Record<string, string>,
      toolVariables: Object.fromEntries(
        (agent.tool_exec_environment_variables || []).map((item) => [
          item.key,
          item.value,
        ]),
      ),
    },
  };
}

type DeleteAgentTemplateSimulatorSessionRequest = ServerInferRequest<
  typeof contracts.agentTemplates.deleteAgentTemplateSimulatorSession
>;

type DeleteAgentTemplateSimulatorSessionResponse = ServerInferResponses<
  typeof contracts.agentTemplates.deleteAgentTemplateSimulatorSession
>;

async function deleteAgentTemplateSimulatorSession(
  req: DeleteAgentTemplateSimulatorSessionRequest,
): Promise<DeleteAgentTemplateSimulatorSessionResponse> {
  const { agentSessionId } = req.params;
  const { activeOrganizationId } =
    await getUserWithActiveOrganizationIdOrThrow();

  const simulatorSession = await db.query.agentSimulatorSessions.findFirst({
    where: and(
      eq(agentSimulatorSessions.id, agentSessionId),
      eq(agentSimulatorSessions.organizationId, activeOrganizationId),
    ),
  });

  if (!simulatorSession) {
    return {
      status: 404,
      body: {
        success: false,
      },
    };
  }

  await db
    .delete(agentSimulatorSessions)
    .where(eq(agentSimulatorSessions.id, agentSessionId));

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

type GetAgentTemplateByVersion = ServerInferRequest<
  typeof contracts.agentTemplates.getAgentTemplateByVersion
>;

type GetAgentTemplateByVersionResponse = ServerInferResponses<
  typeof contracts.agentTemplates.getAgentTemplateByVersion
>;

async function getAgentTemplateByVersion(
  req: GetAgentTemplateByVersion,
): Promise<GetAgentTemplateByVersionResponse> {
  const { slug } = req.params;
  const { lettaAgentsId, activeOrganizationId } =
    await getUserWithActiveOrganizationIdOrThrow();

  const [versionName] = slug.split(':');
  const deployedAgentTemplate = await getDeployedTemplateByVersion(
    slug,
    activeOrganizationId,
  );

  if (!deployedAgentTemplate) {
    return {
      status: 404,
      body: {
        message: 'Template version provided does not exist',
      },
    };
  }

  const agent = await AgentsService.getAgent(
    {
      agentId: deployedAgentTemplate.id,
    },
    {
      user_id: lettaAgentsId,
    },
  );

  return {
    status: 200,
    body: {
      fullVersion: `${versionName}:${deployedAgentTemplate.version}`,
      version: deployedAgentTemplate.version,
      id: deployedAgentTemplate.id,
      state: agent,
    },
  };
}

export const agentTemplateRoutes = {
  listAgentTemplates,
  getAgentTemplateByVersion,
  forkAgentTemplate,
  deleteAgentTemplateSimulatorSession,
  createAgentTemplateSimulatorSession,
  getAgentTemplateSimulatorSession,
  refreshAgentTemplateSimulatorSession,
};
