import type { contracts } from '$web/web-api/contracts';
import type { ServerInferResponses } from '@ts-rest/core';
import { getOrganizationFromOrganizationId, getUser } from '$web/server/auth';
import {
  featureFlags,
  type FlagMap,
  getDefaultFlags,
  getOrganizationFeatureFlags,
} from '@letta-cloud/service-feature-flags';

type FeatureFlagsResponse = ServerInferResponses<
  typeof contracts.featureFlags.getFeatureFlags
>;

let flagOverrides: Partial<FlagMap> = {};

function flagIsValid(flag: string): flag is keyof FlagMap {
  return flag in featureFlags;
}

async function getFeatureFlags(): Promise<FeatureFlagsResponse> {
  const user = await getUser();

  let flags: Record<string, any> | undefined;

  if (user?.activeOrganizationId) {
    const org = await getOrganizationFromOrganizationId(
      user.activeOrganizationId,
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

  const final = {
    ...flags,
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
