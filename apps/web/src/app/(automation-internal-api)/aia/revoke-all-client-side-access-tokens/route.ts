import { db, clientSideAccessTokens } from '@letta-cloud/service-database';
import { getUserActiveOrganizationIdOrThrow } from '$web/server/auth';
import { eq } from 'drizzle-orm';

export async function POST() {
  const organizationId = await getUserActiveOrganizationIdOrThrow();

  await db
    .delete(clientSideAccessTokens)
    .where(eq(clientSideAccessTokens.organizationId, organizationId));

  return new Response('Client-side access token revoked successfully', {
    status: 200,
  });
}
