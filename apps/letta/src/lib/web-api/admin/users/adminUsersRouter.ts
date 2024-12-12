/* Admin Get Users */
import type { contracts } from '$letta/web-api/contracts';
import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import { desc, eq, like } from 'drizzle-orm';
import {
  db,
  organizations,
  organizationUsers,
  userMarketingDetails,
  users,
} from '@letta-web/database';
import { createOrUpdateCRMContact } from '@letta-web/crm';
import { inArray } from 'drizzle-orm/sql/expressions/conditions';

type AdminGetUsersResponse = ServerInferResponses<
  typeof contracts.admin.users.adminGetUsers
>;

type AdminGetUsersRequest = ServerInferRequest<
  typeof contracts.admin.users.adminGetUsers
>;

async function adminGetUsers(
  req: AdminGetUsersRequest
): Promise<AdminGetUsersResponse> {
  const { offset, limit = 10, search } = req.query;

  const userResponse = await db.query.users.findMany({
    offset,
    orderBy: desc(users.createdAt),
    limit: limit + 1,
    where: search ? like(users.email, `%${search}%`) : undefined,
  });

  return {
    status: 200,
    body: {
      users: userResponse.slice(0, limit).map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      })),
      hasNextPage: userResponse.length > limit,
    },
  };
}

type AdminGetUserResponse = ServerInferResponses<
  typeof contracts.admin.users.adminGetUser
>;

type AdminGetUserRequest = ServerInferRequest<
  typeof contracts.admin.users.adminGetUser
>;

async function adminGetUser(
  req: AdminGetUserRequest
): Promise<AdminGetUserResponse> {
  const { userId } = req.params;

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    with: {
      userMarketingDetails: true,
    },
  });

  if (!user) {
    return {
      status: 404,
      body: {
        message: 'User not found',
      },
    };
  }

  return {
    status: 200,
    body: {
      id: user.id,
      email: user.email,
      name: user.name,
      imageUrl: user.imageUrl,
      theme: user.theme || 'light',
      hubspotContactId: user.userMarketingDetails?.hubSpotContactId,
      lettaAgentsUserId: user.lettaAgentsId || '',
      activeOrganizationId: user.activeOrganizationId || '',
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    },
  };
}

type AdminUpdateUserResponse = ServerInferResponses<
  typeof contracts.admin.users.adminUpdateUser
>;

type AdminUpdateUserRequest = ServerInferRequest<
  typeof contracts.admin.users.adminUpdateUser
>;

async function adminUpdateUser(
  req: AdminUpdateUserRequest
): Promise<AdminUpdateUserResponse> {
  const { userId } = req.params;
  const { name } = req.body;

  await db
    .update(users)
    .set({
      name,
    })
    .where(eq(users.id, userId));

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

type AdminDeleteUserResponse = ServerInferResponses<
  typeof contracts.admin.users.adminDeleteUser
>;

type AdminDeleteUserRequest = ServerInferRequest<
  typeof contracts.admin.users.adminDeleteUser
>;

async function adminDeleteUser(
  req: AdminDeleteUserRequest
): Promise<AdminDeleteUserResponse> {
  const { userId } = req.params;

  await db.delete(users).where(eq(users.id, userId));

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

type AdminSyncUserWithHubspotResponse = ServerInferResponses<
  typeof contracts.admin.users.adminSyncUserWithHubspot
>;

type AdminSyncUserWithHubspotRequest = ServerInferRequest<
  typeof contracts.admin.users.adminSyncUserWithHubspot
>;

async function adminSyncUserWithHubspot(
  req: AdminSyncUserWithHubspotRequest
): Promise<AdminSyncUserWithHubspotResponse> {
  const { userId } = req.params;

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    with: {
      userMarketingDetails: true,
    },
  });

  if (!user) {
    return {
      status: 404,
      body: {
        message: 'User not found',
      },
    };
  }
  const { email } = user;

  const [firstName, lastName] = user.name.split(' ');

  const contact = await createOrUpdateCRMContact({
    email,
    firstName,
    lastName,
    consentedToEmailMarketing: !!user.userMarketingDetails?.consentedToEmailsAt,
    usesLettaFor: user.userMarketingDetails?.useCases || [],
    reasonsForUsingLetta: user.userMarketingDetails?.reasons || [],
  });

  await db
    .update(userMarketingDetails)
    .set({
      hubSpotContactId: contact.id,
    })
    .where(eq(userMarketingDetails.userId, userId));

  return {
    status: 200,
    body: {
      hubspotContactId: contact.id,
    },
  };
}

type AdminGetUserOrganizationsResponse = ServerInferResponses<
  typeof contracts.admin.users.adminGetUserOrganizations
>;

type AdminGetUserOrganizationsRequest = ServerInferRequest<
  typeof contracts.admin.users.adminGetUserOrganizations
>;

async function adminGetUserOrganizations(
  req: AdminGetUserOrganizationsRequest
): Promise<AdminGetUserOrganizationsResponse> {
  const { userId } = req.params;

  const organizationAssociations = await db.query.organizationUsers.findMany({
    where: eq(organizationUsers.userId, userId),
  });

  const organizationsResponse = await db.query.organizations.findMany({
    where: inArray(
      organizations.id,
      organizationAssociations.map((association) => association.organizationId)
    ),
  });

  return {
    status: 200,
    body: {
      organizations: organizationsResponse.map((organization) => ({
        id: organization.id,
        name: organization.name,
        createdAt: organization.createdAt.toISOString(),
        updatedAt: organization.updatedAt.toISOString(),
      })),
      hasNextPage: false,
    },
  };
}

export const adminUsersRouter = {
  adminGetUsers,
  adminGetUser,
  adminUpdateUser,
  adminDeleteUser,
  adminSyncUserWithHubspot,
  adminGetUserOrganizations,
};
