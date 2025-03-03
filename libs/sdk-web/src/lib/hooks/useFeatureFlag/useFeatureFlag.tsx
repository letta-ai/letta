'use client';

import type { Flag, FlagValue } from '@letta-cloud/service-feature-flags';
import { webApi, webApiQueryKeys } from '../../../index';
import { CURRENT_RUNTIME } from '@letta-cloud/config-runtime';

interface UseFeatureFlagPayload<SingleFlag extends Flag> {
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  data: FlagValue<SingleFlag> | undefined;
  isLoading: boolean;
}

export function useFeatureFlag<SingleFlag extends Flag>(
  flag: SingleFlag,
): UseFeatureFlagPayload<SingleFlag> {
  const { data } = webApi.featureFlags.getFeatureFlags.useQuery({
    queryKey: webApiQueryKeys.featureFlags.getFeatureFlags,
    enabled: CURRENT_RUNTIME !== 'letta-desktop',
  });

  return {
    data: data?.body[flag],
    isLoading: data === undefined,
  };
}
