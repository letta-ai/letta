import type { ServerInferResponses } from '@ts-rest/core';
import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { UserPresetRoles } from '@letta-cloud/service-rbac';
import { BillingTiers } from '@letta-cloud/types';

const c = initContract();

/* Get Current Organization */
export const CurrentOrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  isAdmin: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const getCurrentOrganizationContract = c.query({
  method: 'GET',
  path: '/organizations/self',
  responses: {
    200: CurrentOrganizationSchema,
  },
});

export type GetCurrentOrganizationSuccessResponse = ServerInferResponses<
  typeof getCurrentOrganizationContract,
  200
>;

/* Get current organization team members */
export const CurrentOrganizationTeamMembersSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: UserPresetRoles,
  email: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type CurrentOrganizationTeamMembersType = z.infer<
  typeof CurrentOrganizationTeamMembersSchema
>;

export const GetCurrentOrganizationTeamMembersResponse = z.object({
  members: z.array(CurrentOrganizationTeamMembersSchema),
  nextCursor: z.string().optional(),
});

export type GetCurrentOrganizationTeamMembersResponseType = z.infer<
  typeof GetCurrentOrganizationTeamMembersResponse
>;

export const GetCurrentOrganizationTeamMembersQueryParams = z.object({
  offset: z.number().optional(),
  limit: z.number().optional(),
  search: z.string().optional(),
});

type GetCurrentOrganizationTeamMembersQueryParamsType = z.infer<
  typeof GetCurrentOrganizationTeamMembersQueryParams
>;

export const getCurrentOrganizationTeamMembersContract = c.query({
  method: 'GET',
  path: '/organizations/self/members',
  query: GetCurrentOrganizationTeamMembersQueryParams,
  responses: {
    200: GetCurrentOrganizationTeamMembersResponse,
  },
});

export type GetCurrentOrganizationTeamMembersResponseBodyType =
  ServerInferResponses<typeof getCurrentOrganizationTeamMembersContract, 200>;

/* List invited members */
export const InvitedMembersSchema = z.object({
  email: z.string(),
  inviteCode: z.string(),
  createdAt: z.string(),
  id: z.string(),
});

export const InvitedMembersQueryParams = z.object({
  cursor: z.string().optional(),
  limit: z.number().optional(),
  search: z.string().optional(),
});

type InvitedMembersQueryParamsType = z.infer<typeof InvitedMembersQueryParams>;

export const InvitedMembersResponse = z.object({
  members: z.array(InvitedMembersSchema),
  nextCursor: z.string().optional(),
});

export const listInvitedMembersContract = c.query({
  method: 'GET',
  path: '/organizations/self/invited-members',
  query: InvitedMembersQueryParams,
  responses: {
    200: InvitedMembersResponse,
  },
});

export type ListInvitedMembersResponseBodyType = ServerInferResponses<
  typeof listInvitedMembersContract,
  200
>;

/* Regenerate invite code */
export const RegenerateInviteCodeSchema = z.object({
  memberId: z.string(),
});

export const regenerateInviteCodeContract = c.mutation({
  method: 'POST',
  path: '/organizations/self/invited-members/:memberId/regenerate',
  pathParams: RegenerateInviteCodeSchema,
  body: z.undefined(),
  responses: {
    200: z.object({
      email: z.string(),
      inviteCode: z.string(),
      id: z.string(),
    }),
  },
});

/* Invite new team member */
export const InviteNewTeamMemberSchemaBody = z.object({
  email: z.string(),
});

export const InviteNewTeamMemberSchemaResponse = z.object({
  email: z.string(),
  inviteCode: z.string(),
  id: z.string(),
});

export const InviteNewMember200Response = z.object({
  email: z.string(),
  id: z.string(),
  name: z.string(),
});

export const inviteNewTeamMemberContract = c.mutation({
  method: 'POST',
  path: '/organizations/self/invited-members',
  body: InviteNewTeamMemberSchemaBody,
  responses: {
    201: InviteNewTeamMemberSchemaResponse,
    200: InviteNewMember200Response,
    400: z
      .object({
        message: z.literal('User already invited'),
        errorCode: z.literal('userAlreadyInvited'),
      })
      .or(
        z.object({
          message: z.literal('User already in the organization'),
          errorCode: z.literal('userAlreadyInOrganization'),
        }),
      ),
  },
});

/* disinvite team member */
export const UnInviteTeamMemberSchema = z.object({
  memberId: z.string(),
});

export const unInviteTeamMemberContract = c.mutation({
  method: 'DELETE',
  path: '/organizations/self/invited-members/:memberId',
  pathParams: UnInviteTeamMemberSchema,
  body: z.undefined(),
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
  },
});

/* Remove team member */
export const RemoveTeamMemberSchema = z.object({
  memberId: z.string(),
});

export const removeTeamMemberContract = c.mutation({
  method: 'DELETE',
  path: '/organizations/self/members/:memberId',
  pathParams: RemoveTeamMemberSchema,
  body: z.undefined(),
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
  },
});

/* Delete organization */
export const deleteOrganizationContract = c.mutation({
  method: 'DELETE',
  path: '/organizations/self',
  body: z.undefined(),
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
  },
});

/* update organization */
export const UpdateOrganizationSchema = z.object({
  name: z.string(),
});

export const updateOrganizationContract = c.mutation({
  method: 'PATCH',
  path: '/organizations/self',
  body: UpdateOrganizationSchema,
  responses: {
    200: z.object({
      name: z.string(),
    }),
  },
});

/* create organization */
export const CreateOrganizationSchema = z.object({
  name: z.string(),
});

export const CreateOrganizationResponse = z.object({
  id: z.string(),
  name: z.string(),
});

export const createOrganizationContract = c.mutation({
  method: 'POST',
  path: '/organizations',
  body: CreateOrganizationSchema,
  responses: {
    201: CreateOrganizationResponse,
  },
});

/* Get Organization Preferences */
const CurrentOrganizationPreferencesSchema = z.object({
  defaultProjectId: z.string().optional(),
});

export const getCurrentOrganizationPreferencesContract = c.query({
  method: 'GET',
  path: '/organizations/self/preferences',
  responses: {
    200: CurrentOrganizationPreferencesSchema,
  },
});

const purchaseCreditsContract = c.mutation({
  path: '/organizations/self/credits',
  method: 'POST',
  body: z.object({
    credits: z.number(),
    cardId: z.string(),
  }),
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
    400: z.object({
      message: z.string(),
      errorCode: z.literal('paymentError'),
    }),
  },
});

const GetInviteByCodeResponse = z.object({
  organizationName: z.string(),
  email: z.string(),
});

const GetInviteByCodeContract = c.query({
  method: 'GET',
  path: '/invites/:inviteCode',
  responses: {
    200: GetInviteByCodeResponse,
  },
});

const BillingAddressSchema = z.object({
  address1: z.string(),
  address2: z.string().optional(),
  city: z.string(),
  state: z.string(),
  postalCode: z.string(),
  country: z.string(),
});

const CreditCardSchema = z.object({
  id: z.string(),
  last4: z.string(),
  expMonth: z.number(),
  expYear: z.number(),
  brand: z.string(),
  billingAddress: BillingAddressSchema,
  isDefault: z.boolean(),
  isExpired: z.boolean(),
  name: z.string(),
});

export type CreditCardType = z.infer<typeof CreditCardSchema>;

const GetCurrentOrganizationBillingInfoResponse = z.object({
  billingTier: BillingTiers,
  totalCredits: z.number(),
  isCancelled: z.boolean(),
  billingPeriodEnd: z.string().optional(),
});

const getCurrentOrganizationBillingInfoContract = c.query({
  path: '/organizations/self/billing-info',
  method: 'GET',
  responses: {
    200: GetCurrentOrganizationBillingInfoResponse,
  },
});

const startSetupIntentContract = c.query({
  path: '/organizations/self/setup-intent',
  method: 'GET',
  responses: {
    200: z.object({
      clientSecret: z.string(),
    }),
  },
});

const removeOrganizationBillingMethodContract = c.mutation({
  path: '/organizations/self/billing-info/methods/:methodId',
  method: 'DELETE',
  pathParams: z.object({
    methodId: z.string(),
  }),
  body: z.undefined(),
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
  },
});

const setDefaultOrganizationBillingMethodContract = c.mutation({
  path: '/organizations/self/billing-info/methods/:methodId/default',
  method: 'POST',
  pathParams: z.object({
    methodId: z.string(),
  }),
  body: z.undefined(),
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
  },
});

const updateOrganizationUserRolePayload = z.object({
  role: UserPresetRoles,
  customPermissions: z.array(z.string()).optional(),
});

const updateOrganizationUserRoleResponse = z.object({
  success: z.boolean(),
});

const updateOrganizationUserRoleContract = c.mutation({
  path: '/organizations/self/members/:userId/role',
  method: 'PATCH',
  pathParams: z.object({
    userId: z.string(),
  }),
  body: updateOrganizationUserRolePayload,
  responses: {
    200: updateOrganizationUserRoleResponse,
  },
});

export const VerifyDomainSchema = z.object({
  domain: z.string(),
  id: z.string(),
});

const listVerifiedDomainsContract = c.query({
  path: '/organizations/self/verified-domains',
  method: 'GET',
  responses: {
    200: z.object({
      domains: VerifyDomainSchema.array(),
    }),
  },
});

const createInviteRuleContract = c.mutation({
  path: '/organizations/self/invite-rules',
  method: 'POST',
  body: z.object({
    domainId: z.string(),
    role: UserPresetRoles,
  }),
  responses: {
    201: z.object({
      id: z.string(),
      role: UserPresetRoles,
      domain: z.string(),
    }),
    400: z.object({
      message: z.string(),
      errorCode: z.enum(['domainNotFound', 'ruleAlreadyExists']),
    }),
  },
});

export const InviteRuleSchema = z.object({
  id: z.string(),
  domain: z.string(),
  role: UserPresetRoles,
});

export type InviteRuleType = z.infer<typeof InviteRuleSchema>;

const listInviteRulesContract = c.query({
  path: '/organizations/self/invite-rules',
  method: 'GET',
  responses: {
    200: z.object({
      rules: InviteRuleSchema.array(),
    }),
  },
});

const deleteInviteRuleContract = c.mutation({
  path: '/organizations/self/invite-rules/:ruleId',
  method: 'DELETE',
  pathParams: z.object({
    ruleId: z.string(),
  }),
  body: z.undefined(),
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
  },
});

const PaymentMethodSchema = z.object({
  id: z.string().nullable(),
  last4: z.string().nullable(),
  expMonth: z.number().nullable(),
  expYear: z.number().nullable(),
  brand: z.string().nullable(),
});

const BillingHistorySchema = z.object({
  id: z.string(),
  amount: z.number(),
  createdAt: z.string(),
  description: z.string(),
  receiptLink: z.string(),
  paymentMethod: PaymentMethodSchema,
});

export type BillingHistorySchemaType = z.infer<typeof BillingHistorySchema>;

const BillingHistoryQueryParams = z.object({
  cursor: z.string().optional(),
  limit: z.number().optional(),
});

type BillingHistoryQueryParamsType = z.infer<typeof BillingHistoryQueryParams>;

const BillingHistoryResponse = z.object({
  nextCursor: z.string().optional(),
  history: BillingHistorySchema.array(),
});

const getOrganizationBillingHistoryContract = c.query({
  path: '/organizations/self/billing-history',
  method: 'GET',
  query: BillingHistoryQueryParams,
  responses: {
    200: BillingHistoryResponse,
  },
});

const getOrganizationCreditsContract = c.query({
  path: '/organizations/self/credits',
  method: 'GET',
  responses: {
    200: z.object({
      credits: z.number(),
    }),
  },
});

const upgradeOrganizationContract = c.mutation({
  path: '/organizations/self/upgrade',
  method: 'POST',
  body: z.object({
    cardId: z.string(),
    tier: BillingTiers,
  }),
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
    400: z.object({
      message: z.string(),
      errorCode: z.enum(['paymentError']),
    }),
  },
});

const cancelOrganizationSubscriptionContract = c.mutation({
  path: '/organizations/self/subscription',
  method: 'DELETE',
  body: z.undefined(),
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
    400: z.object({
      message: z.string(),
      errorCode: z.enum(['paymentError']),
    }),
  },
});

const resumeOrganizationSubscriptionContract = c.mutation({
  path: '/organizations/self/subscription/resume',
  method: 'POST',
  body: z.undefined(),
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
    400: z.object({
      message: z.string(),
      errorCode: z.enum(['paymentError']),
    }),
  },
});

const OrganizationQuota = z.object({
  freeModelRequests: z.number(),
  premiumModelRequests: z.number(),
  agents: z.number(),
});

const getOrganizationQuotasContract = c.query({
  path: '/organizations/self/quotas',
  method: 'GET',
  responses: {
    200: OrganizationQuota,
  },
});

const FullOrganizationQuota = z.object({
  agents: z.number(),
  identities: z.number(),
  projects: z.number(),
  dataSources: z.number(),
  templates: z.number(),
  premiumInferencesPerMonth: z.number(),
  freeInferencesPerMonth: z.number(),
  storage: z.number(),
  memoryBlocks: z.number(),
});

const getFullOrganizationQuotasContract = c.query({
  path: '/organizations/self/quotas/full',
  method: 'GET',
  responses: {
    200: FullOrganizationQuota,
  },
});

const getOrganizationPaymentMethodsContract = c.query({
  path: '/organizations/self/billing-info/methods',
  method: 'GET',
  responses: {
    200: z.object({
      creditCards: CreditCardSchema.array(),
    }),
  },
});

export const organizationsContract = c.router({
  getCurrentOrganization: getCurrentOrganizationContract,
  getCurrentOrganizationPreferences: getCurrentOrganizationPreferencesContract,
  getCurrentOrganizationTeamMembers: getCurrentOrganizationTeamMembersContract,
  inviteNewTeamMember: inviteNewTeamMemberContract,
  unInviteTeamMember: unInviteTeamMemberContract,
  removeTeamMember: removeTeamMemberContract,
  updateOrganizationUserRole: updateOrganizationUserRoleContract,
  listInvitedMembers: listInvitedMembersContract,
  purchaseCredits: purchaseCreditsContract,
  deleteOrganization: deleteOrganizationContract,
  updateOrganization: updateOrganizationContract,
  createOrganization: createOrganizationContract,
  getFullOrganizationQuotas: getFullOrganizationQuotasContract,
  regenerateInviteCode: regenerateInviteCodeContract,
  getInviteByCode: GetInviteByCodeContract,
  upgradeOrganization: upgradeOrganizationContract,
  getCurrentOrganizationBillingInfo: getCurrentOrganizationBillingInfoContract,
  startSetupIntent: startSetupIntentContract,
  removeOrganizationBillingMethod: removeOrganizationBillingMethodContract,
  setDefaultOrganizationBillingMethod:
    setDefaultOrganizationBillingMethodContract,
  listVerifiedDomains: listVerifiedDomainsContract,
  createInviteRule: createInviteRuleContract,
  listInviteRules: listInviteRulesContract,
  getOrganizationPaymentMethods: getOrganizationPaymentMethodsContract,
  deleteInviteRule: deleteInviteRuleContract,
  getOrganizationCredits: getOrganizationCreditsContract,
  cancelOrganizationSubscription: cancelOrganizationSubscriptionContract,
  resumeOrganizationSubscription: resumeOrganizationSubscriptionContract,
  getOrganizationQuotas: getOrganizationQuotasContract,
  getOrganizationBillingHistory: getOrganizationBillingHistoryContract,
});

export const organizationsQueryClientKeys = {
  getCurrentOrganization: ['organizations', 'self'],
  getCurrentOrganizationTeamMembers: ['organizations', 'self', 'members'],
  getCurrentOrganizationTeamMembersWithSearch: (
    params: GetCurrentOrganizationTeamMembersQueryParamsType,
  ) => [
    ...organizationsQueryClientKeys.getCurrentOrganizationTeamMembers,
    params,
  ],
  getOrganizationCredits: ['organizations', 'self', 'credits'],
  listInvitedMembers: ['organizations', 'self', 'invited-members'],
  listInvitedMembersWithSearch: (params: InvitedMembersQueryParamsType) => [
    ...organizationsQueryClientKeys.listInvitedMembers,
    params,
  ],
  getCurrentOrganizationPreferences: ['organizations', 'self', 'preferences'],
  getInviteByCode: (inviteCode: string) => ['invites', inviteCode],
  getCurrentOrganizationBillingInfo: ['organizations', 'self', 'billing-info'],
  startSetupIntent: ['organizations', 'self', 'setup-intent'],
  listVerifiedDomains: ['organizations', 'self', 'verified-domains'],
  listInviteRules: ['organizations', 'self', 'invite-rules'],
  getOrganizationBillingHistory: ['organizations', 'self', 'billing-history'],
  getOrganizationQuotas: ['organizations', 'self', 'quotas'],
  getOrganizationBillingHistoryWithSearch: (
    search: BillingHistoryQueryParamsType,
  ) => [...organizationsQueryClientKeys.getOrganizationBillingHistory, search],
  getFullOrganizationQuotas: ['organizations', 'self', 'quotas', 'full'],
  getOrganizationPaymentMethods: ['organizations', 'self', 'payment-methods'],
};
