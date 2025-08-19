'use client';

import type { Flag, FlagValue } from '@letta-cloud/service-feature-flags';
import { webApi, webApiQueryKeys } from '../../../index';
import { CURRENT_RUNTIME } from '@letta-cloud/config-runtime';
import { useMemo } from 'react';

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

  const flagData = useMemo(() => {
    try {
      return data?.body?.[flag];
    } catch (_e) {
      return undefined;
    }
  }, [data, flag]);

  return {
    data: flagData,
    isLoading: data === undefined,
  };
}
