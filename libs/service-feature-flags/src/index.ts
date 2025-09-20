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
    return null;
  }

  if (!launchDarklySingleton) {
    launchDarklySingleton = ld.init(environment.LAUNCH_DARKLY_SDK_KEY, {
      stream: false,
    });
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

  if (!ldClient) {
    return {};
  }

  const context: ld.LDContext = {
    kind: 'org',
    key: org.id,
    name: org.name,
  };

  ldClient.identify(context);

  const response = await ldClient.allFlagsState(context);

  return response.toJSON();
}

interface UserDetails {
  id: string;
  name: string;
  email: string;
}

export function isLettaEmail(email: string) {
  return email.endsWith('@letta.com') || email.endsWith('@memgpt.ai');
}
export async function getLettaUserFeatureFlags(user: UserDetails) {
  if (!environment.LAUNCH_DARKLY_SDK_KEY) {
    return {};
  }

  // Duplicate check for email as setting this context will increase our LaunchDarkly bill significantly.
  if (!isLettaEmail(user.email)) {
    return {};
  }

  const ldClient = await getLaunchDarklyClient();


  if (!ldClient) {
    return {};
  }

  const context: ld.LDContext = {
    kind: 'user',
    key: user.id,
    name: user.name,
    email: user.email,
  };

  ldClient.identify(context);

  const response = await ldClient.allFlagsState(context, {
    withReasons: true,
    detailsOnlyForTrackedFlags: false, // Set to false to get reasons for all flags
  });
  const allFlags = response.toJSON();

  const explicitFlags: Record<string, any> = {};
  // Only include flags that were explicitly set for this user
  Object.entries(allFlags).forEach(([key, value]) => {
    const reason = response.getFlagReason(key);

    if (reason?.kind === 'TARGET_MATCH' || reason?.kind === 'RULE_MATCH') {
      explicitFlags[key] = value;
    }
  });
  return explicitFlags;
}

export async function getSingleFlag<SingleFlag extends Flag>(
  flag: SingleFlag,
  orgId?: string,
): Promise<FlagValue<SingleFlag> | undefined> {
  if (!environment.LAUNCH_DARKLY_SDK_KEY) {
    return undefined;
  }

  const ldClient = await getLaunchDarklyClient();

  if (!ldClient) {
    return undefined;
  }

  if (!orgId) {
    return ldClient.variation(
      flag,
      {
        key: 'default',
        anonymous: true,
      },
      false,
    );
  }

  return ldClient.variation(
    flag,
    {
      key: orgId,
      kind: 'org',
    },
    false,
  );
}


export async function getSingleFlagForAgent<SingleFlag extends Flag>(
  flag: SingleFlag,
  agentId?: string,
): Promise<FlagValue<SingleFlag> | undefined> {
  if (!environment.LAUNCH_DARKLY_SDK_KEY) {
    return undefined;
  }

  const ldClient = await getLaunchDarklyClient();

  if (!ldClient) {
    return undefined;
  }

  if (!agentId) {
    return ldClient.variation(
      flag,
      {
        key: 'default',
        anonymous: true,
      },
      false,
    );
  }

  return ldClient.variation(
    flag,
    {
      key: agentId,
      kind: 'agent',
    },
    false,
  );
}


export async function getDefaultFlags(): Promise<Partial<FlagMap>> {
  try {
    const ldClient = await getLaunchDarklyClient();

    if (!ldClient) {
      return {};
    }

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
