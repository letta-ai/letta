import { initTsrReactQuery } from '@ts-rest/react-query/v5';
import { contracts, queryClientKeys } from '$letta/web-api/contracts';
import { pdkContracts } from '$letta/pdk/contracts';

export const pdkApi = initTsrReactQuery(pdkContracts, {
  baseUrl: '/pdk/v1',
});

export const webApi = initTsrReactQuery(contracts, {
  baseUrl: '/api',
});

export const webApiQueryKeys = queryClientKeys;

export * from './hooks/useFeatureFlag/useFeatureFlag';
export * from './components';
