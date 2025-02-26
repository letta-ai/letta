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
import { AgentsService } from '@letta-cloud/letta-agents-api';
import type { AgentState } from '@letta-cloud/letta-agents-api';
import { getDeployedTemplateByVersion } from '@letta-cloud/server-utils';
import { createTemplate } from '$web/server/lib/createTemplate/createTemplate';
import { copyAgentById } from '$web/server/lib/copyAgentById/copyAgentById';
import { updateAgentFromAgentId } from '$web/server/lib/updateAgentFromAgentId/updateAgentFromAgentId';
import { ApplicationServices } from '@letta-cloud/rbac';

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
    name,
  } = req.query;

  const {
    activeOrganizationId: organizationId,
    permissions,
    lettaAgentsId,
  } = await getUserOrThrow();

  if (!permissions.has(ApplicationServices.READ_TEMPLATES)) {
    return {
      status: 403,
      body: {},
    };
  }

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

  if (name) {
    where.push(eq(agentTemplates.name, name));
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
        AgentsService.retrieveAgent(
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
                  agentState: agentStateMap.get(agentTemplate.id),
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

type GetAgentTemplateByIdRequest = ServerInferRequest<
  typeof contracts.agentTemplates.getAgentTemplateById
>;

type GetAgentTemplateByIdResponse = ServerInferResponses<
  typeof contracts.agentTemplates.getAgentTemplateById
>;

export async function getAgentTemplateById(
  req: GetAgentTemplateByIdRequest,
): Promise<GetAgentTemplateByIdResponse> {
  const { id } = req.params;
  const { includeState } = req.query;
  const { activeOrganizationId, permissions, lettaAgentsId } =
    await getUserOrThrow();

  if (!activeOrganizationId) {
    return {
      status: 404,
      body: {},
    };
  }

  if (!permissions.has(ApplicationServices.READ_TEMPLATES)) {
    return {
      status: 403,
      body: {},
    };
  }

  const agentTemplate = await db.query.agentTemplates.findFirst({
    where: and(
      eq(agentTemplates.organizationId, activeOrganizationId),
      eq(agentTemplates.id, id),
      isNull(agentTemplates.deletedAt),
    ),
  });

  if (!agentTemplate) {
    return {
      status: 404,
      body: {},
    };
  }

  return {
    status: 200,
    body: {
      agentState: includeState
        ? await AgentsService.retrieveAgent(
            {
              agentId: agentTemplate.id,
            },
            {
              user_id: lettaAgentsId,
            },
          )
        : undefined,
      name: agentTemplate.name,
      id: agentTemplate.id,
      updatedAt: agentTemplate.updatedAt.toISOString(),
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
    permissions,
    id: userId,
  } = await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.CREATE_UPDATE_DELETE_TEMPLATES)) {
    return {
      status: 403,
      body: {},
    };
  }

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

  const agentDetails = await AgentsService.retrieveAgent(
    {
      agentId: testingAgent.id,
    },
    {
      user_id: lettaAgentsId,
    },
  );

  const name = `forked-${testingAgent.name}-${getDateAsAlphanumericString(new Date())}`;

  const copiedTemplate = await createTemplate({
    projectId,
    organizationId: activeOrganizationId,
    lettaAgentsId,
    userId,
    name,
    createAgentState: {
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
    },
  });

  return {
    status: 201,
    body: {
      id: copiedTemplate.templateId,
      name: copiedTemplate.templateName,
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

  const { activeOrganizationId, permissions, lettaAgentsId } =
    await getUserOrThrow();

  if (!activeOrganizationId) {
    return {
      status: 404,
      body: {},
    };
  }

  if (!permissions.has(ApplicationServices.READ_TEMPLATES)) {
    return {
      status: 403,
      body: {},
    };
  }

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
    const newAgent = await copyAgentById(agentTemplate.id, lettaAgentsId, {
      name: `sa-${agentTemplate.id}`,
      projectId: 'simulated-agents',
    });

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

  const agent = await AgentsService.retrieveAgent(
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

  const { activeOrganizationId, permissions, lettaAgentsId } =
    await getUserWithActiveOrganizationIdOrThrow();

  /* This is READ_TEMPLATES permission because simulated agents are not real agents, they are just a copy of the agent template and used for visualization */
  if (!permissions.has(ApplicationServices.READ_TEMPLATES)) {
    return {
      status: 403,
      body: {},
    };
  }

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
    const existingTemplate = await AgentsService.retrieveAgent(
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
    name: `sa-${agentTemplate.id}`,
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

  const { activeOrganizationId, permissions, lettaAgentsId } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.READ_TEMPLATES)) {
    return {
      status: 403,
      body: {},
    };
  }

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

  const { activeOrganizationId, permissions, lettaAgentsId } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.READ_TEMPLATES)) {
    return {
      status: 403,
      body: {},
    };
  }

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

  await Promise.all([
    db
      .delete(agentSimulatorSessions)
      .where(eq(agentSimulatorSessions.id, agentSessionId)),
    AgentsService.deleteAgent(
      {
        agentId: simulatorSession.agentId,
      },
      {
        user_id: lettaAgentsId,
      },
    ),
  ]);

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
  const { lettaAgentsId, permissions, activeOrganizationId } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.READ_TEMPLATES)) {
    return {
      status: 403,
      body: {},
    };
  }

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

  const agent = await AgentsService.retrieveAgent(
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

type GetDeployedAgentTemplateByIdRequest = ServerInferRequest<
  typeof contracts.agentTemplates.getDeployedAgentTemplateById
>;

type GetDeployedAgentTemplateByIdResponse = ServerInferResponses<
  typeof contracts.agentTemplates.getDeployedAgentTemplateById
>;

export async function getDeployedAgentTemplateById(
  req: GetDeployedAgentTemplateByIdRequest,
): Promise<GetDeployedAgentTemplateByIdResponse> {
  const { id } = req.params;
  const { activeOrganizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.READ_TEMPLATES)) {
    return {
      status: 403,
      body: {},
    };
  }

  const deployedAgentTemplate = await db.query.deployedAgentTemplates.findFirst(
    {
      where: and(
        eq(deployedAgentTemplates.organizationId, activeOrganizationId),
        eq(deployedAgentTemplates.id, id),
        isNull(deployedAgentTemplates.deletedAt),
      ),
      with: {
        agentTemplate: {
          columns: {
            name: true,
          },
        },
      },
    },
  );

  if (!deployedAgentTemplate) {
    return {
      status: 404,
      body: {},
    };
  }

  return {
    status: 200,
    body: {
      fullVersion: `${deployedAgentTemplate.agentTemplate.name}:${deployedAgentTemplate.version}`,
      agentTemplateId: deployedAgentTemplate.agentTemplateId,
      id: deployedAgentTemplate.id,
      projectId: deployedAgentTemplate.projectId,
      createdAt: deployedAgentTemplate.createdAt.toISOString(),
      templateName: deployedAgentTemplate.agentTemplate.name,
    },
  };
}

type ListTemplateVersions = ServerInferRequest<
  typeof contracts.agentTemplates.listTemplateVersions
>;

type ListTemplateVersionsResponse = ServerInferResponses<
  typeof contracts.agentTemplates.listTemplateVersions
>;

async function listTemplateVersions(
  req: ListTemplateVersions,
): Promise<ListTemplateVersionsResponse> {
  const { agentTemplateId } = req.params;
  const { limit = 5, offset, versionId } = req.query;

  const response = await db.query.deployedAgentTemplates.findMany({
    where: and(
      ...[
        eq(deployedAgentTemplates.agentTemplateId, agentTemplateId),
        isNull(deployedAgentTemplates.deletedAt),
        ...(versionId ? [eq(deployedAgentTemplates.id, versionId)] : []),
      ],
    ),
    limit: limit + 1,
    offset,
    orderBy: [desc(deployedAgentTemplates.createdAt)],
  });

  return {
    status: 200,
    body: {
      versions: response.slice(0, limit).map((version) => {
        return {
          id: version.id,
          message: version.message || undefined,
          version: version.version,
          agentTemplateId: version.agentTemplateId,
          createdAt: version.createdAt.toISOString(),
        };
      }),
      hasNextPage: response.length > limit,
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
  getAgentTemplateById,
  getDeployedAgentTemplateById,
  listTemplateVersions,
};
