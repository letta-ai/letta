import type { NextFunction, Request, Response } from 'express';
import {
  getOrganizationUser,
  getPermissionForSDKPath,
  type MethodType,
} from '@letta-cloud/utils-server';
import { roleToServicesMap } from '@letta-cloud/service-rbac';
import { DEFAULT_UNAUTHORIZED_MESSAGE } from '../constants';

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
    req.actor.cloudUserId,
    req.actor.cloudOrganizationId,
  );

  if (!user) {
    res.status(401).send(DEFAULT_UNAUTHORIZED_MESSAGE);
    return;
  }

  const permission = getPermissionForSDKPath(req.url, req.method as MethodType);

  const userPermissions = new Set(roleToServicesMap[user.role || 'custom']);

  if (!permission || !userPermissions.has(permission)) {
    res.status(401).send(DEFAULT_UNAUTHORIZED_MESSAGE);
    return;
  }

  next();
}
