import { db, agentfilePermissions } from '@letta-cloud/service-database';
import type { GetUserDataResponse } from '$web/server/auth';
import { eq } from 'drizzle-orm';

export const SERVER_CODE = {
  OK: 200,
  CLIENT_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  FAILED_DEPENDENCY: 424,
} as const;

export enum AccessLevel {
  ORGANIZATION = 'organization',
  LOGGED_IN = 'logged-in',
  PUBLIC = 'public',
  NONE = 'none',
}

export type AccessLevelType = `${AccessLevel}`;

interface GetAgentfilePermissionsResponse {
  organizationId: string;
  accessLevel: AccessLevelType;
}

export async function isValidAccessLevelType(input: string) {
  return Object.values(AccessLevel).includes(input as AccessLevel);
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
    case AccessLevel.ORGANIZATION:
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

export async function getAgentfilePermissions(agentId: string) {
  const permissions = await db.query.agentfilePermissions.findFirst({
    where: eq(agentfilePermissions.agentId, agentId),
    columns: {
      accessLevel: true,
      organizationId: true,
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
