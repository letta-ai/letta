import { AgentsService } from '@letta-cloud/sdk-core';
import type { contracts } from '@letta-cloud/sdk-web';
import type { ServerInferResponses } from '@ts-rest/core';
import {
  userHasAgentfileAccess,
  getAgentfilePermissions,
  formatSerializedAgentfile,
  getAgentUrl,
  isValidAccessLevelType,
  SERVER_CODE,
} from './helpers';
import type { AccessLevel } from './helpers';
import { getUser } from '$web/server/auth';
import { getOrganizationLettaServiceAccountId } from '$web/server/lib/getOrganizationLettaServiceAccountId/getOrganizationLettaServiceAccountId';
import { getDefaultProject } from '@letta-cloud/utils-server';
import { db, agentfilePermissions } from '@letta-cloud/service-database';
import { eq } from 'drizzle-orm';

interface AgentfileRequest {
  params: {
    agentId: string;
  };
}

interface UpdateAgentfileAccessLevelRequest {
  params: {
    agentId: string;
  };
  body: {
    accessLevel: string;
  };
}

type AgentfileResponse = ServerInferResponses<
  typeof contracts.agentfile.getAgentfile
>;

export async function getAgentfile(
  request: AgentfileRequest,
): Promise<AgentfileResponse> {
  const { agentId } = request.params;
  if (!agentId) {
    return {
      status: SERVER_CODE.CLIENT_ERROR,
      body: 'Agent ID is required',
    };
  }

  const user = await getUser();
  const permissions = await getAgentfilePermissions(agentId);

  if (!permissions) {
    return {
      status: SERVER_CODE.FAILED_DEPENDENCY,
      body: 'Agentfile permissions not found',
    };
  }

  const downloadIsAllowed = await userHasAgentfileAccess(user, permissions);
  if (!downloadIsAllowed) {
    return {
      status: SERVER_CODE.FORBIDDEN,
      body: 'You do not have access to this agentfile',
    };
  }

  const serviceAccountId = await getOrganizationLettaServiceAccountId(
    permissions.organizationId,
  );
  if (!serviceAccountId) {
    return {
      status: SERVER_CODE.FAILED_DEPENDENCY,
      body: 'Service Account ID not found',
    };
  }

  const exportedAgentfile = await AgentsService.exportAgentSerialized(
    {
      agentId,
    },
    {
      user_id: serviceAccountId,
    },
  );

  if (!exportedAgentfile) {
    return {
      status: SERVER_CODE.NOT_FOUND,
      body: 'Agentfile not found',
    };
  }

  return {
    status: SERVER_CODE.OK,
    body: exportedAgentfile,
  };
}

export async function cloneAgentfile(
  request: AgentfileRequest,
): Promise<AgentfileResponse> {
  const { agentId } = request.params;
  const user = await getUser();
  if (!user) {
    return {
      status: SERVER_CODE.UNAUTHORIZED,
      body: 'Must be logged in to use agent in Letta Cloud',
    };
  }

  const response = await getAgentfile({ params: { agentId } });
  const formattedAgentfile = await formatSerializedAgentfile(response.body);

  const projectId = (
    await getDefaultProject({
      organizationId: user.activeOrganizationId || '',
    })
  ).id;
  const agent = await AgentsService.importAgentSerialized(
    {
      formData: formattedAgentfile,
      projectId: projectId,
    },
    {
      user_id: user.lettaAgentsId,
    },
  );

  const url = getAgentUrl(projectId, agent.id);

  return {
    status: SERVER_CODE.OK,
    body: url,
  };
}

export async function updateAgentfileAccessLevel(
  request: UpdateAgentfileAccessLevelRequest,
): Promise<AgentfileResponse> {
  const { agentId } = request.params;
  const { accessLevel } = request.body;

  if (!(await isValidAccessLevelType(accessLevel))) {
    return {
      status: SERVER_CODE.CLIENT_ERROR,
      body: 'Invalid Access Level input',
    };
  }

  const user = await getUser();
  if (!user) {
    return {
      status: SERVER_CODE.UNAUTHORIZED,
      body: 'Must be logged in to use agent in Letta Cloud',
    };
  }

  const permissions = await getAgentfilePermissions(agentId);
  if (!permissions) {
    return {
      status: SERVER_CODE.FAILED_DEPENDENCY,
      body: 'Agentfile permissions not found',
    };
  }

  const isOwner = user.activeOrganizationId === permissions.organizationId;
  if (!isOwner) {
    return {
      status: SERVER_CODE.UNAUTHORIZED,
      body: 'You do not have permission to update this agentfile access level',
    };
  }

  const [updatedAccessLevel] = await db
    .update(agentfilePermissions)
    .set({ accessLevel: accessLevel as AccessLevel })
    .where(eq(agentfilePermissions.agentId, agentId))
    .returning({ accessLevel: agentfilePermissions.accessLevel });

  return {
    status: SERVER_CODE.OK,
    body: updatedAccessLevel,
  };
}

interface AgentfileRouter {
  getAgentfile: (request: AgentfileRequest) => Promise<AgentfileResponse>;
  cloneAgentfile: (request: AgentfileRequest) => Promise<AgentfileResponse>;
  updateAgentfileAccessLevel: (
    request: UpdateAgentfileAccessLevelRequest,
  ) => Promise<AgentfileResponse>;
}

export const agentfileRouter: AgentfileRouter = {
  getAgentfile,
  cloneAgentfile,
  updateAgentfileAccessLevel,
};
