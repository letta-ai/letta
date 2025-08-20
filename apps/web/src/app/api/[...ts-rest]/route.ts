import {
  createNextHandler,
  tsr,
  TsRestResponse,
} from '@ts-rest/serverless/next';
import { contracts } from '$web/web-api/contracts';
import { router } from '$web/web-api/router';
import type { GetUserDataResponse } from '$web/server/auth';
import { getUser } from '$web/server/auth';
import {
  getOrganizationFromOrganizationId,
  getUserActiveOrganizationIdOrThrow,
} from '$web/server/auth';
import { TsRestHttpError } from '@ts-rest/serverless/next';
import * as Sentry from '@sentry/node';

const publicApis = [
  new RegExp('/api/composio(.+)?'),
  new RegExp('/api/invites/(.+)?'),
  new RegExp('/api/user/new(.+)?'),
  new RegExp('/api/user/forgot-password(.+)?'),
  new RegExp('/api/verify-sso-email(.+)?'),
  new RegExp('/api/user/new-with-invite(.+)?'),
  new RegExp('/api/user/login(.+)?'),
  new RegExp('/api/feature-flags(.+)?'),
  new RegExp('/api/agentfile(.+)?'),
];

const handler = createNextHandler(contracts, router, {
  basePath: '/api',
  jsonQuery: true,
  responseValidation: false,
  cors: {
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    exposeHeaders: [],
    origin: ['http://localhost:4200'],
  },
  handlerType: 'app-router',
  requestMiddleware: [
    tsr.middleware<{ $userOverride?: GetUserDataResponse }>(async (req) => {
      if (publicApis.some((path) => new URL(req.url).pathname.match(path))) {
        return;
      }

      const user = await getUser();

      if (!user) {
        return TsRestResponse.fromJson(
          {
            message: 'Unauthorized',
          },
          { status: 401 },
        );
      }

      if (new URL(req.url).pathname.includes('admin')) {
        const organizationId = await getUserActiveOrganizationIdOrThrow();

        const organization =
          await getOrganizationFromOrganizationId(organizationId);

        if (!organization?.isAdmin) {
          return TsRestResponse.fromJson(
            {
              message: 'Unauthorized',
            },
            { status: 401 },
          );
        }
      }
    }),
  ],
  errorHandler: async (error) => {
    if (error instanceof TsRestHttpError) {
      if (error.statusCode === 500) {
        Sentry.captureException(error);
      }

      return TsRestResponse.fromJson(
        {
          message: error.message,
        },
        { status: error.statusCode },
      );
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
