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
import {
  adminOrganizationsContracts,
  adminOrganizationsQueryClientKeys,
} from '$letta/web-api/admin/organizations/adminOrganizationsContracts';
import {
  adminModelsContracts,
  adminModelsQueryClientKeys,
} from '$letta/web-api/admin/models/adminModelsContracts';
import {
  environmentVariablesContracts,
  environmentVariablesQueryKeys,
} from '$letta/web-api/environment-variables/environmentVariablesContracts';
import {
  adminUsersContracts,
  adminUsersQueryClientKeys,
} from '$letta/web-api/admin/users/adminUsersContracts';
import {
  usageContracts,
  usageQueryKeys,
} from '$letta/web-api/usage/usageContract';
import { adminToolMetadataContracts } from '$letta/web-api/admin/tool-metadata/adminToolMetadataContracts';
import {
  toolMetadataContracts,
  toolMetadataQueryClientKeys,
} from '$letta/web-api/tool-metadata/toolMetadataContract';

export const contracts = {
  user: userContract,
  projects: projectsContract,
  organizations: organizationsContract,
  apiKeys: apiKeysContracts,
  adePreferences: adePreferencesContracts,
  featureFlags: featureFlagsContracts,
  agentTemplates: agentTemplatesContracts,
  developmentServers: developmentServersContracts,
  environmentVariables: environmentVariablesContracts,
  usage: usageContracts,
  toolMetadata: toolMetadataContracts,
  admin: {
    toolMetadata: adminToolMetadataContracts,
    users: adminUsersContracts,
    models: adminModelsContracts,
    flushLayouts: flushLayoutsContract,
    whitelistedEmails: adminWhitelistedEmailsContract,
    organizations: adminOrganizationsContracts,
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
  environmentVariables: environmentVariablesQueryKeys,
  usage: usageQueryKeys,
  toolMetadata: toolMetadataQueryClientKeys,
  admin: {
    users: adminUsersQueryClientKeys,
    models: adminModelsQueryClientKeys,
    whitelistedEmails: adminWhitelistedEmailsQueryKeys,
    organizations: adminOrganizationsQueryClientKeys,
  },
};

export * from './projects/projectContracts';
export * from './user/userContracts';
export * from './organizations/organizationsContracts';
export * from './api-keys/apiKeyContracts';
export * from './feature-flags/featureFlagsContracts';
export * from './admin/whitelisted-emails/whitelistedEmailsContracts';
export * from './agent-templates/agentTemplatesContracts';
