import { useIdentityTypeToTranslationMap } from '../useIdentityTypeToTranslationMap';
import { useCallback, useMemo } from 'react';

export function useIdentityOptions() {
  const identityTypeToTranslationMap = useIdentityTypeToTranslationMap();

  const identityTypeOptions = useMemo(() => {
    return [
      { label: identityTypeToTranslationMap.org, value: 'org' },
      { label: identityTypeToTranslationMap.user, value: 'user' },
      { label: identityTypeToTranslationMap.other, value: 'other' },
    ];
  }, [identityTypeToTranslationMap]);

  const getOptionFromValue = useCallback(
    (value: string) => {
      return identityTypeOptions.find((option) => option.value === value);
    },
    [identityTypeOptions],
  );

  return {
    identityTypeOptions,
    getOptionFromValue,
  };
}
