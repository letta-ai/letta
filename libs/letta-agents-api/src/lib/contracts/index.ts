import { agentsContract, agentsQueryKeys } from './agentsContract';
import { healthContract } from './healthContract';
import { modelContracts, modelQueryClientKeys } from './modelsContracts';
import { initTsrReactQuery } from '@ts-rest/react-query/v5';
import { templatesContract } from './templatesContract';

export const sdkContracts = {
  agents: agentsContract,
  models: modelContracts,
  health: healthContract,
  templates: templatesContract,
};

export const sdkQueryKeys = {
  agents: agentsQueryKeys,
  models: modelQueryClientKeys,
};

export * from './healthContract';
export * from './agentsContract';
export * from './modelsContracts';

export const webOriginSDKApi = initTsrReactQuery(sdkContracts, {
  baseUrl: process.env.OVERRIDE_WEB_ORIGIN_SDK_ENDPOINT || '',
});

export const webOriginSDKQueryKeys = sdkQueryKeys;
