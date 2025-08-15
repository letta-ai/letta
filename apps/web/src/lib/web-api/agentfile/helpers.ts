import { db, agentfilePermissions } from '@letta-cloud/service-database';
import type { GetUserDataResponse } from '$web/server/auth';
import { eq } from 'drizzle-orm';
import type { z } from 'zod';
import type { AgentFileAccessLevels } from '@letta-cloud/types';

export const SERVER_CODE = {
  OK: 200,
  CLIENT_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  FAILED_DEPENDENCY: 424,
} as const;

export type AccessLevel = z.infer<typeof AgentFileAccessLevels>;

interface GetAgentfilePermissionsResponse {
  organizationId: string;
  accessLevel: AccessLevel;
}

export async function userHasAgentfileAccess(
  user: GetUserDataResponse | null,
  permissions: GetAgentfilePermissionsResponse | null | undefined,
): Promise<boolean> {
  if (!permissions) {
    return false;
  }
  let downloadIsAllowed = false;

  const isOwner = user?.activeOrganizationId === permissions.organizationId;
  const accessStatus = permissions.accessLevel;

  switch (accessStatus) {
    case 'public':
    case 'unlisted':
      downloadIsAllowed = true;
      break;
    case 'logged-in':
      if (user) {
        downloadIsAllowed = true;
      } else {
        downloadIsAllowed = false;
      }
      break;
    case 'organization':
    case 'none':
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

export async function getAgentfilePermissions(agentId: string) {
  const permissions = await db.query.agentfilePermissions.findFirst({
    where: eq(agentfilePermissions.agentId, agentId),
    columns: {
      accessLevel: true,
      createdAt: true,
      organizationId: true,
      name: true,
      description: true,
      summary: true,
    },
  });

  return permissions;
}

export async function formatSerializedAgentfile(exportedAgentfile: string) {
  const agentfileBlob = new Blob([JSON.stringify(exportedAgentfile)], {
    type: 'application/json',
  });

  const importData = {
    file: agentfileBlob,
  };

  return importData;
}

export function getAgentUrl(projectId: string, agentId: string) {
  return `/projects/${projectId}/agents/${agentId}`;
}
