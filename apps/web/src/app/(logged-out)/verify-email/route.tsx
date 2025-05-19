import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getRedisData } from '@letta-cloud/service-redis';
import { db, users, verifiedEmail } from '@letta-cloud/service-database';
import { eq } from 'drizzle-orm';
import { checkIfUserIsAllVerified } from '@letta-cloud/utils-server';
import { environment } from '@letta-cloud/config-environment-variables';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const code = url.searchParams.get('code');
  const email = url.searchParams.get('email');

  if (!code || !email) {
    return new Response('Missing code or email', { status: 400 });
  }

  const emailTotp = await getRedisData('emailTotp', {
    email: decodeURIComponent(email),
  });

  if (!emailTotp) {
    return NextResponse.redirect(
      `${environment.NEXT_PUBLIC_CURRENT_HOST}/verify-email/failed`,
    );
  }

  if (emailTotp.code !== code) {
    return NextResponse.redirect(
      `${environment.NEXT_PUBLIC_CURRENT_HOST}/verify-email/failed`,
    );
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!user) {
    return NextResponse.redirect(
      `${environment.NEXT_PUBLIC_CURRENT_HOST}/verify-email/failed`,
    );
  }

  await db.insert(verifiedEmail).values({
    userId: user.id,
    email: user.email,
  });

  await checkIfUserIsAllVerified(user.id);

  return NextResponse.redirect(
    `${environment.NEXT_PUBLIC_CURRENT_HOST}/verify-email/complete`,
  );
}
