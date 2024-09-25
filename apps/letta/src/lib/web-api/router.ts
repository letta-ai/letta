import * as userRouter from './user/userRouter';
import * as projectsRouter from './projects/projectsRouter';
import * as apiKeysRouter from './api-keys/apiKeysRouter';
import * as organizationsRouter from './organizations/organizationsRouter';
import * as adminWhitelistedEmailsRouter from './admin/whitelisted-emails/whitelistedEmailsRouter';
import * as featureFlagsRouter from './feature-flags/featureFlagsRouter';

export const router = {
  user: userRouter,
  projects: projectsRouter,
  apiKeys: apiKeysRouter,
  featureFlags: featureFlagsRouter,
  organizations: organizationsRouter,
  admin: {
    whitelistedEmails: adminWhitelistedEmailsRouter,
  },
};

export * from './user/userRouter';
export * from './projects/projectsRouter';
export * from './api-keys/apiKeysRouter';
export * from './organizations/organizationsRouter';
export * from './admin/whitelisted-emails/whitelistedEmailsRouter';
export * from './feature-flags/featureFlagsRouter';
