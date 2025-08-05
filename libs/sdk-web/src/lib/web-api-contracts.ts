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
import { ssoContracts } from './public/ssoContracts';
import {
  launchLinkContracts,
  launchLinkQueryKeys,
} from './public/launchLinkContracts';
import { modelContracts, modelQueryClientKeys } from './public/modelsContracts';
import { cloudAccessCodeContract } from './public/cloudAccessCodeContract';
import {
  composioContracts,
  composioQueryKeys,
} from './public/composioContracts';
import {
  transactionsContracts,
  transactionsQueryKeys,
} from './public/transactionsContracts';
import { tracesContracts, tracesQueryKeys } from './public/tracesContracts';
import {
  adminContentViolationQueryKeys,
  adminContentViolationsContracts,
} from './admin/adminContentViolationsContracts';
import {
  observabilityContracts,
  observabilityQueryKeys,
} from './public/observabilityContracts';

import {
  agentfileContracts,
  agentfileQueryClientKeys,
} from './public/agentfileContracts';
import {
  simulatedAgentContracts,
  simulatedAgentQueryClientKeys,
} from './public/simulatedAgentContracts';
import {
  datasetItemContracts,
  datasetItemQueryKeys,
} from './public/datasetItemContracts';
import { datasetContracts, datasetQueryKeys } from './public/datasetContracts';
import { abTestContracts, abTestQueryKeys } from './public/abTestsContracts';

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
  starterKits: starterKitsContracts,
  composio: composioContracts,
  costs: costsContract,
  rateLimits: rateLimitsContracts,
  sharedAgentChats: sharedAgentChatsContracts,
  sso: ssoContracts,
  launchLinks: launchLinkContracts,
  models: modelContracts,
  cloudAccessCode: cloudAccessCodeContract,
  transactions: transactionsContracts,
  observability: observabilityContracts,
  simulatedAgents: simulatedAgentContracts,
  traces: tracesContracts,
  admin: {
    usage: adminUsageContracts,
    users: adminUsersContracts,
    models: adminModelsContracts,
    flushLayouts: flushLayoutsContract,
    whitelistedEmails: adminWhitelistedEmailsContract,
    organizations: adminOrganizationsContracts,
    contentViolations: adminContentViolationsContracts,
  },
  agentfile: agentfileContracts,
  datasetItems: datasetItemContracts,
  dataset: datasetContracts,
  abTest: abTestContracts,
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
  rateLimits: rateLimitQueryClientKeys,
  sharedAgentChats: sharedAgentChatQueryClientKeys,
  launchLinks: launchLinkQueryKeys,
  composio: composioQueryKeys,
  models: modelQueryClientKeys,
  transactions: transactionsQueryKeys,
  observability: observabilityQueryKeys,
  traces: tracesQueryKeys,
  agentfile: agentfileQueryClientKeys,
  simulatedAgents: simulatedAgentQueryClientKeys,
  admin: {
    usage: adminUsageQueryKeys,
    users: adminUsersQueryClientKeys,
    models: adminModelsQueryClientKeys,
    whitelistedEmails: adminWhitelistedEmailsQueryKeys,
    organizations: adminOrganizationsQueryClientKeys,
    contentViolations: adminContentViolationQueryKeys,
  },
  datasetItems: datasetItemQueryKeys,
  dataset: datasetQueryKeys,
  abTest: abTestQueryKeys,
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
export type * from './admin/adminUsageContracts';
export type * from './admin/adminOrganizationsContracts';
export type * from './admin/adminModelsContracts';
export type * from './admin/flushLayoutsContracts';
export * from './public/rateLimitsContracts';
export * from './public/costsContract';
export * from './public/sharedAgentChatsContracts';
export * from './public/launchLinkContracts';
export * from './public/modelsContracts';
export * from './public/composioContracts';
export * from './public/transactionsContracts';
export * from './admin/adminContentViolationsContracts';
export * from './public/observabilityContracts';
export type * from './public/agentfileContracts';
export * from './public/datasetItemContracts';
export * from './public/datasetContracts';
export * from './public/abTestsContracts';
