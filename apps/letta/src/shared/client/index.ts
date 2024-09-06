import { initTsrReactQuery } from '@ts-rest/react-query/v5';
import { contracts, queryClientKeys } from '$letta/any/contracts';

export const webApi = initTsrReactQuery(contracts, {
  baseUrl: '/api',
});

export const webApiQueryKeys = queryClientKeys;
