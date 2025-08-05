import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useABTestId } from '../useABTestId/useABTestId';

export function useCurrentABTest() {
  const abTestId = useABTestId();

  return webApi.abTest.getAbTest.useQuery({
    queryKey: webApiQueryKeys.abTest.getAbTest(abTestId),
    queryData: {
      params: { abTestId },
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    enabled: !!abTestId,
  });
}
