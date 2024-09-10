import { userContract, userQueryClientKeys } from './user';
import { projectsContract, projectsQueryClientKeys } from './projects';
import { apiKeysContracts, apiKeysQueryKeys } from './api-keys';
import {
  organizationsContract,
  organizationsQueryClientKeys,
} from './organizations';
import {
  adminWhitelistedEmailsContract,
  adminWhitelistedEmailsQueryKeys,
} from '$letta/any/contracts/admin/whitelisted-emails';

export const contracts = {
  user: userContract,
  projects: projectsContract,
  organizations: organizationsContract,
  apiKeys: apiKeysContracts,
  admin: {
    whitelistedEmails: adminWhitelistedEmailsContract,
  },
};

export const queryClientKeys = {
  user: userQueryClientKeys,
  projects: projectsQueryClientKeys,
  organizations: organizationsQueryClientKeys,
  apiKeys: apiKeysQueryKeys,
  admin: {
    whitelistedEmails: adminWhitelistedEmailsQueryKeys,
  },
};
