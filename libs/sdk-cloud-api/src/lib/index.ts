import { agentsContract, agentsQueryKeys } from './agentsContract';
import { initTsrReactQuery } from '@ts-rest/react-query/v5';
import { templatesContract } from './templatesContract';

export const cloudContracts = {
  agents: agentsContract,
  templates: templatesContract,
};

export const cloudQueryKeys = {
  agents: agentsQueryKeys,
};

export * from './agentsContract';

export const cloudAPI = initTsrReactQuery(cloudContracts, {
  baseUrl: process.env['OVERRIDE_WEB_ORIGIN_SDK_ENDPOINT'] || '',
});
