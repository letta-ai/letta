import { getUserActiveOrganizationIdOrThrow } from '$web/server/auth';
import * as process from 'node:process';
import { db, organizations } from '@letta-cloud/service-database';

export async function POST() {
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
      },
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
      },
    );
  }

  await db.update(organizations).set({
    isAdmin: true,
  });

  return new Response(
    JSON.stringify({
      message: 'Admin granted',
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );
}
