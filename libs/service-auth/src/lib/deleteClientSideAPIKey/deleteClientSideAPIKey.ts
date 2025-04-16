import { clientSideAccessTokens, db } from '@letta-cloud/service-database';
import { and, eq } from 'drizzle-orm';

interface DeleteClientSideAPIOptions {
  token: string;
  organizationId: string;
}

export async function deleteClientSideAPIKey(
  options: DeleteClientSideAPIOptions,
) {
  const { token, organizationId } = options;

  await db
    .delete(clientSideAccessTokens)
    .where(
      and(
        eq(clientSideAccessTokens.token, token),
        eq(clientSideAccessTokens.organizationId, organizationId),
      ),
    );
}
