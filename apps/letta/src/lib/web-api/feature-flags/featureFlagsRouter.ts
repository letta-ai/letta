import type { contracts } from '$letta/web-api/contracts';
import type { ServerInferResponses } from '@ts-rest/core';
import { getOrganizationFromOrganizationId, getUser } from '$letta/server/auth';
import {
  getDefaultFlags,
  getOrganizationFeatureFlags,
} from '@letta-web/feature-flags';

type FeatureFlagsResponse = ServerInferResponses<
  typeof contracts.featureFlags.getFeatureFlags
>;

async function getFeatureFlags(): Promise<FeatureFlagsResponse> {
  const user = await getUser();

  let flags: Record<string, any> | undefined;

  if (user?.activeOrganizationId) {
    const org = await getOrganizationFromOrganizationId(
      user.activeOrganizationId
    );

    if (org) {
      flags = await getOrganizationFeatureFlags(org);
    }
  }

  if (!flags) {
    flags = await getDefaultFlags();
  }

  return {
    status: 200,
    body: flags,
  };
}

export const featureFlagsRouter = {
  getFeatureFlags,
};
