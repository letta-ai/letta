import { agentsContract, agentsQueryKeys } from './agentsContract';
import { initTsrReactQuery } from '@ts-rest/react-query/v5';
import { templatesContract } from './templatesContract';

export const sdkContracts = {
  agents: agentsContract,
  templates: templatesContract,
};

export const sdkQueryKeys = {
  agents: agentsQueryKeys,
};

export * from './agentsContract';

export const webOriginSDKApi = initTsrReactQuery(sdkContracts, {
  baseUrl: process.env.OVERRIDE_WEB_ORIGIN_SDK_ENDPOINT || '',
});

export const webOriginSDKQueryKeys = sdkQueryKeys;
