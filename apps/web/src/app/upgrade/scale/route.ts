import { createScalePaymentLink } from '@letta-cloud/service-payments';
import { NextResponse } from 'next/server';
import { getUserWithActiveOrganizationIdOrThrow } from '$web/server/auth';

export async function GET() {
  const user = await getUserWithActiveOrganizationIdOrThrow();

  if (!user) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
      },
      {
        status: 401,
      },
    );
  }

  const paymentLink = await createScalePaymentLink(user.activeOrganizationId);

  if (!paymentLink) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_CURRENT_HOST}/settings/organization/usage`,
      302,
    );
  }

  return NextResponse.redirect(paymentLink, 302);
}

export const dynamic = 'force-dynamic';

export const revalidate = 0;
