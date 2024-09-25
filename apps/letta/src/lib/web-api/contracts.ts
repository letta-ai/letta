import { userContract, userQueryClientKeys } from './user/userContracts';
import {
  projectsContract,
  projectsQueryClientKeys,
} from './projects/projectContracts';
import { apiKeysContracts, apiKeysQueryKeys } from './api-keys/apiKeyContracts';
import {
  organizationsContract,
  organizationsQueryClientKeys,
} from './organizations/organizationsContracts';
import {
  adminWhitelistedEmailsContract,
  adminWhitelistedEmailsQueryKeys,
} from './admin/whitelisted-emails/whitelistedEmailsContracts';
import {
  featureFlagsContracts,
  featureFlagsQueryClientKeys,
} from './feature-flags/featureFlagsContracts';

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

export type * from './projects/projectContracts';
export type * from './user/userContracts';
export type * from './organizations/organizationsContracts';
export type * from './api-keys/apiKeyContracts';
export type * from './feature-flags/featureFlagsContracts';
export type * from './admin/whitelisted-emails/whitelistedEmailsContracts';
