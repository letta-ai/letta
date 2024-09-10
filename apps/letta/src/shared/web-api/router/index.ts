import * as userRouter from './user';
import * as projectsRouter from './projects';
import * as apiKeysRouter from './api-keys';
import * as organizationsRouter from './organizations';
import * as adminWhitelistedEmailsRouter from './admin/whitelisted-emails';

export const router = {
  user: userRouter,
  projects: projectsRouter,
  apiKeys: apiKeysRouter,
  organizations: organizationsRouter,
  admin: {
    whitelistedEmails: adminWhitelistedEmailsRouter,
  },
};
