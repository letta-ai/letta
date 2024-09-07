import { userContract, userQueryClientKeys } from './user';
import { projectsContract, projectsQueryClientKeys } from './projects';
import {
  projectContract,
  projectQueryClientKeys,
} from '$letta/any/contracts/project';

export const contracts = {
  user: userContract,
  projects: projectsContract,
  project: projectContract,
};

export const queryClientKeys = {
  user: userQueryClientKeys,
  projects: projectsQueryClientKeys,
  project: projectQueryClientKeys,
};
