import { contracts, queryClientKeys } from './lib/web-api-contracts';
import { initTsrReactQuery } from '@ts-rest/react-query/v5';
import { CURRENT_RUNTIME } from '@letta-cloud/config-runtime';

export * from './lib/hooks/useFeatureFlag/useFeatureFlag';
export * from './lib/web-api-contracts';
export * from './lib/types';

const baseUrl = (() => {
  if (CURRENT_RUNTIME === 'letta-desktop') {
    return process.env.NODE_ENV === 'production'
      ? 'https://app.letta.com/api'
      : 'http://localhost:3000/api';
  }

  return '/api';
})();

export const webApiContracts = contracts;
export const webApi = initTsrReactQuery(contracts, {
  baseUrl,
});
export const webApiQueryKeys = queryClientKeys;
