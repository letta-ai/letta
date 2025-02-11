import type { NextRequest } from 'next/server';
import { getUserActiveOrganizationIdOrThrow } from '$web/server/auth';
import * as process from 'node:process';
import { db, organizationCredits } from '@letta-cloud/database';
import { eq } from 'drizzle-orm';
import {
  addCreditsToOrganization,
  removeCreditsFromOrganization,
} from '@letta-cloud/server-utils';

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

  const { nextCredits } = await req.json();

  const currentOrganizationCredits =
    await db.query.organizationCredits.findFirst({
      where: eq(organizationCredits.organizationId, organizationId),
      with: {
        organization: true,
      },
    });

  if (!currentOrganizationCredits) {
    return new Response(
      JSON.stringify({
        message: 'Organization not found',
      }),
      {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  }

  const orgCredits = parseInt(currentOrganizationCredits.credits, 10);

  if (orgCredits > 0) {
    await removeCreditsFromOrganization({
      note: 'E2E test reset credits',
      amount: orgCredits,
      source: 'e2e',
      coreOrganizationId: currentOrganizationCredits.organization.lettaAgentsId,
    });
  } else if (orgCredits < 0) {
    await addCreditsToOrganization({
      note: 'E2E test reset credits',
      amount: Math.abs(orgCredits),
      source: 'reset-credits',
      organizationId: currentOrganizationCredits.organizationId,
    });
  }

  if (nextCredits) {
    if (nextCredits > 0) {
      await addCreditsToOrganization({
        note: 'E2E test set credits',
        amount: nextCredits,
        source: 'e2e',
        organizationId: currentOrganizationCredits.organizationId,
      });
    } else if (nextCredits < 0) {
      await removeCreditsFromOrganization({
        note: 'E2E test set credits',
        amount: Math.abs(nextCredits),
        source: 'e2e',
        coreOrganizationId:
          currentOrganizationCredits.organization.lettaAgentsId,
      });
    }
  }

  return new Response(
    JSON.stringify({
      message: 'Projects deleted',
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );
}
