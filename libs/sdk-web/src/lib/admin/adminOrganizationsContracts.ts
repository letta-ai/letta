import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { type GenericSearch, GenericSearchSchema } from '../shared';
import { DatabaseBillingTiers, PricingModelEnum } from '@letta-cloud/types';

const c = initContract();

/* Get Organizations */
export const PublicOrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const OrganizationsSchema = z.object({
  organizations: z.array(PublicOrganizationSchema),
  hasNextPage: z.boolean(),
});

export type PublicOrganizationType = z.infer<typeof PublicOrganizationSchema>;

export type OrganizationsType = z.infer<typeof OrganizationsSchema>;

const getOrganizationsContract = c.query({
  method: 'GET',
  query: GenericSearchSchema,
  path: '/admin/organizations',
  responses: {
    200: OrganizationsSchema,
  },
});

/* Get Organization */
export const OrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  lettaAgentsId: z.string(),
  bannedAt: z.string().nullable(),
  enabledCloudAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type OrganizationType = z.infer<typeof OrganizationSchema>;

const getOrganizationContract = c.query({
  method: 'GET',
  pathParams: z.object({
    organizationId: z.string(),
  }),
  path: '/admin/organizations/:organizationId',
  responses: {
    200: OrganizationSchema,
  },
});

/* Ban Organization */
const adminBanOrganizationContract = c.mutation({
  method: 'POST',
  pathParams: z.object({
    organizationId: z.string(),
  }),
  path: '/admin/organizations/:organizationId/ban',
  body: z.undefined(),
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
  },
});

/* Unban Organization */
const adminUnbanOrganizationContract = c.mutation({
  method: 'POST',
  pathParams: z.object({
    organizationId: z.string(),
  }),
  path: '/admin/organizations/:organizationId/unban',
  body: z.undefined(),
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
  },
});

/* Add User to Organization */
export const AddUserToOrganizationPayloadSchema = z.object({
  userId: z.string(),
});

const adminAddUserToOrganizationContract = c.mutation({
  method: 'POST',
  pathParams: z.object({
    organizationId: z.string(),
  }),
  path: '/admin/organizations/:organizationId/add-user',
  body: AddUserToOrganizationPayloadSchema,
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
  },
});

/* Remove User from Organization */
const adminRemoveUserFromOrganizationContract = c.mutation({
  method: 'POST',
  pathParams: z.object({
    organizationId: z.string(),
  }),
  path: '/admin/organizations/:organizationId/remove-user',
  body: AddUserToOrganizationPayloadSchema,
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
  },
});

/* List Users in Organization */
export const OrganizationUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  addedAt: z.string(),
});

export type AdminOrganizationUserType = z.infer<typeof OrganizationUserSchema>;

export const OrganizationUsersSchema = z.object({
  users: z.array(OrganizationUserSchema),
  hasNextPage: z.boolean(),
});

const adminListOrganizationUsersContract = c.query({
  method: 'GET',
  pathParams: z.object({
    organizationId: z.string(),
  }),
  query: GenericSearchSchema,
  path: '/admin/organizations/:organizationId/users',
  responses: {
    200: OrganizationUsersSchema,
  },
});

const AdminOrganizationStatisticsSchema = z.object({
  totalTemplates: z.number(),
  totalDeployedAgents: z.number(),
  totalMembers: z.number(),
});

const adminGetOrganizationStatisticsContract = c.query({
  method: 'GET',
  pathParams: z.object({
    organizationId: z.string(),
  }),
  path: '/admin/organizations/:organizationId/statistics',
  responses: {
    200: AdminOrganizationStatisticsSchema,
  },
});

const adminDeleteOrganizationContract = c.mutation({
  method: 'DELETE',
  pathParams: z.object({
    organizationId: z.string(),
  }),
  path: '/admin/organizations/:organizationId',
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
  },
  body: z.undefined(),
});

const AdminOrganizationInferenceUsageQuerySchema = z.object({
  startDate: z.number(),
  endDate: z.number(),
});

type AdminOrganizationInferenceUsageQuery = z.infer<
  typeof AdminOrganizationInferenceUsageQuerySchema
>;

const AdminOrganizationInferenceUsageResponseSchema = z.array(
  z.object({
    modelKey: z.string(),
    modelName: z.string(),
    totalTokens: z.number(),
    totalCost: z.number(),
    brand: z.string(),
    totalRequests: z.number(),
  }),
);

const adminGetOrganizationInferenceUsageByModelContract = c.query({
  method: 'GET',
  pathParams: z.object({
    organizationId: z.string(),
  }),
  query: AdminOrganizationInferenceUsageQuerySchema,
  path: '/admin/organizations/:organizationId/inference-usage-by-model',
  responses: {
    200: AdminOrganizationInferenceUsageResponseSchema,
  },
});

const AdminOrganizationCreditsSchema = z.object({
  credits: z.number(),
});

const adminGetOrganizationCreditsContract = c.query({
  method: 'GET',
  pathParams: z.object({
    organizationId: z.string(),
  }),
  path: '/admin/organizations/:organizationId/credits',
  responses: {
    200: AdminOrganizationCreditsSchema,
  },
});

export const AdminOrganizationRateLimitItemSchema = z.object({
  modelId: z.string(),
  modelName: z.string(),
  maxInferenceTokensPerMinute: z.number(),
  maxInferenceRequestsPerMinute: z.number(),
});

export type AdminOrganizationRateLimitItemType = z.infer<
  typeof AdminOrganizationRateLimitItemSchema
>;

const AdminOrganizationRateLimitsSchema = z.object({
  overrides: z.array(
    z.object({
      modelId: z.string(),
      modelName: z.string(),
      maxInferenceTokensPerMinute: z.number(),
      maxInferenceRequestsPerMinute: z.number(),
    }),
  ),
});

const adminGetOrganizationRateLimitsContract = c.query({
  method: 'GET',
  pathParams: z.object({
    organizationId: z.string(),
  }),
  query: GenericSearchSchema,
  responses: {
    200: AdminOrganizationRateLimitsSchema,
  },
  path: '/admin/organizations/:organizationId/rate-limits',
});

const UpdateOrganizationRateLimitsPayloadSchema = z.object({
  maxInferenceTokensPerMinute: z.number().int().positive(),
  maxInferenceRequestsPerMinute: z.number().int().positive(),
});

const adminUpdateOrganizationRateLimitsForModel = c.mutation({
  path: '/admin/organizations/:organizationId/rate-limits/:modelId',
  method: 'PUT',
  pathParams: z.object({
    modelId: z.string(),
    organizationId: z.string(),
  }),
  body: UpdateOrganizationRateLimitsPayloadSchema,
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
  },
});

const adminResetOrganizationRateLimitsForModel = c.mutation({
  path: '/admin/organizations/:organizationId/rate-limits/:modelId',
  method: 'DELETE',
  pathParams: z.object({
    modelId: z.string(),
    organizationId: z.string(),
  }),
  body: z.undefined(),
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
  },
});

const AddCreditsToOrganizationPayloadSchema = z.object({
  amount: z.number().positive().int(),
  note: z.string().optional(),
});

const adminAddCreditsToOrganizationContract = c.mutation({
  method: 'POST',
  pathParams: z.object({
    organizationId: z.string(),
  }),
  path: '/admin/organizations/:organizationId/add-credits',
  body: AddCreditsToOrganizationPayloadSchema,
  responses: {
    200: AdminOrganizationCreditsSchema,
  },
});

const RemoveCreditsFromOrganizationPayloadSchema = z.object({
  amount: z.number().positive().int(),
  note: z.string().optional(),
});

const adminRemoveCreditsFromOrganizationContract = c.mutation({
  method: 'POST',
  pathParams: z.object({
    organizationId: z.string(),
  }),
  path: '/admin/organizations/:organizationId/remove-credits',
  body: RemoveCreditsFromOrganizationPayloadSchema,
  responses: {
    200: AdminOrganizationCreditsSchema,
  },
});

const creditTransactionSchema = z.object({
  id: z.string(),
  amount: z.number(),
  note: z.string().optional(),
  transactionType: z.enum(['addition', 'subtraction']),
  createdAt: z.string(),
});

const organizationCreditTransactionsSchema = z.object({
  transactions: z.array(creditTransactionSchema),
  hasNextPage: z.boolean(),
});

const adminListOrganizationCreditTransactionsContract = c.query({
  method: 'GET',
  pathParams: z.object({
    organizationId: z.string(),
  }),
  query: GenericSearchSchema,
  path: '/admin/organizations/:organizationId/credit-transactions',
  responses: {
    200: organizationCreditTransactionsSchema,
  },
});

const adminUpdateOrganizationBillingSettingsBodySchema = z.object({
  pricingModel: PricingModelEnum,
  monthlyCreditAllocation: z.number(),
});

const adminUpdateOrganizationBillingSettingsContract = c.mutation({
  path: '/admin/organizations/:organizationId/billing-settings',
  method: 'PUT',
  pathParams: z.object({
    organizationId: z.string(),
  }),
  body: adminUpdateOrganizationBillingSettingsBodySchema,
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
  },
});

const organizationBillingSettingsSchema = z.object({
  pricingModel: PricingModelEnum,
  monthlyCreditAllocation: z.number(),
});

const adminGetOrganizationBillingSettingsContract = c.query({
  path: '/admin/organizations/:organizationId/billing-settings',
  method: 'GET',
  pathParams: z.object({
    organizationId: z.string(),
  }),
  responses: {
    200: organizationBillingSettingsSchema,
  },
});

export const AdminOrganizationVerifiedDomainSchema = z.object({
  domain: z.string(),
});

export type AdminOrganizationVerifiedDomainType = z.infer<
  typeof AdminOrganizationVerifiedDomainSchema
>;

const OrganizationVerifiedDomainsSchema = z.object({
  domains: AdminOrganizationVerifiedDomainSchema.array(),
});

const adminGetOrganizationVerifiedDomainsContract = c.query({
  path: '/admin/organizations/:organizationId/verified-domains',
  method: 'GET',
  pathParams: z.object({
    organizationId: z.string(),
  }),
  responses: {
    200: OrganizationVerifiedDomainsSchema,
  },
});

const AdminDeleteOrganizationVerifiedDomainBodySchema = z.object({
  domain: z.string(),
});

const adminDeleteOrganizationVerifiedDomainContract = c.mutation({
  path: '/admin/organizations/:organizationId/verified-domains',
  method: 'DELETE',
  pathParams: z.object({
    organizationId: z.string(),
  }),
  body: AdminDeleteOrganizationVerifiedDomainBodySchema,
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
  },
});

const adminAddVerifiedDomainContract = c.mutation({
  path: '/admin/organizations/:organizationId/verified-domains',
  method: 'POST',
  pathParams: z.object({
    organizationId: z.string(),
  }),
  body: AdminDeleteOrganizationVerifiedDomainBodySchema,
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
  },
});

const SSOConfigurationSchema = z.object({
  id: z.string(),
  domain: z.string(),
  workOSOrganizationId: z.string(),
});

const SSOCreateConfigurationSchema = z.object({
  domain: z.string(),
  workOSOrganizationId: z.string(),
});

const adminAddSSOConfigurationContract = c.mutation({
  path: '/admin/organizations/:organizationId/sso-configurations',
  method: 'POST',
  pathParams: z.object({
    organizationId: z.string(),
  }),
  body: SSOCreateConfigurationSchema,
  responses: {
    200: SSOConfigurationSchema,
  },
});

const adminDeleteSSOConfigurationContract = c.mutation({
  path: '/admin/organizations/:organizationId/sso-configurations/:ssoConfigurationId',
  method: 'DELETE',
  pathParams: z.object({
    organizationId: z.string(),
    ssoConfigurationId: z.string(),
  }),
  body: z.undefined(),
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
  },
});

export const ssoConfigurationSchema = z.object({
  id: z.string(),
  domain: z.string(),
  workOSOrganizationId: z.string(),
});

export type SSOConfigurationType = z.infer<typeof ssoConfigurationSchema>;

const SSOConfigurationListSchema = z.object({
  configurations: ssoConfigurationSchema.array(),
  hasNextPage: z.boolean(),
});

const AdminListSSOConfigurationsQuerySchema = z.object({
  limit: z.number().int().positive().optional(),
  offset: z.number().int().optional(),
});

type AdminListSSOConfigurationsQuerySchemaType = z.infer<
  typeof AdminListSSOConfigurationsQuerySchema
>;

const adminListSSOConfigurationsContract = c.query({
  path: '/admin/organizations/:organizationId/sso-configurations',
  method: 'GET',
  query: AdminListSSOConfigurationsQuerySchema,
  pathParams: z.object({
    organizationId: z.string(),
  }),
  responses: {
    200: SSOConfigurationListSchema,
  },
});

const toggleBillingMethodContract = c.mutation({
  path: '/admin/organizations/:organizationId/billing-method',
  method: 'PUT',
  body: z.object({
    method: DatabaseBillingTiers,
  }),
  pathParams: z.object({
    organizationId: z.string(),
  }),
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
  },
});

const adminGetBillingMethodContract = c.query({
  path: '/admin/organizations/:organizationId/billing-method',
  method: 'GET',
  pathParams: z.object({
    organizationId: z.string(),
  }),
  responses: {
    200: z.object({
      method: DatabaseBillingTiers.nullable(),
    }),
  },
});

const refreshBillingDataContract = c.mutation({
  path: '/admin/organizations/:organizationId/billing-method/refresh',
  method: 'POST',
  pathParams: z.object({
    organizationId: z.string(),
  }),
  body: z.undefined(),
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
  },
});

export const adminOrganizationsContracts = {
  getOrganizations: getOrganizationsContract,
  getOrganization: getOrganizationContract,
  toggleBillingMethod: toggleBillingMethodContract,
  adminGetBillingMethod: adminGetBillingMethodContract,
  adminBanOrganization: adminBanOrganizationContract,
  adminUnbanOrganization: adminUnbanOrganizationContract,
  adminAddUserToOrganization: adminAddUserToOrganizationContract,
  adminUpdateOrganizationRateLimitsForModel,
  adminResetOrganizationRateLimitsForModel,
  adminGetOrganizationRateLimits: adminGetOrganizationRateLimitsContract,
  adminRemoveUserFromOrganization: adminRemoveUserFromOrganizationContract,
  adminListOrganizationUsers: adminListOrganizationUsersContract,
  adminGetOrganizationStatistics: adminGetOrganizationStatisticsContract,
  refreshBillingData: refreshBillingDataContract,
  adminDeleteOrganization: adminDeleteOrganizationContract,
  adminGetOrganizationInferenceUsage:
    adminGetOrganizationInferenceUsageByModelContract,
  adminGetOrganizationCredits: adminGetOrganizationCreditsContract,
  adminAddCreditsToOrganization: adminAddCreditsToOrganizationContract,
  adminRemoveCreditsFromOrganization:
    adminRemoveCreditsFromOrganizationContract,
  adminListOrganizationCreditTransactions:
    adminListOrganizationCreditTransactionsContract,
  adminUpdateOrganizationBillingSettings:
    adminUpdateOrganizationBillingSettingsContract,
  adminGetOrganizationBillingSettings:
    adminGetOrganizationBillingSettingsContract,
  adminGetOrganizationVerifiedDomains:
    adminGetOrganizationVerifiedDomainsContract,
  adminDeleteOrganizationVerifiedDomain:
    adminDeleteOrganizationVerifiedDomainContract,
  adminAddVerifiedDomain: adminAddVerifiedDomainContract,
  adminAddSSOConfiguration: adminAddSSOConfigurationContract,
  adminDeleteSSOConfiguration: adminDeleteSSOConfigurationContract,
  adminListSSOConfigurations: adminListSSOConfigurationsContract,
};

export const adminOrganizationsQueryClientKeys = {
  getOrganizations: ['admin', 'organizations'],
  getOrganizationsWithSearch: (search: GenericSearch) => [
    ...adminOrganizationsQueryClientKeys.getOrganizations,
    search,
  ],
  getOrganization: (organizationId: string) => [
    ...adminOrganizationsQueryClientKeys.getOrganizations,
    organizationId,
  ],
  adminListOrganizationUsers: (organizationId: string) => [
    ...adminOrganizationsQueryClientKeys.getOrganization(organizationId),
    'users',
  ],
  adminListOrganizationUsersWithSearch: (
    organizationId: string,
    search: GenericSearch,
  ) => [
    ...adminOrganizationsQueryClientKeys.adminListOrganizationUsers(
      organizationId,
    ),
    search,
  ],
  adminGetOrganizationStatistics: (organizationId: string) => [
    ...adminOrganizationsQueryClientKeys.getOrganization(organizationId),
    'statistics',
  ],
  adminGetOrganizationInferenceUsage: (
    organizationId: string,
    query: AdminOrganizationInferenceUsageQuery,
  ) => [
    ...adminOrganizationsQueryClientKeys.getOrganization(organizationId),
    'inference-usage',
    query,
  ],
  adminGetOrganizationCredits: (organizationId: string) => [
    ...adminOrganizationsQueryClientKeys.getOrganization(organizationId),
    'credits',
  ],
  adminListOrganizationCreditTransactions: (organizationId: string) => [
    ...adminOrganizationsQueryClientKeys.getOrganization(organizationId),
    'credit-transactions',
  ],
  adminListOrganizationCreditTransactionsWithSearch: (
    organizationId: string,
    search: GenericSearch,
  ) => [
    ...adminOrganizationsQueryClientKeys.adminListOrganizationCreditTransactions(
      organizationId,
    ),
    search,
  ],
  adminGetOrganizationBillingSettings: (organizationId: string) => [
    ...adminOrganizationsQueryClientKeys.getOrganization(organizationId),
    'billing-details',
  ],
  adminGetOrganizationRateLimits: (organizationId: string) => [
    ...adminOrganizationsQueryClientKeys.getOrganization(organizationId),
    'rate-limits',
  ],
  adminGetOrganizationRateLimitsWithSearch: (
    organizationId: string,
    search: GenericSearch,
  ) => [
    ...adminOrganizationsQueryClientKeys.adminGetOrganizationRateLimits(
      organizationId,
    ),
    search,
  ],
  adminGetOrganizationVerifiedDomains: (organizationId: string) => [
    ...adminOrganizationsQueryClientKeys.getOrganization(organizationId),
    'verified-domains',
  ],
  adminListSSOConfigurations: (organizationId: string) => [
    ...adminOrganizationsQueryClientKeys.getOrganization(organizationId),
    'sso-configurations',
  ],
  adminListSSOConfigurationsWithSearch: (
    organizationId: string,
    search: AdminListSSOConfigurationsQuerySchemaType,
  ) => [
    ...adminOrganizationsQueryClientKeys.adminListSSOConfigurations(
      organizationId,
    ),
    search,
  ],
  adminGetBillingMethod: (organizationId: string) => [
    ...adminOrganizationsQueryClientKeys.getOrganization(organizationId),
    'billing-method',
  ],
};
