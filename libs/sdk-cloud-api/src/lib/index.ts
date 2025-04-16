import { agentsContract, agentsQueryKeys } from './agentsContract';
import { initTsrReactQuery } from '@ts-rest/react-query/v5';
import { templatesContract } from './templatesContract';
import { clientSideAccessTokensContract } from './clientSideAccessTokensContract';

export const cloudContracts = {
  agents: agentsContract,
  templates: templatesContract,
  clientSideAccessTokens: clientSideAccessTokensContract,
};

export const cloudQueryKeys = {
  agents: agentsQueryKeys,
};

export * from './agentsContract';

export const cloudAPI = initTsrReactQuery(cloudContracts, {
  baseUrl: process.env['OVERRIDE_WEB_ORIGIN_SDK_ENDPOINT'] || '',
});
