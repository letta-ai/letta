import { userContract, userQueryClientKeys } from './public/userContracts';
import {
  projectsContract,
  projectsQueryClientKeys,
} from './public/projectContracts';
import { apiKeysContracts, apiKeysQueryKeys } from './public/apiKeyContracts';
import {
  organizationsContract,
  organizationsQueryClientKeys,
} from './public/organizationsContracts';
import {
  adminWhitelistedEmailsContract,
  adminWhitelistedEmailsQueryKeys,
} from './admin/whitelistedEmailsContracts';
import {
  featureFlagsContracts,
  featureFlagsQueryClientKeys,
} from './public/featureFlagsContracts';
import {
  adePreferencesContracts,
  adePreferencesQueryClientKeys,
} from './public/adePreferencesContracts';
import {
  agentTemplatesQueryClientKeys,
  agentTemplatesContracts,
} from './public/agentTemplatesContracts';
import { flushLayoutsContract } from './admin/flushLayoutsContracts';
import {
  developmentServerQueryClientKeys,
  developmentServersContracts,
} from './public/developmentServersContracts';
import {
  adminOrganizationsContracts,
  adminOrganizationsQueryClientKeys,
} from './admin/adminOrganizationsContracts';
import {
  adminModelsContracts,
  adminModelsQueryClientKeys,
} from './admin/adminModelsContracts';
import {
  environmentVariablesContracts,
  environmentVariablesQueryKeys,
} from './public/environmentVariablesContracts';
import {
  adminUsersContracts,
  adminUsersQueryClientKeys,
} from './admin/adminUsersContracts';
import { usageContracts, usageQueryKeys } from './public/usageContract';
import { adminToolMetadataContracts } from './admin/adminToolMetadataContracts';
import {
  toolMetadataContracts,
  toolMetadataQueryClientKeys,
} from './public/toolMetadataContract';
import {
  adminUsageContracts,
  adminUsageQueryKeys,
} from './admin/adminUsageContracts';
import { starterKitsContracts } from './public/starterKitsContracts';
import {
  rateLimitQueryClientKeys,
  rateLimitsContracts,
} from './public/rateLimitsContracts';
import { costsContract, costsQueryKeys } from './public/costsContract';
import {
  sharedAgentChatQueryClientKeys,
  sharedAgentChatsContracts,
} from './public/sharedAgentChatsContracts';

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
  starterKits: starterKitsContracts,
  costs: costsContract,
  rateLimits: rateLimitsContracts,
  sharedAgentChats: sharedAgentChatsContracts,
  admin: {
    usage: adminUsageContracts,
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
  costs: costsQueryKeys,
  agentTemplates: agentTemplatesQueryClientKeys,
  adePreferences: adePreferencesQueryClientKeys,
  developmentServers: developmentServerQueryClientKeys,
  environmentVariables: environmentVariablesQueryKeys,
  usage: usageQueryKeys,
  toolMetadata: toolMetadataQueryClientKeys,
  rateLimits: rateLimitQueryClientKeys,
  sharedAgentChats: sharedAgentChatQueryClientKeys,
  admin: {
    usage: adminUsageQueryKeys,
    users: adminUsersQueryClientKeys,
    models: adminModelsQueryClientKeys,
    whitelistedEmails: adminWhitelistedEmailsQueryKeys,
    organizations: adminOrganizationsQueryClientKeys,
  },
};

export * from './public/projectContracts';
export * from './public/userContracts';
export * from './public/organizationsContracts';
export * from './public/apiKeyContracts';
export * from './public/featureFlagsContracts';
export * from './admin/whitelistedEmailsContracts';
export * from './public/agentTemplatesContracts';
export type * from './admin/adminUsersContracts';
export type * from './public/adePreferencesContracts';
export type * from './public/developmentServersContracts';
export * from './public/environmentVariablesContracts';
export type * from './public/usageContract';
export type * from './public/toolMetadataContract';
export type * from './admin/adminUsageContracts';
export type * from './admin/adminToolMetadataContracts';
export type * from './admin/adminOrganizationsContracts';
export type * from './admin/adminModelsContracts';
export type * from './admin/flushLayoutsContracts';
export * from './public/rateLimitsContracts';
export * from './public/costsContract';
export * from './public/sharedAgentChatsContracts';
