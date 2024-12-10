import {
  createNextHandler,
  tsr,
  TsRestResponse,
} from '@ts-rest/serverless/next';
import { contracts } from '$letta/web-api/contracts';
import { router } from '$letta/web-api/router';
import type { GetUserDataResponse } from '$letta/server/auth';
import { getUser } from '$letta/server/auth';
import {
  getOrganizationFromOrganizationId,
  getUserActiveOrganizationIdOrThrow,
} from '$letta/server/auth';
import { TsRestHttpError } from '@ts-rest/serverless/next.cjs';
import * as Sentry from '@sentry/node';

const nonCloudWhitelist = [
  new RegExp('/api/organizations/self$'),
  new RegExp('/api/user/self(.+)?'),
  new RegExp('/api/development-servers(.+)?'),
];

const handler = createNextHandler(contracts, router, {
  basePath: '/api',
  jsonQuery: true,
  responseValidation: true,
  handlerType: 'app-router',
  requestMiddleware: [
    tsr.middleware<{ $userOverride?: GetUserDataResponse }>(async (req) => {
      const user = await getUser();

      if (!user) {
        return TsRestResponse.fromJson(
          {
            message: 'Unauthorized',
          },
          { status: 401 }
        );
      }

      if (!user?.hasCloudAccess) {
        if (
          !nonCloudWhitelist.some((path) =>
            new URL(req.url).pathname.match(path)
          )
        ) {
          return TsRestResponse.fromJson(
            {
              message: 'Unauthorized',
            },
            { status: 401 }
          );
        }
      }

      if (new URL(req.url).pathname.includes('admin')) {
        const organizationId = await getUserActiveOrganizationIdOrThrow();

        const organization = await getOrganizationFromOrganizationId(
          organizationId
        );

        if (!organization?.isAdmin) {
          return TsRestResponse.fromJson(
            {
              message: 'Unauthorized',
            },
            { status: 401 }
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
        { status: error.statusCode }
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
