import { userContract, userQueryClientKeys } from './user';
import { projectsContract, projectsQueryClientKeys } from './projects';
import {
  apiKeysContracts,
  apiKeysQueryKeys,
} from '$letta/any/contracts/api-keys';

export const contracts = {
  user: userContract,
  projects: projectsContract,
  apiKeys: apiKeysContracts,
};

export const queryClientKeys = {
  user: userQueryClientKeys,
  projects: projectsQueryClientKeys,
  apiKeys: apiKeysQueryKeys,
};
