import { db, lettaAPIKeys } from '@letta-cloud/database';
import { and, eq, isNull } from 'drizzle-orm';
import { parseAccessToken } from '$web/server/auth/lib/parseAccessToken/parseAccessToken';
import { backfillCoreUserIdToApiKeyFn } from '$web/server/auth';

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
      coreUserId: true,
      userId: true,
    },
    with: {
      organization: {
        columns: {
          enabledCloudAt: true,
        },
      },
    },
  });

  if (!key) {
    return null;
  }

  if (!key.organization.enabledCloudAt) {
    return null;
  }

  if (!key.coreUserId) {
    key.coreUserId = await backfillCoreUserIdToApiKeyFn({
      apiKey,
      organizationId,
    });
  }

  return key;
}
