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

export const adminOrganizationsContracts = {
  getOrganizations: getOrganizationsContract,
  getOrganization: getOrganizationContract,
  toggleCloudOrganization: toggleCloudOrganizationContract,
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
}
