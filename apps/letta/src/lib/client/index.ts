import { initTsrReactQuery } from '@ts-rest/react-query/v5';
import { contracts, queryClientKeys } from '$letta/web-api/contracts';
import { sdkContracts } from '$letta/sdk/contracts';

export const webOriginSDKApi = initTsrReactQuery(sdkContracts, {
  baseUrl: '/v1',
});

export const webApi = initTsrReactQuery(contracts, {
  baseUrl: '/api',
});

export const webApiQueryKeys = queryClientKeys;

export * from './hooks/useFeatureFlag/useFeatureFlag';
