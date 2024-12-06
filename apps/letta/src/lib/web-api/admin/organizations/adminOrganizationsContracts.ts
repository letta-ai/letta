import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import {
  type GenericSearch,
  GenericSearchSchema,
} from '$letta/web-api/shared/sharedContracts';

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

/* Toggle Cloud for Organization */
export const ToggleCloudOrganizationPayloadSchema = z.object({
  enabledCloud: z.boolean(),
});

const toggleCloudOrganizationContract = c.mutation({
  method: 'PUT',
  pathParams: z.object({
    organizationId: z.string(),
  }),
  path: '/admin/organizations/:organizationId/cloud-access',
  body: ToggleCloudOrganizationPayloadSchema,
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

export const adminOrganizationsContracts = {
  getOrganizations: getOrganizationsContract,
  getOrganization: getOrganizationContract,
  toggleCloudOrganization: toggleCloudOrganizationContract,
  adminBanOrganization: adminBanOrganizationContract,
  adminUnbanOrganization: adminUnbanOrganizationContract,
  adminAddUserToOrganization: adminAddUserToOrganizationContract,
  adminRemoveUserFromOrganization: adminRemoveUserFromOrganizationContract,
  adminListOrganizationUsers: adminListOrganizationUsersContract,
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
    search: GenericSearch
  ) => [
    ...adminOrganizationsQueryClientKeys.adminListOrganizationUsers(
      organizationId
    ),
    search,
  ],
};
