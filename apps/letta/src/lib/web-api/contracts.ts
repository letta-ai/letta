import { userContract, userQueryClientKeys } from './user/userContracts';
import {
  projectsContract,
  projectsQueryClientKeys,
} from './projects/projectContracts';
import { apiKeysContracts, apiKeysQueryKeys } from './api-keys/apiKeyContracts';
import {
  organizationsContract,
  organizationsQueryClientKeys,
} from './organizations/organizationsContracts';
import {
  adminWhitelistedEmailsContract,
  adminWhitelistedEmailsQueryKeys,
} from './admin/whitelisted-emails/whitelistedEmailsContracts';
import {
  featureFlagsContracts,
  featureFlagsQueryClientKeys,
} from './feature-flags/featureFlagsContracts';
import {
  adePreferencesContracts,
  adePreferencesQueryClientKeys,
} from './ade-preferences/adePreferencesContracts';
import {
  agentTemplatesQueryClientKeys,
  agentTemplatesContracts,
} from '$letta/web-api/agent-templates/agentTemplatesContracts';
import { flushLayoutsContract } from '$letta/web-api/admin/flush-layouts/flushLayoutsContracts';
import {
  developmentServerQueryClientKeys,
  developmentServersContracts,
} from '$letta/web-api/development-servers/developmentServersContracts';

export const contracts = {
  user: userContract,
  projects: projectsContract,
  organizations: organizationsContract,
  apiKeys: apiKeysContracts,
  adePreferences: adePreferencesContracts,
  featureFlags: featureFlagsContracts,
  agentTemplates: agentTemplatesContracts,
  developmentServers: developmentServersContracts,
  admin: {
    flushLayouts: flushLayoutsContract,
    whitelistedEmails: adminWhitelistedEmailsContract,
  },
};

export const queryClientKeys = {
  user: userQueryClientKeys,
  projects: projectsQueryClientKeys,
  organizations: organizationsQueryClientKeys,
  apiKeys: apiKeysQueryKeys,
  featureFlags: featureFlagsQueryClientKeys,
  agentTemplates: agentTemplatesQueryClientKeys,
  adePreferences: adePreferencesQueryClientKeys,
  developmentServers: developmentServerQueryClientKeys,
  admin: {
    whitelistedEmails: adminWhitelistedEmailsQueryKeys,
  },
};

export * from './projects/projectContracts';
export * from './user/userContracts';
export * from './organizations/organizationsContracts';
export * from './api-keys/apiKeyContracts';
export * from './feature-flags/featureFlagsContracts';
export * from './admin/whitelisted-emails/whitelistedEmailsContracts';
export * from './agent-templates/agentTemplatesContracts';
