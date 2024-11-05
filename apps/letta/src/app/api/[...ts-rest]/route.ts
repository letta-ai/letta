import {
  createNextHandler,
  tsr,
  TsRestResponse,
} from '@ts-rest/serverless/next';
import { contracts } from '$letta/web-api/contracts';
import { router } from '$letta/web-api/router';
import type { GetUserDataResponse } from '$letta/server/auth';
import {
  getOrganizationFromOrganizationId,
  getUserActiveOrganizationIdOrThrow,
} from '$letta/server/auth';

const handler = createNextHandler(contracts, router, {
  basePath: '/api',
  jsonQuery: true,
  responseValidation: true,
  handlerType: 'app-router',
  requestMiddleware: [
    tsr.middleware<{ $userOverride?: GetUserDataResponse }>(async (req) => {
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
});

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
  handler as OPTIONS,
};
