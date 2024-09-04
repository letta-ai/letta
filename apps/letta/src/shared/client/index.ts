import { initTsrReactQuery } from '@ts-rest/react-query/v5';
import { contracts } from '$letta/any/contracts';

export const webApi = initTsrReactQuery(contracts, {
  baseUrl: '/api',
});
