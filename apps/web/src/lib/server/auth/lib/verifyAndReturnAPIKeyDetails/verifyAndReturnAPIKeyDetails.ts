import { db, lettaAPIKeys } from '@letta-web/database';
import { and, eq, isNull } from 'drizzle-orm';
import { parseAccessToken } from '$web/server/auth/lib/parseAccessToken/parseAccessToken';

export async function verifyAndReturnAPIKeyDetails(apiKey?: string) {
  if (!apiKey) {
    return null;
  }

  let organizationId = '';

  try {
    const { organizationId: orgId } = await parseAccessToken(apiKey);
    organizationId = orgId;
  } catch (_e) {
    return null;
  }

  const key = await db.query.lettaAPIKeys.findFirst({
    where: and(
      eq(lettaAPIKeys.apiKey, apiKey),
      eq(lettaAPIKeys.organizationId, organizationId),
      isNull(lettaAPIKeys.deletedAt),
    ),
    columns: {
      organizationId: true,
      userId: true,
    },
  });

  if (!key) {
    return null;
  }

  return key;
}
