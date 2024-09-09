import { createNextHandler } from '@ts-rest/serverless/next';
import { contracts } from '$letta/any/contracts';
import { router } from '$letta/server/router';

const handler = createNextHandler(contracts, router, {
  basePath: '/api',
  jsonQuery: true,
  responseValidation: true,
  handlerType: 'app-router',
});

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
  handler as OPTIONS,
};
