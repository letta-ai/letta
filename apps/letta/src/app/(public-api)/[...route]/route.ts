import type { NextRequest } from 'next/server';
import { verifyAndReturnAPIKeyDetails } from '$letta/server/auth';
import type { HandlerContext } from '$letta/sdk';
import { makeRequestToSDK } from '$letta/sdk';

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

  return makeRequestToSDK(req, context, keyDetails.userId);
}

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
  handler as OPTIONS,
};
