import {
  createNextHandler,
  tsr,
  TsRestHttpError,
  TsRestResponse,
} from '@ts-rest/serverless/next';
import { pdkContracts } from '$letta/pdk/contracts';
import { pdkRouter } from '$letta/pdk/router';
import { verifyAndReturnAPIKeyDetails } from '$letta/server/auth';
import { V1_ROUTE } from '$letta/pdk/shared';
import * as Sentry from '@sentry/node';

function isErrorResponse(error: unknown): error is TsRestHttpError {
  return error instanceof TsRestHttpError;
}

const handler = createNextHandler(pdkContracts, pdkRouter, {
  basePath: V1_ROUTE,
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
    tsr.middleware<{ organizationId: string }>(async (request) => {
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
