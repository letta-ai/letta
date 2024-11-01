import {
  createNextHandler,
  tsr,
  TsRestHttpError,
  TsRestResponse,
} from '@ts-rest/serverless/next';
import { getUser, verifyAndReturnAPIKeyDetails } from '$letta/server/auth';
import type { RequestMiddlewareType } from '$letta/sdk/shared';
import { db, users } from '@letta-web/database';
import { eq } from 'drizzle-orm';
import { isErrorResponse } from '@ts-rest/core';
import * as Sentry from '@sentry/node';
import { makeRequestToSDK } from '$letta/sdk';
import { sdkRouter } from '$letta/sdk/router';
import { sdkContracts } from '$letta/sdk/contracts';

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
              organizationId: true,
              id: true,
            },
          });

          middlewareData.lettaAgentsUserId = response?.lettaAgentsId || '';
        }
      } else {
        const user = await getUser();

        middlewareData.organizationId = user?.organizationId || '';
        middlewareData.userId = user?.id || '';
        middlewareData.lettaAgentsUserId = user?.lettaAgentsId || '';
      }

      if (!middlewareData.userId) {
        return new Response(JSON.stringify({ message: 'Unauthorized' }), {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }

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
    if (error instanceof TsRestHttpError) {
      if (error.statusCode !== 404) {
        return TsRestResponse.fromJson(
          {
            message: error.message,
          },
          { status: error.statusCode }
        );
      }

      const url = new URL(req.url);

      const response = await makeRequestToSDK({
        method: req.method,
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
      return TsRestResponse.fromJson(error, { status: error.status || 500 });
    }

    const errorId = Sentry.captureException(error);

    console.error('Unhandled error', error);

    return TsRestResponse.fromJson(
      {
        message: 'An unhandled error has happened, feel free to report.',
        errorId,
      },
      { status: 500 }
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
