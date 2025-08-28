import { userRouter } from './user/userRouter';
import { projectsRouter } from './projects/projectsRouter';
import * as apiKeysRouter from './api-keys/apiKeysRouter';
import { organizationsRouter } from './organizations/organizationsRouter';
import * as adminWhitelistedEmailsRouter from './admin/whitelisted-emails/whitelistedEmailsRouter';
import { featureFlagsRouter } from './feature-flags/featureFlagsRouter';
import { adePreferencesRouter } from './ade-preferences/adePreferencesRouter';
import { agentTemplateRoutes } from './agent-templates/agentTemplateRoutes';
import { flushLayoutsRouter } from './admin/flush-layouts/flushLayoutsRouter';
import { developmentServersRouter } from './development-servers/developmentServersRouter';
import { adminOrganizationsRouter } from '$web/web-api/admin/organizations/adminOrganizationsRouter';
import { adminModelsRouter } from '$web/web-api/admin/models/adminModelsRouter';
import { environmentVariablesRouter } from '$web/web-api/environment-variables/environmentVariablesRouter';
import { adminUsersRouter } from '$web/web-api/admin/users/adminUsersRouter';
import { usageRouter } from '$web/web-api/usage/usageRouter';
import { adminUsageRouter } from '$web/web-api/admin/usage/adminUsageRouter';
import { starterKitsRouter } from '$web/web-api/starter-kits/starterKitsRoutes';
import { rateLimitsRoutes } from '$web/web-api/rate-limits/rateLimitsRoutes';
import { costsRoutes } from '$web/web-api/costs/costsRoutes';
import { sharedAgentChatsRoutes } from '$web/web-api/shared-agent-chats/sharedAgentChatsRoutes';
import { ssoRoutes } from '$web/web-api/sso/ssoRoutes';
import { launchLinkRoutes } from '$web/web-api/launch-links/launchLinksRoutes';
import { cloudAccessCodeRouter } from '$web/web-api/cloud-access-code/cloudAccessCodeRouter';
import { composioRouter } from '$web/web-api/composio/composioRouter';
import { transactionsRoutes } from '$web/web-api/transactions/transactionsRoutes';
import { tracesRoutes } from '$web/web-api/traces/tracesRouter';
import { adminContentViolationsRouter } from '$web/web-api/admin/contentViolations/adminContentViolationsRouter';
import { observabilityRouter } from '$web/web-api/observability/observabilityRouter';
import { agentfileRouter } from '$web/web-api/agentfile/agentfileRouter';
import { simulatedAgentsRouter } from '$web/web-api/simulated-agents/simulatedAgentsRouter';
import * as datasetItemsRouter from '$web/web-api/dataset-items/datasetItemsRouter';
import * as datasetsRouter from '$web/web-api/datasets/datasetsRouter';
import * as abTestsRouter from '$web/web-api/ab-tests/abTestsRouter';
import * as blockTemplatesRouter from '$web/web-api/block-templates/blockTemplatesRouter';
import { internalTemplatesRouter } from '$web/web-api/templates/internalTemplatesRouter';

export const router = {
  user: userRouter,
  projects: projectsRouter,
  apiKeys: apiKeysRouter,
  featureFlags: featureFlagsRouter,
  organizations: organizationsRouter,
  agentTemplates: agentTemplateRoutes,
  adePreferences: adePreferencesRouter,
  costs: costsRoutes,
  developmentServers: developmentServersRouter,
  environmentVariables: environmentVariablesRouter,
  usage: usageRouter,
  starterKits: starterKitsRouter,
  rateLimits: rateLimitsRoutes,
  sharedAgentChats: sharedAgentChatsRoutes,
  sso: ssoRoutes,
  launchLinks: launchLinkRoutes,
  cloudAccessCode: cloudAccessCodeRouter,
  composio: composioRouter,
  transactions: transactionsRoutes,
  traces: tracesRoutes,
  observability: observabilityRouter,
  admin: {
    usage: adminUsageRouter,
    users: adminUsersRouter,
    models: adminModelsRouter,
    flushLayouts: flushLayoutsRouter,
    whitelistedEmails: adminWhitelistedEmailsRouter,
    organizations: adminOrganizationsRouter,
    contentViolations: adminContentViolationsRouter,
  },
  agentfile: agentfileRouter,
  simulatedAgents: simulatedAgentsRouter,
  datasetItems: datasetItemsRouter,
  dataset: datasetsRouter,
  abTest: abTestsRouter,
  blockTemplates: blockTemplatesRouter,
  templates: internalTemplatesRouter,
};

export * from './user/userRouter';
export * from './projects/projectsRouter';
export * from './api-keys/apiKeysRouter';
export * from './organizations/organizationsRouter';
export * from './admin/whitelisted-emails/whitelistedEmailsRouter';
export * from './feature-flags/featureFlagsRouter';
export * from './ade-preferences/adePreferencesRouter';
export * from './dataset-items/datasetItemsRouter';
export * from './datasets/datasetsRouter';
export * from './ab-tests/abTestsRouter';
export * from './block-templates/blockTemplatesRouter';
export * from './templates/internalTemplatesRouter';
