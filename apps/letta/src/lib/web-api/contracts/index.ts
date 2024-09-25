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
} from '$letta/web-api/contracts/admin/whitelisted-emails';
import {
  featureFlagsContracts,
  featureFlagsQueryClientKeys,
} from '$letta/web-api/contracts/feature-flags';

export const contracts = {
  user: userContract,
  projects: projectsContract,
  organizations: organizationsContract,
  apiKeys: apiKeysContracts,
  featureFlags: featureFlagsContracts,
  admin: {
    whitelistedEmails: adminWhitelistedEmailsContract,
  },
};

export const queryClientKeys = {
  user: userQueryClientKeys,
  projects: projectsQueryClientKeys,
  organizations: organizationsQueryClientKeys,
  apiKeys: apiKeysQueryKeys,
  featureFlags: featureFlagsQueryClientKeys,
  admin: {
    whitelistedEmails: adminWhitelistedEmailsQueryKeys,
  },
};
