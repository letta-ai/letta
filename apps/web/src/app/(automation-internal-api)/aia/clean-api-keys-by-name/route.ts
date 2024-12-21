import type { NextRequest } from 'next/server';
import { getUserActiveOrganizationIdOrThrow } from '$web/server/auth';
import * as process from 'node:process';
import { db, lettaAPIKeys } from '@letta-web/database';
import { and, eq } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  const organizationId = await getUserActiveOrganizationIdOrThrow();

  if (
    !(
      process.env.IS_CYPRESS_RUN === 'yes' ||
      process.env.NODE_ENV !== 'production'
    )
  ) {
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

  if (!organizationId) {
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

  const { name } = await req.json();

  await db
    .delete(lettaAPIKeys)
    .where(
      and(
        eq(lettaAPIKeys.name, name),
        eq(lettaAPIKeys.organizationId, organizationId)
      )
    )
    .execute();

  return new Response(
    JSON.stringify({
      message: 'API Key deleted',
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}
