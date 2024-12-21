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
import { adminToolMetadataRouter } from '$web/web-api/admin/tool-metadata/adminToolMetadataRouter';
import { toolMetadataRouter } from '$web/web-api/tool-metadata/toolMetadataRouter';

export const router = {
  user: userRouter,
  projects: projectsRouter,
  apiKeys: apiKeysRouter,
  featureFlags: featureFlagsRouter,
  organizations: organizationsRouter,
  agentTemplates: agentTemplateRoutes,
  adePreferences: adePreferencesRouter,
  developmentServers: developmentServersRouter,
  environmentVariables: environmentVariablesRouter,
  usage: usageRouter,
  toolMetadata: toolMetadataRouter,
  admin: {
    toolMetadata: adminToolMetadataRouter,
    users: adminUsersRouter,
    models: adminModelsRouter,
    flushLayouts: flushLayoutsRouter,
    whitelistedEmails: adminWhitelistedEmailsRouter,
    organizations: adminOrganizationsRouter,
  },
};

export * from './user/userRouter';
export * from './projects/projectsRouter';
export * from './api-keys/apiKeysRouter';
export * from './organizations/organizationsRouter';
export * from './admin/whitelisted-emails/whitelistedEmailsRouter';
export * from './feature-flags/featureFlagsRouter';
export * from './ade-preferences/adePreferencesRouter';
