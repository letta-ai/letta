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
  responseValidation: true,
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

        console.log('a', apiKeyResponse);
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

      req.content = middlewareData;
      req.organizationId = middlewareData.organizationId;
      req.lettaAgentsUserId = middlewareData.lettaAgentsUserId;
      req.userId = middlewareData.userId;
    }),
  ],
  errorHandler: async (error, req) => {
    if (error instanceof TsRestHttpError) {
      let body: object | undefined = undefined;
      let formData: FormData | undefined = undefined;
      const url = new URL(req.url);

      try {
        body = await req.json();
      } catch (_e) {
        //
      }

      try {
        formData = await req.formData();
      } catch (_e) {
        //
      }

      const response = await makeRequestToSDK({
        method: req.method,
        body,
        formData,
        lettaAgentsUserId: req.content.lettaAgentsUserId,
        headers: req.headers,
        pathname: url.pathname,
        query: url.searchParams,
        signal: req.signal,
      });

      return TsRestResponse.fromText(await response.text(), {
        status: response.status,
        headers: response.headers,
      });
    }

    if (isErrorResponse(error)) {
      return TsRestResponse.fromJson(error, { status: error.status || 500 });
    }

    const errorId = Sentry.captureException(error);

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
