import { agentsContract, agentsQueryKeys } from './agentsContract';
import { initTsrReactQuery } from '@ts-rest/react-query/v5';
import { templateQueryKeys, templatesContract } from './templatesContract';
import { clientSideAccessTokensContract } from './clientSideAccessTokensContract';
import { projectsContract } from './projectsContract';

export const cloudContracts = {
  agents: agentsContract,
  templates: templatesContract,
  clientSideAccessTokens: clientSideAccessTokensContract,
  projects: projectsContract,
};

export const cloudQueryKeys = {
  agents: agentsQueryKeys,
  templates: templateQueryKeys,
};

export * from './agentsContract';

export const cloudAPI = initTsrReactQuery(cloudContracts, {
  baseUrl: process.env['OVERRIDE_WEB_ORIGIN_SDK_ENDPOINT'] || '',
});

export type * from './templatesContract';
