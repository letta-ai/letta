import type { NextFunction, Request, Response } from 'express';
import { getRedisData } from '@letta-cloud/service-redis';
import { z } from 'zod';
import type { ActorIdentity } from '../../types';
import { verifyAndReturnAPIKeyDetails } from '@letta-cloud/utils-server';
import { findOrCreateUserAndOrganizationFromProviderLogin } from '@letta-cloud/service-auth';
import { DEFAULT_UNAUTHORIZED_MESSAGE } from '../constants';

const publicRoutes = [
  new RegExp('/v1/heath'),
  new RegExp('/stripe/webhook'),
  new RegExp('favicon.ico'),
];

const cookieSessionSchema = z.object({
  sessionId: z.string(),
  expires: z.number(),
});

async function verifyIfUserIsLoggedInViaCookies(
  req: Request,
): Promise<ActorIdentity | null> {
  const session =
    req.cookies?.['__CLOUD_API_SESSION__'] ||
    req.cookies?.['__LETTA_SESSION__'];

  if (!session) {
    return null;
  }

  let parsedJson: JSON;

  try {
    parsedJson = JSON.parse(session);
  } catch (_e) {
    return null;
  }

  const res = cookieSessionSchema.safeParse(parsedJson);

  if (!res.success) {
    return null;
  }

  const user = await getRedisData('userSession', {
    sessionId: res.data.sessionId,
  });

  if (!user) {
    return null;
  }

  return {
    cloudOrganizationId: user.activeOrganizationId,
    coreUserId: user.coreUserId,
    cloudUserId: user.id,
    source: 'web',
  };
}

async function verifyIfUserAccessTokenIsValid(
  req: Request,
): Promise<ActorIdentity | null> {
  const authorization = req.header('Authorization');

  if (typeof authorization !== 'string') {
    return null;
  }

  const apiKey = authorization.replace('Bearer ', '');

  const apiKeyResponse = await verifyAndReturnAPIKeyDetails({
    apiKey,
    resource: {
      pathname: req.path,
      method: req.method,
    },
  });

  if (!apiKeyResponse) {
    return null;
  }

  return {
    cloudOrganizationId: apiKeyResponse.organizationId,
    coreUserId: apiKeyResponse.coreUserId,
    cloudUserId: apiKeyResponse.userId,
    whitelistedHostname: apiKeyResponse.hostname,
    source: 'api',
  };
}

async function handleFakeUser(req: Request) {
  if (!process.env.USE_FAKE_USER) {
    return false;
  }

  const user = await findOrCreateUserAndOrganizationFromProviderLogin({
    provider: 'google',
    email: 'api-tester@letta.com',
    skipOnboarding: true,
    isVerified: true,
    name: 'API tester',
    uniqueId: 'apitester',
    imageUrl: '',
  });

  if (!user) {
    throw new Error('Failed to create fake user');
  }

  req.actor = {
    cloudOrganizationId: user.user.activeOrganizationId,
    coreUserId: user.user.coreUserId,
    cloudUserId: user.user.id,
    source: 'api',
  };

  req.headers['user_id'] = req.actor.coreUserId;

  return true;
}

export async function verifyIdentityMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.path === '/' || publicRoutes.some((route) => route.test(req.path))) {
    next();
    return;
  }

  const fakeUserData = await handleFakeUser(req);

  if (fakeUserData) {
    next();
    return;
  }

  const apiKeyData = await verifyIfUserAccessTokenIsValid(req);

  if (apiKeyData) {
    req.actor = apiKeyData;
    req.headers['user_id'] = req.actor.coreUserId;

    if (req.actor.whitelistedHostname) {
      // attach cors headers
      res.setHeader(
        'Access-Control-Allow-Origin',
        req.actor.whitelistedHostname,
      );
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }

    next();
    return;
  }

  const cookieData = await verifyIfUserIsLoggedInViaCookies(req);

  if (!req.header('Authorization') && cookieData) {
    req.actor = cookieData;
    req.headers['user_id'] = req.actor.coreUserId;

    next();
    return;
  }

  res.status(401).send(DEFAULT_UNAUTHORIZED_MESSAGE);
}
