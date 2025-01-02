import {
  createNextHandler,
  tsr,
  TsRestHttpError,
  TsRestResponse,
} from '@ts-rest/serverless/next';
import { getUser, verifyAndReturnAPIKeyDetails } from '$web/server/auth';
import type { RequestMiddlewareType } from '$web/sdk/shared';
import { db, users } from '@letta-web/database';
import { eq } from 'drizzle-orm';
import { isErrorResponse } from '@ts-rest/core';
import * as Sentry from '@sentry/node';
import { makeRequestToSDK } from '$web/sdk';
import { sdkRouter } from '$web/sdk/router';
import { sdkContracts } from '@letta-web/letta-agents-api';

const handler = createNextHandler(sdkContracts, sdkRouter, {
  basePath: '',
  jsonQuery: true,
  responseValidation: false,
  handlerType: 'app-router',
  requestMiddleware: [
    tsr.middleware<RequestMiddlewareType>(async (req) => {
      const apiKey = req.headers.get('Authorization')?.replace('Bearer ', '');

      const middlewareData: RequestMiddlewareType = {
        userId: '',
        organizationId: '',
        lettaAgentsUserId: '',
        source: 'api',
      };

      if (apiKey) {
        const apiKeyResponse = await verifyAndReturnAPIKeyDetails(apiKey);

        if (apiKeyResponse) {
          middlewareData.organizationId = apiKeyResponse?.organizationId || '';
          middlewareData.userId = apiKeyResponse?.userId || '';

          const response = await db.query.users.findFirst({
            where: eq(users.id, middlewareData.userId),
            columns: {
              lettaAgentsId: true,
              activeOrganizationId: true,
              id: true,
            },
            with: {
              activeOrganization: {
                columns: {
                  enabledCloudAt: true,
                },
              },
            },
          });

          if (!response?.activeOrganization?.enabledCloudAt) {
            return new Response(JSON.stringify({ message: 'Unauthorized' }), {
              status: 401,
              headers: {
                'Content-Type': 'application/json',
              },
            });
          }

          middlewareData.lettaAgentsUserId = response?.lettaAgentsId || '';
        }
      } else {
        const user = await getUser();

        if (!user?.hasCloudAccess) {
          return new Response(JSON.stringify({ message: 'Unauthorized' }), {
            status: 401,
            headers: {
              'Content-Type': 'application/json',
            },
          });
        }

        middlewareData.source = 'web';
        middlewareData.organizationId = user?.activeOrganizationId || '';
        middlewareData.userId = user?.id || '';
        middlewareData.lettaAgentsUserId = user?.lettaAgentsId || '';
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
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
  handler as OPTIONS,
};
