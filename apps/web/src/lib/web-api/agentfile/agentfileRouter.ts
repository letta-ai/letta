import { AgentsService } from '@letta-cloud/sdk-core';
import type { contracts } from '@letta-cloud/sdk-web';
import type { ServerInferResponses } from '@ts-rest/core';
import {
  userHasAgentfileAccess,
  getAgentfilePermissions,
  formatSerializedAgentfile,
  getAgentUrl,
} from './helpers';
import { getUser } from '$web/server/auth';
import { getOrganizationLettaServiceAccountId } from '$web/server/lib/getOrganizationLettaServiceAccountId/getOrganizationLettaServiceAccountId';
import { getDefaultProject } from '@letta-cloud/utils-server';

interface AgentfileRequest {
  params: {
    agentId: string;
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
      status: 400,
      body: 'Agent ID is required',
    };
  }

  const user = await getUser();
  const permissions = await getAgentfilePermissions(agentId);

  if (!permissions) {
    return {
      status: 404,
      body: 'Agent permissions not found',
    };
  }

  const downloadIsAllowed = await userHasAgentfileAccess(user, permissions);
  if (!downloadIsAllowed) {
    return {
      status: 401,
      body: 'You do not have access to this agent',
    };
  }

  const serviceAccountId = await getOrganizationLettaServiceAccountId(
    permissions.organizationId,
  );
  if (!serviceAccountId) {
    return {
      status: 401,
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
      status: 404,
      body: 'Agentfile not found',
    };
  }

  return {
    status: 200,
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
      status: 400,
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
    status: 200,
    body: url,
  };
}

interface AgentfileRouter {
  getAgentfile: (request: AgentfileRequest) => Promise<AgentfileResponse>;
  cloneAgentfile: (request: AgentfileRequest) => Promise<AgentfileResponse>;
}

export const agentfileRouter: AgentfileRouter = {
  getAgentfile,
  cloneAgentfile,
};
