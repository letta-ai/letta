import { userContract, userQueryClientKeys } from './user';
import { projectsContract, projectsQueryClientKeys } from './projects';

export const contracts = {
  user: userContract,
  projects: projectsContract,
};

export const queryClientKeys = {
  user: userQueryClientKeys,
  projects: projectsQueryClientKeys,
};
