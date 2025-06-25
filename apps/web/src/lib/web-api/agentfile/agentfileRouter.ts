import { AgentsService } from '@letta-cloud/sdk-core';
import type { ServerInferResponses } from '@ts-rest/core';
import { db, agentfilePermissions } from '@letta-cloud/service-database';
import { getUser } from '$web/server/auth';
import { eq } from 'drizzle-orm';
import type { contracts } from '@letta-cloud/sdk-web';

interface AgentfileRequest {
  params: {
    agentId: string;
  };
}

type AgentfileResponse = ServerInferResponses<
  typeof contracts.agentfile.getAgentfile
>;

enum AccessLevel {
  PUBLIC = 'public',
  ORGANIZATION = 'organization',
  LOGGED_IN = 'logged-in',
  NONE = 'none',
}

async function userHasAgentfileAccess(agentId: string): Promise<boolean> {
  let downloadIsAllowed = false;

  const permissions = await db.query.agentfilePermissions.findFirst({
    where: eq(agentfilePermissions.agentId, agentId),
    columns: {
      accessLevel: true,
      organizationId: true,
    },
  });

  const user = await getUser();
  const isOwner = user?.activeOrganizationId === permissions?.organizationId;

  const accessStatus = permissions?.accessLevel;

  switch (accessStatus) {
    case AccessLevel.PUBLIC:
      downloadIsAllowed = true;
      break;
    case AccessLevel.LOGGED_IN:
      if (user) {
        downloadIsAllowed = true;
      } else {
        downloadIsAllowed = false;
      }
      break;
    case AccessLevel.NONE:
      if (isOwner) {
        downloadIsAllowed = true;
      } else {
        downloadIsAllowed = false;
      }
      break;
    default:
      downloadIsAllowed = false;
      break;
  }
  return downloadIsAllowed;
}

export async function getAgentfile(
  request: AgentfileRequest,
): Promise<AgentfileResponse> {
  const { agentId } = request.params;
  const downloadIsAllowed = await userHasAgentfileAccess(agentId);

  if (!downloadIsAllowed) {
    return {
      status: 401,
      body: 'You do not have access to this agent',
    };
  }

  const exportedAgentfile = await AgentsService.exportAgentSerialized({
    agentId,
  });

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

interface AgentfileRouter {
  getAgentfile: (request: AgentfileRequest) => Promise<AgentfileResponse>;
}

export const agentfileRouter: AgentfileRouter = {
  getAgentfile,
};
