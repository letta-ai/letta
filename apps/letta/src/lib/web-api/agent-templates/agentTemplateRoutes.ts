import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '../contracts';
import {
  getUserActiveOrganizationIdOrThrow,
  getUserWithActiveOrganizationIdOrThrow,
} from '$letta/server/auth';
import { and, desc, eq, isNull, like } from 'drizzle-orm';
import {
  agentSimulatorSessions,
  agentTemplates,
  db,
} from '@letta-web/database';
import { copyAgentById, updateAgentFromAgentId } from '$letta/sdk';
import { AgentsService } from '@letta-web/letta-agents-api';

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
  req: ListAgentTemplatesQueryRequest
): Promise<ListAgentTemplatesQueryResponse> {
  const { search, offset, limit = 10, projectId } = req.query;

  const organizationId = await getUserActiveOrganizationIdOrThrow();

  const where = [
    eq(agentTemplates.organizationId, organizationId),
    isNull(agentTemplates.deletedAt),
  ];

  if (projectId) {
    where.push(eq(agentTemplates.projectId, projectId));
  }

  if (search) {
    where.push(like(agentTemplates.name, `%${search}%`));
  }

  const agentTemplatesResponse = await db.query.agentTemplates.findMany({
    where: and(...where),
    limit: limit + 1,
    offset,
    orderBy: [desc(agentTemplates.createdAt)],
    columns: {
      name: true,
      id: true,
      updatedAt: true,
    },
  });

  const hasNextPage = agentTemplatesResponse.length > limit;

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
  req: ForkAgentTemplateRequest
): Promise<ForkAgentTemplateResponse> {
  const { agentTemplateId, projectId } = req.params;
  const { activeOrganizationId, lettaAgentsId } =
    await getUserWithActiveOrganizationIdOrThrow();

  const testingAgent = await db.query.agentTemplates.findFirst({
    where: and(
      isNull(agentTemplates.deletedAt),
      eq(agentTemplates.organizationId, activeOrganizationId),
      eq(agentTemplates.projectId, projectId),
      eq(agentTemplates.id, agentTemplateId)
    ),
  });

  if (!testingAgent) {
    return {
      status: 404,
      body: {},
    };
  }

  const copiedAgent = await copyAgentById(testingAgent.id, lettaAgentsId);

  if (!copiedAgent.id) {
    return {
      status: 500,
      body: {
        message: 'Failed to copy agent',
      },
    };
  }

  let name = `forked-${testingAgent.name}`;

  // check if name already exists
  const existingAgent = await db.query.agentTemplates.findFirst({
    where: and(
      isNull(agentTemplates.deletedAt),
      eq(agentTemplates.organizationId, activeOrganizationId),
      eq(agentTemplates.projectId, projectId),
      eq(agentTemplates.name, name)
    ),
  });

  if (existingAgent) {
    name = `${name}-${getDateAsAlphanumericString(new Date())}`;
  }

  const [agent] = await db
    .insert(agentTemplates)
    .values({
      id: copiedAgent.id,
      projectId: testingAgent.projectId,
      organizationId: activeOrganizationId,
      name,
    })
    .returning({
      id: agentTemplates.id,
    });

  return {
    status: 201,
    body: {
      id: agent.id,
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
  req: GetAgentTemplateSimulatorSessionRequest
): Promise<GetAgentTemplateSimulatorSessionResponse> {
  const { agentTemplateId } = req.params;
  const { activeOrganizationId, lettaAgentsId } =
    await getUserWithActiveOrganizationIdOrThrow();

  const agentTemplate = await db.query.agentTemplates.findFirst({
    where: and(
      isNull(agentTemplates.deletedAt),
      eq(agentTemplates.organizationId, activeOrganizationId),
      eq(agentTemplates.id, agentTemplateId)
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
    // create new simulator session
    const newAgent = await copyAgentById(agentTemplate.id, lettaAgentsId);

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
        variables: {},
      })
      .returning({
        id: agentSimulatorSessions.id,
      });

    agentId = newAgentId;
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
    }
  );

  return {
    status: 200,
    body: {
      agent,
      agentId,
      id,
      variables: (simulatorSession?.variables as Record<string, string>) || {},
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
  req: CreateAgentTemplateSimulatorSessionRequest
): Promise<CreateAgentTemplateSimulatorSessionResponse> {
  const { agentTemplateId } = req.params;
  const { variables } = req.body;
  const { activeOrganizationId, lettaAgentsId } =
    await getUserWithActiveOrganizationIdOrThrow();

  const agentTemplate = await db.query.agentTemplates.findFirst({
    where: and(
      isNull(agentTemplates.deletedAt),
      eq(agentTemplates.organizationId, activeOrganizationId),
      eq(agentTemplates.id, agentTemplateId)
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
    const { variables } = req.body;

    // update existing simulator session
    const existingTemplate = await AgentsService.getAgent(
      {
        agentId: agentTemplate.id,
      },
      {
        user_id: lettaAgentsId,
      }
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
      variables,
      lettaAgentsUserId: lettaAgentsId,
    });

    await db
      .update(agentSimulatorSessions)
      .set({
        variables,
        agentId: existingSimulatorSession.agentId,
      })
      .where(eq(agentSimulatorSessions.id, existingSimulatorSession.id));

    return {
      status: 200,
      body: {
        agent: agentState,
        agentId: existingSimulatorSession.agentId,
        id: existingSimulatorSession.id,
        variables,
      },
    };
  }

  const newAgent = await copyAgentById(
    agentTemplate.id,
    lettaAgentsId,
    variables
  );

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
      variables,
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
      variables,
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
  req: RefreshAgentTemplateSimulatorSessionRequest
): Promise<RefreshAgentTemplateSimulatorSessionResponse> {
  const { agentTemplateId, agentSessionId } = req.params;
  const { activeOrganizationId, lettaAgentsId } =
    await getUserWithActiveOrganizationIdOrThrow();

  const agentTemplate = await db.query.agentTemplates.findFirst({
    where: and(
      isNull(agentTemplates.deletedAt),
      eq(agentTemplates.organizationId, activeOrganizationId),
      eq(agentTemplates.id, agentTemplateId)
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
      eq(agentSimulatorSessions.organizationId, activeOrganizationId)
    ),
  });

  if (!simulatorSession) {
    return {
      status: 404,
      body: {},
    };
  }

  const agent = await updateAgentFromAgentId({
    variables: (simulatorSession.variables as Record<string, string>) || {},
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
      variables: simulatorSession.variables as Record<string, string>,
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
  req: DeleteAgentTemplateSimulatorSessionRequest
): Promise<DeleteAgentTemplateSimulatorSessionResponse> {
  const { agentSessionId } = req.params;
  const { activeOrganizationId } =
    await getUserWithActiveOrganizationIdOrThrow();

  const simulatorSession = await db.query.agentSimulatorSessions.findFirst({
    where: and(
      eq(agentSimulatorSessions.id, agentSessionId),
      eq(agentSimulatorSessions.organizationId, activeOrganizationId)
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

export const agentTemplateRoutes = {
  listAgentTemplates,
  forkAgentTemplate,
  deleteAgentTemplateSimulatorSession,
  createAgentTemplateSimulatorSession,
  getAgentTemplateSimulatorSession,
  refreshAgentTemplateSimulatorSession,
};
