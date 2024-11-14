import { userRouter } from './user/userRouter';
import { projectsRouter } from './projects/projectsRouter';
import * as apiKeysRouter from './api-keys/apiKeysRouter';
import { organizationsRouter } from './organizations/organizationsRouter';
import * as adminWhitelistedEmailsRouter from './admin/whitelisted-emails/whitelistedEmailsRouter';
import * as featureFlagsRouter from './feature-flags/featureFlagsRouter';
import { adePreferencesRouter } from './ade-preferences/adePreferencesRouter';
import { agentTemplateRoutes } from './agent-templates/agentTemplateRoutes';
import { flushLayoutsRouter } from './admin/flush-layouts/flushLayoutsRouter';
import { developmentServersRouter } from './development-servers/developmentServersRouter';

export const router = {
  user: userRouter,
  projects: projectsRouter,
  apiKeys: apiKeysRouter,
  featureFlags: featureFlagsRouter,
  organizations: organizationsRouter,
  agentTemplates: agentTemplateRoutes,
  adePreferences: adePreferencesRouter,
  developmentServers: developmentServersRouter,
  admin: {
    flushLayouts: flushLayoutsRouter,
    whitelistedEmails: adminWhitelistedEmailsRouter,
    organizations: organizationsRouter,
  },
};

export * from './user/userRouter';
export * from './projects/projectsRouter';
export * from './api-keys/apiKeysRouter';
export * from './organizations/organizationsRouter';
export * from './admin/whitelisted-emails/whitelistedEmailsRouter';
export * from './feature-flags/featureFlagsRouter';
export * from './ade-preferences/adePreferencesRouter';
