import { contracts, queryClientKeys } from './lib/web-api-contracts';
import { initTsrReactQuery } from '@ts-rest/react-query/v5';

export * from './lib/hooks/useFeatureFlag/useFeatureFlag';
export * from './lib/web-api-contracts';
export * from './lib/types';

export const webApiContracts = contracts;
export const webApi = initTsrReactQuery(contracts, {
  baseUrl: '/api',
});
export const webApiQueryKeys = queryClientKeys;
