import type { LDClient } from '@launchdarkly/node-server-sdk';
import * as ld from '@launchdarkly/node-server-sdk';

export * from './flags';
import { environment } from '@letta-cloud/config-environment-variables';
import type { Flag, FlagMap, FlagValue } from './flags';

// Client fixing issue for launchdarkly reconnecting spam
// dev issue only
declare global {
  // eslint-disable-next-line no-var -- only var works here
  var launchDarklySingleton: LDClient;
}

let launchDarklySingleton: LDClient;

if (environment.LAUNCH_DARKLY_SDK_KEY) {
  if (process.env.NODE_ENV === 'production') {
    launchDarklySingleton = ld.init(environment.LAUNCH_DARKLY_SDK_KEY, {
      stream: false,
    });
  } else {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!global.launchDarklySingleton) {
      global.launchDarklySingleton = ld.init(
        environment.LAUNCH_DARKLY_SDK_KEY,
        {
          stream: false,
        },
      );
    }

    launchDarklySingleton = global.launchDarklySingleton;
  }
}

async function getLaunchDarklyClient() {
  if (!environment.LAUNCH_DARKLY_SDK_KEY) {
    console.warn(
      'No LaunchDarkly SDK key provided, feature flags will default in the off state',
    );
  }

  if (!launchDarklySingleton.initialized()) {
    await launchDarklySingleton.waitForInitialization({
      timeout: 2,
    });
  }

  return launchDarklySingleton;
}

interface OrgDetails {
  id: string;
  name: string;
}

export async function getOrganizationFeatureFlags(org: OrgDetails) {
  if (!environment.LAUNCH_DARKLY_SDK_KEY) {
    return {};
  }

  const ldClient = await getLaunchDarklyClient();

  const context: ld.LDContext = {
    kind: 'org',
    key: org.id,
    name: org.name,
  };

  ldClient.identify(context);

  const response = await ldClient.allFlagsState(context);

  return response.toJSON();
}

export async function getSingleFlag<SingleFlag extends Flag>(
  flag: SingleFlag,
  orgId: string,
): Promise<FlagValue<SingleFlag> | undefined> {
  if (!environment.LAUNCH_DARKLY_SDK_KEY) {
    return undefined;
  }

  const ldClient = await getLaunchDarklyClient();

  return new Promise((resolve) => {
    return ldClient.variation(
      flag,
      {
        key: orgId,
        kind: 'org',
      },
      false,
      (err, res) => {
        if (err) {
          resolve(undefined);
          return;
        }

        resolve(res);
      },
    );
  });
}

export async function getDefaultFlags(): Promise<Partial<FlagMap>> {
  try {
    const ldClient = await getLaunchDarklyClient();

    const response = await ldClient.allFlagsState({
      key: 'default',
      anonymous: true,
    });

    return response.toJSON();
  } catch (e) {
    console.error('Error fetching default flags', e);
    return {};
  }
}
