import * as userRouter from './user';
import * as projectsRouter from './projects';
import * as apiKeysRouter from './api-keys';

export const router = {
  user: userRouter,
  projects: projectsRouter,
  apiKeys: apiKeysRouter,
};
