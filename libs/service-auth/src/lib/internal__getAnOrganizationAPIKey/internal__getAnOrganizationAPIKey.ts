import { db, lettaAPIKeys } from '@letta-cloud/service-database';
import { eq } from 'drizzle-orm';

// eslint-disable-next-line @typescript-eslint/naming-convention
export async function internal__getAnOrganizationAPIKey(
  organizationId: string,
) {
  const apiKey = await db.query.lettaAPIKeys.findFirst({
    where: eq(lettaAPIKeys.organizationId, organizationId),
  });

  return apiKey;
}
