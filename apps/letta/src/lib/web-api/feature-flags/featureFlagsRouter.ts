import type { contracts } from '$letta/web-api/contracts';
import type { ServerInferResponses } from '@ts-rest/core';
import { getOrganizationFromOrganizationId, getUser } from '$letta/server/auth';
import {
  type FlagMap,
  getDefaultFlags,
  getOrganizationFeatureFlags,
} from '@letta-web/feature-flags';

type FeatureFlagsResponse = ServerInferResponses<
  typeof contracts.featureFlags.getFeatureFlags
>;

let flagOverrides: Partial<FlagMap> = {};

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

  if (process.env.NODE_ENV !== 'production') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports,@typescript-eslint/no-var-requires
      flagOverrides = require('../../../../flag.overrides.json');
    } catch (_e) {
      //
    }
  }

  return {
    status: 200,
    body: {
      ...flags,
      ...flagOverrides,
    },
  };
}

export const featureFlagsRouter = {
  getFeatureFlags,
};
