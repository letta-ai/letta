import {
  createNextHandler,
  tsr,
  TsRestHttpError,
  TsRestResponse,
} from '@ts-rest/serverless/next';
import { pdkContracts } from '$letta/pdk/contracts';
import { pdkRouter } from '$letta/pdk/router';
import bcrypt from 'bcrypt';
import { parseAccessToken } from '$letta/server/auth';
import { db, lettaAPIKeys } from '@letta-web/database';
import { eq } from 'drizzle-orm';
import { V1_ROUTE } from '$letta/pdk/shared';

function isErrorResponse(error: unknown): error is TsRestHttpError {
  return error instanceof TsRestHttpError;
}

export const handler = createNextHandler(pdkContracts, pdkRouter, {
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

    return TsRestResponse.fromJson(
      {
        message: 'An error occurred',
      },
      { status: 500 }
    );
  },
  responseValidation: true,
  handlerType: 'app-router',
  requestMiddleware: [
    tsr.middleware<{ organizationId: string }>(async (request) => {
      const accessToken = request.headers
        .get('Authorization')
        ?.replace('Bearer ', '');

      if (!accessToken) {
        return TsRestResponse.fromJson(
          {
            message: 'Please include Authorization: Bearer {your-api-token}',
          },
          { status: 401 }
        );
      }

      const { organizationId, accessPassword } = await parseAccessToken(
        accessToken
      );

      const isValidUUID = /^[0-9a-fA-F]{24}$/.test(organizationId);

      if (!isValidUUID) {
        return TsRestResponse.fromJson(
          {
            message: 'Unauthorized',
          },
          { status: 401 }
        );
      }

      const key = await db.query.lettaAPIKeys.findFirst({
        where: eq(lettaAPIKeys.organizationId, organizationId),
        columns: {
          apiKey: true,
        },
      });

      if (!key) {
        return TsRestResponse.fromJson(
          {
            message: 'Unauthorized',
          },
          { status: 401 }
        );
      }

      try {
        await new Promise((resolve, reject) =>
          bcrypt.compare(accessPassword, key.apiKey, function (_err, isValid) {
            if (isValid) {
              resolve(true);

              return;
            }

            reject(isValid);
          })
        );
      } catch (_err) {
        return TsRestResponse.fromJson(
          {
            message: 'Unauthorized',
          },
          { status: 401 }
        );
      }

      request.organizationId = organizationId;
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
