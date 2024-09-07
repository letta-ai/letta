import * as userRouter from './user';
import * as projectsRouter from './projects';
import * as projectRouter from './project';

export const router = {
  user: userRouter,
  projects: projectsRouter,
  project: projectRouter,
};
