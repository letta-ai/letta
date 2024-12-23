import { z } from 'zod';
import { initContract } from '@ts-rest/core';
import type { GenericSearch } from '$web/web-api/shared/sharedContracts';
import { GenericSearchSchema } from '$web/web-api/shared/sharedContracts';

const c = initContract();

const AdminPublicUser = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const AdminWholeUser = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  imageUrl: z.string(),
  theme: z.string(),
  hubspotContactId: z.string().nullable(),
  activeOrganizationId: z.string(),
  lettaAgentsUserId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AdminWholeUserType = z.infer<typeof AdminWholeUser>;

export type AdminPublicUserType = z.infer<typeof AdminPublicUser>;

const AdminPublicUsers = z.object({
  users: z.array(AdminPublicUser),
  hasNextPage: z.boolean(),
});

export type AdminPublicUsersType = z.infer<typeof AdminPublicUsers>;

const AdminGetUsersContract = c.query({
  method: 'GET',
  query: GenericSearchSchema,
  path: '/admin/users',
  responses: {
    200: AdminPublicUsers,
  },
});

const AdminGetUserContract = c.query({
  method: 'GET',
  pathParams: z.object({
    userId: z.string(),
  }),
  path: '/admin/users/:userId',
  responses: {
    200: AdminWholeUser,
  },
});

const AdminUpdateUserPayload = z.object({
  name: z.string(),
});

const AdminUpdateUserContract = c.mutation({
  method: 'PUT',
  pathParams: z.object({
    userId: z.string(),
  }),
  body: AdminUpdateUserPayload,
  path: '/admin/users/:userId',
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
  },
});

const AdminDeleteUserContract = c.mutation({
  method: 'DELETE',
  pathParams: z.object({
    userId: z.string(),
  }),
  body: z.undefined(),
  path: '/admin/users/:userId',
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
  },
});

const AdminSyncUserWithHubspotContract = c.mutation({
  method: 'POST',
  path: '/admin/users/:userId/sync-hubspot',
  pathParams: z.object({
    userId: z.string(),
  }),
  body: z.undefined(),
  responses: {
    200: z.object({
      hubspotContactId: z.string(),
    }),
  },
});

const AdminWholeUserOrganization = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type AdminWholeUserOrganizationType = z.infer<
  typeof AdminWholeUserOrganization
>;

const AdminWholeUserOrganizationsResponse = z.object({
  organizations: z.array(AdminWholeUserOrganization),
  hasNextPage: z.boolean(),
});

const AdminGetUserOrganizationsContract = c.query({
  method: 'GET',
  pathParams: z.object({
    userId: z.string(),
  }),
  query: GenericSearchSchema,
  path: '/admin/users/:userId/organizations',
  responses: {
    200: AdminWholeUserOrganizationsResponse,
  },
});

export const adminUsersContracts = {
  adminGetUsers: AdminGetUsersContract,
  adminGetUser: AdminGetUserContract,
  adminUpdateUser: AdminUpdateUserContract,
  adminDeleteUser: AdminDeleteUserContract,
  adminSyncUserWithHubspot: AdminSyncUserWithHubspotContract,
  adminGetUserOrganizations: AdminGetUserOrganizationsContract,
};

export const adminUsersQueryClientKeys = {
  adminGetUsers: ['admin', 'users'],
  adminGetUsersWithSearch: (search: GenericSearch) => [
    ...adminUsersQueryClientKeys.adminGetUsers,
    search,
  ],
  adminGetUser: (userId: string) => [
    ...adminUsersQueryClientKeys.adminGetUsers,
    userId,
  ],
  adminGetUserOrganizations: (userId: string) => [
    ...adminUsersQueryClientKeys.adminGetUsers,
    userId,
    'organizations',
  ],
};
