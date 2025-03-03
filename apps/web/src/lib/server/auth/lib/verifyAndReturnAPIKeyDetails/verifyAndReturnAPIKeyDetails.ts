import { parseAccessToken } from '$web/server/auth/lib/parseAccessToken/parseAccessToken';
import { backfillCoreUserIdToApiKeyFn } from '$web/server/auth';
import { getRedisData } from '@letta-cloud/service-redis';

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

  const key = await getRedisData('apiKeys', {
    apiKey: apiKey,
    organizationId: organizationId,
  });

  if (!key) {
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
