import type { contracts } from '$letta/web-api/contracts';
import type { ServerInferResponses } from '@ts-rest/core';
import { getUser } from '$letta/server/auth';
import { getDefaultFlags, getUserFlags } from '@letta-web/feature-flags';

type FeatureFlagsResponse = ServerInferResponses<
  typeof contracts.featureFlags.getFeatureFlags
>;

export async function getFeatureFlags(): Promise<FeatureFlagsResponse> {
  const user = await getUser();

  let flags: Record<string, any>;

  if (!user) {
    flags = await getDefaultFlags();
  } else {
    flags = await getUserFlags({
      userId: user.id,
    });
  }

  return {
    status: 200,
    body: flags,
  };
}
