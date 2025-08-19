import type { contracts } from '$web/web-api/contracts';
import type { ServerInferResponses } from '@ts-rest/core';
import { getOrganizationFromOrganizationId, getUser } from '$web/server/auth';
import {
  featureFlags,
  type FlagMap,
  getDefaultFlags,
  getLettaUserFeatureFlags,
  getOrganizationFeatureFlags,
  isLettaEmail,
} from '@letta-cloud/service-feature-flags';

type FeatureFlagsResponse = ServerInferResponses<
  typeof contracts.featureFlags.getFeatureFlags
>;

let flagOverrides: Partial<FlagMap> = {};

function flagIsValid(flag: string): flag is keyof FlagMap {
  return flag in featureFlags;
}

async function getFeatureFlags(): Promise<FeatureFlagsResponse> {
  let userFlags = {};
  let orgFlags = {};

  const [user, defaultFlags] = await Promise.all([
    getUser(),
    getDefaultFlags(),
  ]);

  if (user?.email && isLettaEmail(user.email)) {
    userFlags = await getLettaUserFeatureFlags(user);
  }

  if (user?.activeOrganizationId) {
    const org = await getOrganizationFromOrganizationId(
      user.activeOrganizationId,
    );
    if (org) {
      orgFlags = await getOrganizationFeatureFlags(org);
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    try {

      flagOverrides = require('../../../../flag.overrides.json');
    } catch (_e) {
      // Ignore errors
    }
  }

  const final = {
    ...defaultFlags,
    ...orgFlags,
    ...userFlags,
    ...flagOverrides,
  };

  const body = Object.entries(final).reduce(
    (acc, [flag, flagData]) => {
      if (flagIsValid(flag)) {
        const out = featureFlags[flag].flagValue.safeParse(flagData);

        if (out.success) {
          return {
            ...acc,
            [flag]: out.data,
          };
        }

        return acc;
      }

      return acc;
    },
    {} as Record<string, any>,
  );

  return {
    status: 200,
    body: body,
  };
}

export const featureFlagsRouter = {
  getFeatureFlags,
};
