import { useFeatureFlag } from '@letta-cloud/sdk-web';

export function useGlobalSystemWarning() {
  const { data } = useFeatureFlag('SYSTEM_WARNING');

  return data || null;
}
