import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '$web/web-api/contracts';
import {
  agentTemplates,
  db,
  deployedAgents,
  lettaAPIKeys,
  organizations,
  organizationUsers,
  users,
} from '@letta-web/database';
import { and, count, eq, ilike, inArray } from 'drizzle-orm';
import { AdminService } from '@letta-web/letta-agents-api';
import { getUsageByModelSummaryAndOrganizationId } from '$web/web-api/usage/usageRouter';

/* Get Organizations */
type GetOrganizationsResponse = ServerInferResponses<
  typeof contracts.admin.organizations.getOrganizations
>;

type GetOrganizationsQuery = ServerInferRequest<
  typeof contracts.admin.organizations.getOrganizations
>;

async function getOrganizations(
  req: GetOrganizationsQuery
): Promise<GetOrganizationsResponse> {
  const { offset, limit = 10, search } = req.query;
  const where = search ? ilike(organizations.name, `%${search}%`) : undefined;

  const response = await db.query.organizations.findMany({
    offset,
    limit: limit + 1,
    where: where,
  });

  return {
    status: 200,
    body: {
      organizations: response.slice(0, limit).map((organization) => ({
        id: organization.id,
        name: organization.name,
        createdAt: organization.createdAt.toISOString(),
        updatedAt: organization.updatedAt.toISOString(),
      })),
      hasNextPage: response.length > limit,
    },
  };
}

/* Get Organization */
type GetOrganizationResponse = ServerInferResponses<
  typeof contracts.admin.organizations.getOrganization
>;

type GetOrganizationRequest = ServerInferRequest<
  typeof contracts.admin.organizations.getOrganization
>;

async function getOrganization(
  req: GetOrganizationRequest
): Promise<GetOrganizationResponse> {
  const { organizationId } = req.params;

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });

  if (!organization) {
    return {
      status: 404,
      body: {
        message: 'Organization not found',
      },
    };
  }

  return {
    status: 200,
    body: {
      id: organization.id,
      name: organization.name,
      lettaAgentsId: organization.lettaAgentsId,
      bannedAt: organization.bannedAt?.toISOString() ?? null,
      enabledCloudAt: organization.enabledCloudAt?.toISOString() ?? null,
      createdAt: organization.createdAt.toISOString(),
      updatedAt: organization.updatedAt.toISOString(),
    },
  };
}

/* Toggle Cloud for Organization */
type ToggleCloudOrganizationRequest = ServerInferRequest<
  typeof contracts.admin.organizations.toggleCloudOrganization
>;

type ToggleCloudOrganizationResponse = ServerInferResponses<
  typeof contracts.admin.organizations.toggleCloudOrganization
>;

async function toggleCloudOrganization(
  req: ToggleCloudOrganizationRequest
): Promise<ToggleCloudOrganizationResponse> {
  const { organizationId } = req.params;
  const { enabledCloud } = req.body;

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });

  if (!organization) {
    return {
      status: 404,
      body: {
        message: 'Organization not found',
      },
    };
  }

  await db
    .update(organizations)
    .set({
      enabledCloudAt: enabledCloud ? new Date() : null,
    })
    .where(eq(organizations.id, organizationId));

  return {
    status: 200,
    body: {
      id: organization.id,
      name: organization.name,
      bannedAt: organization.bannedAt?.toISOString() ?? null,
      lettaAgentsId: organization.lettaAgentsId,
      enabledCloudAt: enabledCloud ? new Date().toISOString() : null,
      createdAt: organization.createdAt.toISOString(),
      updatedAt: organization.updatedAt.toISOString(),
    },
  };
}

type AdminBanOrganizationRequest = ServerInferRequest<
  typeof contracts.admin.organizations.adminBanOrganization
>;

type AdminBanOrganizationResponse = ServerInferResponses<
  typeof contracts.admin.organizations.adminBanOrganization
>;

async function adminBanOrganization(
  req: AdminBanOrganizationRequest
): Promise<AdminBanOrganizationResponse> {
  const { organizationId } = req.params;

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });

  if (!organization) {
    return {
      status: 404,
      body: {
        message: 'Organization not found',
      },
    };
  }

  if (organization.isAdmin) {
    return {
      status: 400,
      body: {
        message: 'Cannot ban an admin organization',
      },
    };
  }

  // delete all api keys
  await db
    .delete(lettaAPIKeys)
    .where(eq(lettaAPIKeys.organizationId, organizationId));

  await db
    .update(organizations)
    .set({
      bannedAt: new Date(),
    })
    .where(eq(organizations.id, organizationId));

  // ban all users in the organization
  const organizationUserList = await db.query.organizationUsers.findMany({
    where: eq(organizationUsers.organizationId, organizationId),
  });

  await db
    .update(users)
    .set({
      bannedAt: new Date(),
    })
    .where(
      inArray(
        users.id,
        organizationUserList.map((user) => user.userId)
      )
    );

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

type UnbanOrganizationRequest = ServerInferRequest<
  typeof contracts.admin.organizations.adminUnbanOrganization
>;

type UnbanOrganizationResponse = ServerInferResponses<
  typeof contracts.admin.organizations.adminUnbanOrganization
>;

async function adminUnbanOrganization(
  req: UnbanOrganizationRequest
): Promise<UnbanOrganizationResponse> {
  const { organizationId } = req.params;

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });

  if (!organization) {
    return {
      status: 404,
      body: {
        message: 'Organization not found',
      },
    };
  }

  await db
    .update(organizations)
    .set({
      bannedAt: null,
    })
    .where(eq(organizations.id, organizationId));

  // unban all users in the organization
  const organizationUserList = await db.query.organizationUsers.findMany({
    where: eq(organizationUsers.organizationId, organizationId),
  });

  await db
    .update(users)
    .set({
      bannedAt: null,
    })
    .where(
      inArray(
        users.id,
        organizationUserList.map((user) => user.userId)
      )
    );

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

type AdminAddUserToOrganizationRequest = ServerInferRequest<
  typeof contracts.admin.organizations.adminAddUserToOrganization
>;

type AdminAddUserToOrganizationResponse = ServerInferResponses<
  typeof contracts.admin.organizations.adminAddUserToOrganization
>;

async function adminAddUserToOrganization(
  req: AdminAddUserToOrganizationRequest
): Promise<AdminAddUserToOrganizationResponse> {
  const { organizationId } = req.params;
  const { userId } = req.body;

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });

  if (!organization) {
    return {
      status: 404,
      body: {
        message: 'Organization not found',
      },
    };
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    return {
      status: 404,
      body: {
        message: 'User not found',
      },
    };
  }

  const existingOrganizationUser = await db.query.organizationUsers.findFirst({
    where: and(
      eq(organizationUsers.organizationId, organizationId),
      eq(organizationUsers.userId, userId)
    ),
  });

  if (existingOrganizationUser) {
    return {
      status: 400,
      body: {
        message: 'User is already in the organization',
      },
    };
  }

  await db.insert(organizationUsers).values({
    organizationId: organizationId,
    userId: userId,
    permissions: {
      isOrganizationAdmin: true,
    },
  });

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

type AdminRemoveUserFromOrganizationRequest = ServerInferRequest<
  typeof contracts.admin.organizations.adminRemoveUserFromOrganization
>;

type AdminRemoveUserFromOrganizationResponse = ServerInferResponses<
  typeof contracts.admin.organizations.adminRemoveUserFromOrganization
>;

async function adminRemoveUserFromOrganization(
  req: AdminRemoveUserFromOrganizationRequest
): Promise<AdminRemoveUserFromOrganizationResponse> {
  const { organizationId } = req.params;
  const { userId } = req.body;

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });

  if (!organization) {
    return {
      status: 404,
      body: {
        message: 'Organization not found',
      },
    };
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    return {
      status: 404,
      body: {
        message: 'User not found',
      },
    };
  }

  const existingOrganizationUser = await db.query.organizationUsers.findFirst({
    where: and(
      eq(organizationUsers.organizationId, organizationId),
      eq(organizationUsers.userId, userId)
    ),
  });

  if (!existingOrganizationUser) {
    return {
      status: 400,
      body: {
        message: 'User is not in the organization',
      },
    };
  }

  if (user.activeOrganizationId === organizationId) {
    await db
      .update(users)
      .set({
        activeOrganizationId: null,
      })
      .where(eq(users.id, userId));
  }

  await db
    .delete(organizationUsers)
    .where(
      and(
        eq(organizationUsers.organizationId, organizationId),
        eq(organizationUsers.userId, userId)
      )
    );

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

type AdminListOrganizationUsersRequest = ServerInferRequest<
  typeof contracts.admin.organizations.adminListOrganizationUsers
>;

type AdminListOrganizationUsersResponse = ServerInferResponses<
  typeof contracts.admin.organizations.adminListOrganizationUsers
>;

async function adminListOrganizationUsers(
  req: AdminListOrganizationUsersRequest
): Promise<AdminListOrganizationUsersResponse> {
  const { organizationId } = req.params;
  const { offset, limit = 10 } = req.query;

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });

  if (!organization) {
    return {
      status: 404,
      body: {
        message: 'Organization not found',
      },
    };
  }

  const organizationUsersList = await db.query.organizationUsers.findMany({
    offset,
    limit: limit + 1,
    where: eq(organizationUsers.organizationId, organizationId),
  });

  const organizationUsersMap = Object.fromEntries(
    organizationUsersList.map((ou) => [ou.userId, ou])
  );

  const usersList = await db.query.users.findMany({
    where: inArray(
      users.id,
      organizationUsersList.map((ou) => ou.userId)
    ),
  });

  return {
    status: 200,
    body: {
      users: usersList
        .map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          addedAt: organizationUsersMap[user.id].createdAt.toISOString(),
        }))
        .slice(0, limit),
      hasNextPage: organizationUsersList.length > limit,
    },
  };
}

type AdminGetOrganizationStatisticsRequest = ServerInferRequest<
  typeof contracts.admin.organizations.adminGetOrganizationStatistics
>;

type AdminGetOrganizationStatisticsResponse = ServerInferResponses<
  typeof contracts.admin.organizations.adminGetOrganizationStatistics
>;

async function adminGetOrganizationStatistics(
  req: AdminGetOrganizationStatisticsRequest
): Promise<AdminGetOrganizationStatisticsResponse> {
  const { organizationId } = req.params;

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });

  if (!organization) {
    return {
      status: 404,
      body: {
        message: 'Organization not found',
      },
    };
  }

  const [
    [{ count: totalMembers }],
    [{ count: totalTemplates }],
    [{ count: totalDeployedAgents }],
  ] = await Promise.all([
    db
      .select({ count: count() })
      .from(organizationUsers)
      .where(eq(organizationUsers.organizationId, organizationId)),
    db
      .select({ count: count() })
      .from(agentTemplates)
      .where(eq(agentTemplates.organizationId, organizationId)),
    db
      .select({ count: count() })
      .from(deployedAgents)
      .where(eq(deployedAgents.organizationId, organizationId)),
  ]);

  return {
    status: 200,
    body: {
      totalMembers,
      totalTemplates,
      totalDeployedAgents,
    },
  };
}

type AdminDeleteOrganizationRequest = ServerInferRequest<
  typeof contracts.admin.organizations.adminDeleteOrganization
>;

type AdminDeleteOrganizationResponse = ServerInferResponses<
  typeof contracts.admin.organizations.adminDeleteOrganization
>;

async function adminDeleteOrganization(
  req: AdminDeleteOrganizationRequest
): Promise<AdminDeleteOrganizationResponse> {
  const { organizationId } = req.params;

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });

  if (!organization) {
    return {
      status: 404,
      body: {
        message: 'Organization not found',
      },
    };
  }

  await db.delete(organizations).where(eq(organizations.id, organizationId));

  await AdminService.deleteOrganizationById({
    orgId: organization.lettaAgentsId,
  });

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

type AdminGetOrganizationInferenceUsageRequest = ServerInferRequest<
  typeof contracts.admin.organizations.adminGetOrganizationInferenceUsage
>;

type AdminGetOrganizationInferenceUsageResponse = ServerInferResponses<
  typeof contracts.admin.organizations.adminGetOrganizationInferenceUsage
>;

async function adminGetOrganizationInferenceUsage(
  req: AdminGetOrganizationInferenceUsageRequest
): Promise<AdminGetOrganizationInferenceUsageResponse> {
  const { organizationId } = req.params;
  const { startDate, endDate } = req.query;

  return {
    status: 200,
    body: await getUsageByModelSummaryAndOrganizationId({
      organizationId,
      startDate,
      endDate,
    }),
  };
}

export const adminOrganizationsRouter = {
  getOrganizations,
  getOrganization,
  toggleCloudOrganization,
  adminBanOrganization,
  adminUnbanOrganization,
  adminAddUserToOrganization,
  adminRemoveUserFromOrganization,
  adminGetOrganizationStatistics,
  adminListOrganizationUsers,
  adminDeleteOrganization,
  adminGetOrganizationInferenceUsage,
};
