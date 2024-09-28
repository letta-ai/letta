import type { NextRequest } from 'next/server';
import type { HandlerContext } from '$letta/sdk';
import { makeRequestToSDK } from '$letta/sdk';
import { verifyAndReturnAPIKeyDetails } from '$letta/server/auth';
import { db, users } from '@letta-web/database';
import { eq } from 'drizzle-orm';
import { generateStandardUnauthorizedResponse } from '$letta/sdk/generateStandardUnauthorizedResponse';

export async function defaultValidatePublicAPIHandler(req: NextRequest) {
  const apiKey = req.headers.get('Authorization')?.replace('Bearer ', '');

  const keyDetails = await verifyAndReturnAPIKeyDetails(apiKey);

  if (!keyDetails) {
    return null;
  }

  const response = await db.query.users.findFirst({
    where: eq(users.id, keyDetails.userId),
    columns: {
      lettaAgentsId: true,
      organizationId: true,
      id: true,
    },
  });

  if (!response) {
    return null;
  }

  return response;
}

export async function defaultPublicAPIHandler(
  req: NextRequest,
  context: HandlerContext
) {
  const response = await defaultValidatePublicAPIHandler(req);

  if (!response?.lettaAgentsId) {
    return generateStandardUnauthorizedResponse();
  }

  return makeRequestToSDK(req, context, response.lettaAgentsId);
}
