import type { NextRequest } from 'next/server';
import { verifyAndReturnAPIKeyDetails } from '$letta/server/auth';
import type { HandlerContext } from '$letta/sdk';
import { makeRequestToSDK } from '$letta/sdk';
import { eq } from 'drizzle-orm';
import { users } from '@letta-web/database';

async function handler(req: NextRequest, context: HandlerContext) {
  const apiKey = req.headers.get('Authorization')?.replace('Bearer ', '');

  const keyDetails = await verifyAndReturnAPIKeyDetails(apiKey);

  if (!keyDetails) {
    return new Response(
      JSON.stringify({
        message: 'Unauthorized',
      }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  const response = await db.query.users.findFirst({
    where: eq(users.id, keyDetails.userId),
    columns: {
      lettaAgentsId: true,
    },
  });

  if (!response) {
    return new Response(
      JSON.stringify({
        message: 'Unauthorized',
      }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  return makeRequestToSDK(req, context, response.lettaAgentsId);
}

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
  handler as OPTIONS,
};
