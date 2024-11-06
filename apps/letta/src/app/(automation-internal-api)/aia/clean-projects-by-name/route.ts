import type { NextRequest } from 'next/server';
import { getUserActiveOrganizationIdOrThrow } from '$letta/server/auth';
import * as process from 'node:process';
import { db, projects } from '@letta-web/database';
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
    .delete(projects)
    .where(
      and(eq(projects.name, name), eq(projects.organizationId, organizationId))
    )
    .execute();

  return new Response(
    JSON.stringify({
      message: 'Projects deleted',
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}
