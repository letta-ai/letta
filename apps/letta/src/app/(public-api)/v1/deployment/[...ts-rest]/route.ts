import {
  createNextHandler,
  tsr,
  TsRestHttpError,
  TsRestResponse,
} from '@ts-rest/serverless/next';
import { sdkContracts } from '$letta/sdk/contracts';
import { sdkRouter } from '$letta/sdk/router';
import { verifyAndReturnAPIKeyDetails } from '$letta/server/auth';
import type { RequestMiddlewareType } from '$letta/sdk/shared';
import { DEPLOYMENT_BASE_URL } from '$letta/sdk/shared';
import * as Sentry from '@sentry/node';

function isErrorResponse(error: unknown): error is TsRestHttpError {
  return error instanceof TsRestHttpError;
}

const handler = createNextHandler(sdkContracts, sdkRouter, {
  basePath: DEPLOYMENT_BASE_URL,
  jsonQuery: true,
  errorHandler: (error) => {
    if (isErrorResponse(error)) {
      if (error.statusCode === 404 && !error.body) {
        return TsRestResponse.fromJson(
          {
            message: 'Not found',
          },
          { status: 404 }
        );
      }

      return TsRestResponse.fromJson(
        {
          message: error.body.message,
        },
        { status: error.statusCode }
      );
    }
    if (error instanceof SyntaxError) {
      return TsRestResponse.fromJson(
        {
          message:
            'Invalid syntax in request body. This is usually caused by invalid JSON.',
        },
        { status: 400 }
      );
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
  responseValidation: true,
  handlerType: 'app-router',
  requestMiddleware: [
    tsr.middleware<RequestMiddlewareType>(async (request) => {
      const apiKey = request.headers
        .get('Authorization')
        ?.replace('Bearer ', '');

      const keyDetails = await verifyAndReturnAPIKeyDetails(apiKey);

      if (!keyDetails) {
        return TsRestResponse.fromJson(
          {
            message: 'Unauthorized',
          },
          { status: 401 }
        );
      }

      request.organizationId = keyDetails.organizationId;
      request.userId = keyDetails.userId;
    }),
  ],
});

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
  handler as OPTIONS,
};
