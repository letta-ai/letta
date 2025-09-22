'use client';

import type { Flag, FlagValue } from '@letta-cloud/service-feature-flags';
import { webApi, webApiQueryKeys } from '../../../index';
import { useMemo } from 'react';
import { getIsLocalPlatform } from '@letta-cloud/utils-shared';

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
    enabled: !getIsLocalPlatform(),
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
