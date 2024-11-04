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
  cursor: z.string().optional(),
  limit: z.number().optional(),
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
  createdAt: z.string(),
});

export const InvitedMembersQueryParams = z.object({
  cursor: z.string().optional(),
  limit: z.number().optional(),
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

/* Invite new team member */
export const InviteNewTeamMemberSchemaBody = z.object({
  email: z.string(),
});

export const InviteNewTeamMemberSchemaResponse = z.object({
  email: z.string(),
});

export const inviteNewTeamMemberContract = c.mutation({
  method: 'POST',
  path: '/organizations/self/invited-members',
  body: InviteNewTeamMemberSchemaBody,
  responses: {
    201: InviteNewTeamMemberSchemaResponse,
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

export const organizationsContract = c.router({
  getCurrentOrganization: getCurrentOrganizationContract,
  getCurrentOrganizationTeamMembers: getCurrentOrganizationTeamMembersContract,
  inviteNewTeamMember: inviteNewTeamMemberContract,
  unInviteTeamMember: unInviteTeamMemberContract,
  removeTeamMember: removeTeamMemberContract,
  listInvitedMembers: listInvitedMembersContract,
  deleteOrganization: deleteOrganizationContract,
  updateOrganization: updateOrganizationContract,
});

export const organizationsQueryClientKeys = {
  getCurrentOrganization: ['organizations', 'self'],
  getCurrentOrganizationTeamMembers: ['organizations', 'self', 'members'],
  getCurrentOrganizationTeamMembersWithSearch: (
    params: GetCurrentOrganizationTeamMembersQueryParamsType
  ) => [
    ...organizationsQueryClientKeys.getCurrentOrganizationTeamMembers,
    params,
  ],
  listInvitedMembers: ['organizations', 'self', 'invited-members'],
  listInvitedMembersWithSearch: (params: InvitedMembersQueryParamsType) => [
    ...organizationsQueryClientKeys.listInvitedMembers,
    params,
  ],
};
