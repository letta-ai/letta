import {
  createNextHandler,
  tsr,
  TsRestHttpError,
  TsRestResponse,
} from '@ts-rest/serverless/next';
import type { TsRestRequest } from '@ts-rest/serverless/next';
import { getUser } from '$web/server/auth';
import type { RequestMiddlewareType } from '$web/sdk/shared';
import { isErrorResponse } from '@ts-rest/core';
import * as Sentry from '@sentry/node';
import { makeRequestToSDK } from '$web/sdk';
import { cloudContracts } from '@letta-cloud/sdk-cloud-api';
import { getAPIStabilityTestingUser } from '$web/server/lib/getAPIStabilityTestingUser/getAPIStabilityTestingUser';
import { getPermissionForSDKPath } from '@letta-cloud/utils-server';
import type { MethodType } from '@letta-cloud/utils-server';
import { getSharedChatConfigurationIfUserHasAccess } from '$web/server/lib/getSharedChatConfigurationIfUserHasAccess/getSharedChatConfigurationIfUserHasAccess';
import { getOrganizationLettaServiceAccountId } from '$web/server/lib/getOrganizationLettaServiceAccountId/getOrganizationLettaServiceAccountId';
import { postDeleteIdentitySideEffect } from '$web/sdk/utils/postDeleteIdentitySideEffect';
import { verifyAndReturnAPIKeyDetails } from '@letta-cloud/utils-server';
import { cloudApiRouter } from 'tmp-cloud-api-router';

const agentUrlRegex = new RegExp('/agents/([A-Za-z0-9-]+)/');

async function handleChatMiddleware(
  req: RequestMiddlewareType & TsRestRequest,
) {
  const path = req.headers.get('X-SOURCE-CLIENT');

  if (!(path?.startsWith('/chat') && agentUrlRegex.test(req.url))) {
    return false;
  }

  // get agentId from path
  const agentId = agentUrlRegex.exec(req.url)?.[1] || '';

  if (!agentId) {
    return false;
  }

  const canAccess = await getSharedChatConfigurationIfUserHasAccess({
    agentId,
    organizationId: req.organizationId,
    userId: req.userId,
  });

  if (!canAccess) {
    return false;
  }

  const serviceAccount = await getOrganizationLettaServiceAccountId(
    canAccess.organizationId,
  );

  if (!serviceAccount) {
    return false;
  }

  req.lettaAgentsUserId = serviceAccount;
  req.organizationId = canAccess.organizationId;
  req.userId = '';

  return true;
}

const publicHandler = createNextHandler(cloudContracts, cloudApiRouter, {
  basePath: '',
  jsonQuery: true,
  responseValidation: false,
  handlerType: 'app-router',
  cors: {
    origin: '*',
  },
  requestMiddleware: [
    tsr.middleware<RequestMiddlewareType>(async (req) => {
      if (process.env.IS_API_STABILITY_TEST === 'yes') {
        const user = await getAPIStabilityTestingUser();

        if (!user) {
          return TsRestResponse.fromJson(
            {
              message: 'Something went wrong',
            },
            { status: 500 },
          );
        }

        req.source = 'api';
        req.organizationId = user.activeOrganizationId || '';
        req.lettaAgentsUserId = user.lettaAgentsId;
        req.userId = user.id;
        return;
      }

      const apiKey = req.headers.get('Authorization')?.replace('Bearer ', '');

      const middlewareData: RequestMiddlewareType = {
        userId: '',
        organizationId: '',
        lettaAgentsUserId: '',
        source: 'api',
      };

      if (apiKey) {
        const url = new URL(req.url);

        const apiKeyResponse = await verifyAndReturnAPIKeyDetails({
          apiKey,
          resource: {
            pathname: url.pathname,
            method: req.method,
          },
        });

        if (apiKeyResponse) {
          if (apiKeyResponse.hostname) {
            // add CORS headers
            req.headers.set(
              'Access-Control-Allow-Origin',
              apiKeyResponse.hostname,
            );
            req.headers.set('Access-Control-Allow-Credentials', 'true');
            req.headers.set('Access-Control-Allow-Headers', 'Authorization');
            req.headers.set(
              'Access-Control-Allow-Methods',
              'GET, POST, PUT, DELETE',
            );
            req.headers.set('Access-Control-Max-Age', '86400');
          }

          middlewareData.organizationId = apiKeyResponse?.organizationId || '';
          middlewareData.userId = apiKeyResponse?.userId || '';
          middlewareData.lettaAgentsUserId = apiKeyResponse.coreUserId || '';
        }
      } else {
        const user = await getUser();
        middlewareData.source = 'web';
        middlewareData.organizationId = user?.activeOrganizationId || '';
        middlewareData.userId = user?.id || '';
        middlewareData.lettaAgentsUserId = user?.lettaAgentsId || '';

        if (await handleChatMiddleware(req)) {
          return;
        }

        if (!user?.hasCloudAccess) {
          return new Response(JSON.stringify({ message: 'Unauthorized' }), {
            status: 401,
            headers: {
              'Content-Type': 'application/json',
            },
          });
        }

        const permission = getPermissionForSDKPath(
          req.url,
          req.method as MethodType,
        );

        if (!permission || !user.permissions.has(permission)) {
          return new Response(JSON.stringify({ message: 'Unauthorized' }), {
            status: 401,
            headers: {
              'Content-Type': 'application/json',
            },
          });
        }
      }

      if (!middlewareData.userId || !middlewareData.organizationId) {
        return new Response(JSON.stringify({ message: 'Unauthorized' }), {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }

      req.source = middlewareData.source;
      req.organizationId = middlewareData.organizationId;
      req.lettaAgentsUserId = middlewareData.lettaAgentsUserId;
      req.userId = middlewareData.userId;
      const projectHeader = req.headers.get('X-Project');
      if (projectHeader) {
        req.headers['x-project'] = projectHeader;
      }

      if (!req.lettaAgentsUserId) {
        return new Response(JSON.stringify({ message: 'Unauthorized' }), {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }
    }),
  ],
  // @ts-expect-error - this is a middleware
  errorHandler: async (error, req) => {
    if (error instanceof Error) {
      if (error.message === 'Unexpected end of JSON input') {
        return TsRestResponse.fromJson(
          {
            message:
              'Invalid JSON body, please fix your body payload or change content type to something other than application/json',
          },
          { status: 400 },
        );
      }
    }

    if (error instanceof TsRestHttpError) {
      if (error.statusCode !== 404) {
        if (error.statusCode >= 500) {
          Sentry.captureException(error);
        }

        return TsRestResponse.fromJson(
          {
            message: error.message,
          },
          { status: error.statusCode },
        );
      }

      const url = new URL(req.url);

      const response = await makeRequestToSDK({
        method: req.method,
        // @ts-expect-error - this is a middleware
        source: req.source,
        body: req.content,
        formData: req.headers.get('Content-Type')?.includes('multipart')
          ? await req.formData()
          : undefined,
        // @ts-expect-error - this is a middleware
        lettaAgentsUserId: req.lettaAgentsUserId,
        headers: req.headers,
        pathname: url.pathname,
        query: url.searchParams,
        signal: req.signal,
        // @ts-expect-error - this is a middleware
        organizationId: req.organizationId,
      });

      void postDeleteIdentitySideEffect(url.pathname, req.method);

      return response;
    }

    if (isErrorResponse(error)) {
      const statusCode = error.status || 500;

      if ([500, 502].includes(statusCode)) {
        Sentry.captureException(error);
      }

      return TsRestResponse.fromJson(error, { status: statusCode });
    }

    const errorId = Sentry.captureException(error);
    console.error(error);

    console.error('Unhandled error', error);

    return TsRestResponse.fromJson(
      {
        message: 'An unhandled error has happened, feel free to report.',
        errorId,
      },
      { status: 500 },
    );
  },
});

export {
  publicHandler as GET,
  publicHandler as POST,
  publicHandler as PUT,
  publicHandler as PATCH,
  publicHandler as DELETE,
  publicHandler as OPTIONS,
};
