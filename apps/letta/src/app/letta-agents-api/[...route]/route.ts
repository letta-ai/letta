import type { NextRequest } from 'next/server';
import { getUser } from '$letta/server/auth';
import type { HandlerContext } from '$letta/sdk';
import { makeRequestToSDK } from '$letta/sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handler(req: NextRequest, context: HandlerContext) {
  const user = await getUser();

  if (!user) {
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

  return makeRequestToSDK(req, context, user.id);
}

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
  handler as OPTIONS,
};
