import type { NextFunction, Request, Response } from 'express';
import {
  getOrganizationUser,
  getPermissionForSDKPath,
  type MethodType,
} from '@letta-cloud/utils-server';
import { roleToServicesMap } from '@letta-cloud/service-rbac';

export async function verifyRoutePermissionsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.actor) {
    next();
    return;
  }

  if (req.actor.source === 'api') {
    next();
    return;
  }

  // probably can speed this up in the future
  const user = await getOrganizationUser(
    req.actor.coreUserId,
    req.actor.cloudOrganizationId,
  );

  if (!user) {
    res.status(401).send('Unauthorized');
    return;
  }

  const permission = getPermissionForSDKPath(req.url, req.method as MethodType);

  const userPermissions = new Set(roleToServicesMap[user.role || 'custom']);

  if (!permission || userPermissions.has(permission)) {
    res.status(401).send('Unauthorized');
    return;
  }

  next();
}
