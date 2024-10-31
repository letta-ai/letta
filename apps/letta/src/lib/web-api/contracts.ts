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

export const contracts = {
  user: userContract,
  projects: projectsContract,
  organizations: organizationsContract,
  apiKeys: apiKeysContracts,
  adePreferences: adePreferencesContracts,
  featureFlags: featureFlagsContracts,
  agentTemplates: agentTemplatesContracts,
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
