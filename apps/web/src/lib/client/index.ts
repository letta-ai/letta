import { initTsrReactQuery } from '@ts-rest/react-query/v5';
import { contracts, queryClientKeys } from '$web/web-api/contracts';
import { sdkContracts, sdkQueryKeys } from '$web/sdk/contracts';

export const webOriginSDKApi = initTsrReactQuery(sdkContracts, {
  baseUrl: '',
});

export const webApiContracts = contracts;
export const webApi = initTsrReactQuery(contracts, {
  baseUrl: '/api',
});

export const webApiQueryKeys = queryClientKeys;
export const webOriginSDKQueryKeys = sdkQueryKeys;

export * from './hooks/useFeatureFlag/useFeatureFlag';
export * from './starter-kits/starter-kits';
