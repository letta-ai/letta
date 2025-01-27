import type { ServerInferResponses } from '@ts-rest/core';
import { initContract } from '@ts-rest/core';
import { z } from 'zod';

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
  creditCards: CreditCardSchema.array(),
  billingTier: z.string().optional(),
  totalCredits: z.number(),
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

export const organizationsContract = c.router({
  getCurrentOrganization: getCurrentOrganizationContract,
  getCurrentOrganizationPreferences: getCurrentOrganizationPreferencesContract,
  getCurrentOrganizationTeamMembers: getCurrentOrganizationTeamMembersContract,
  inviteNewTeamMember: inviteNewTeamMemberContract,
  unInviteTeamMember: unInviteTeamMemberContract,
  removeTeamMember: removeTeamMemberContract,
  listInvitedMembers: listInvitedMembersContract,
  deleteOrganization: deleteOrganizationContract,
  updateOrganization: updateOrganizationContract,
  createOrganization: createOrganizationContract,
  regenerateInviteCode: regenerateInviteCodeContract,
  getInviteByCode: GetInviteByCodeContract,
  getCurrentOrganizationBillingInfo: getCurrentOrganizationBillingInfoContract,
  startSetupIntent: startSetupIntentContract,
  removeOrganizationBillingMethod: removeOrganizationBillingMethodContract,
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
  listInvitedMembers: ['organizations', 'self', 'invited-members'],
  listInvitedMembersWithSearch: (params: InvitedMembersQueryParamsType) => [
    ...organizationsQueryClientKeys.listInvitedMembers,
    params,
  ],
  getCurrentOrganizationPreferences: ['organizations', 'self', 'preferences'],
  getInviteByCode: (inviteCode: string) => ['invites', inviteCode],
  getCurrentOrganizationBillingInfo: ['organizations', 'self', 'billing-info'],
  startSetupIntent: ['organizations', 'self', 'setup-intent'],
};
