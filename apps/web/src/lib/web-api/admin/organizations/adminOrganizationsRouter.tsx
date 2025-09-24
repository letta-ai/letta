import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '$web/web-api/contracts';
import {
  agentTemplates,
  db,
  deployedAgentMetadata,
  inferenceModelsMetadata,
  lettaAPIKeys,
  organizationBillingDetails,
  organizationBillingDetailsAudit,
  organizationCredits,
  organizationCreditTransactions,
  organizations,
  organizationSSOConfiguration,
  organizationUsers,
  organizationVerifiedDomains,
  perModelPerOrganizationRateLimitOverrides,
  users,
} from '@letta-cloud/service-database';
import { and, count, desc, eq, ilike, inArray, or } from 'drizzle-orm';
import { getUsageByModelSummaryAndOrganizationId } from '$web/web-api/usage/usageRouter';
import {
  addCreditsToOrganization,
  removeCreditsFromOrganization,
} from '@letta-cloud/utils-server';
import { getUserOrThrow } from '$web/server/auth';
import { getOrganizationLettaServiceAccountId } from '$web/server/lib/getOrganizationLettaServiceAccountId/getOrganizationLettaServiceAccountId';
import { deleteRedisData } from '@letta-cloud/service-redis';
import { deleteOrganization } from '$web/server/auth/lib/deleteOrganization/deleteOrganization';
import { handleStripeCustomerChange } from '@letta-cloud/service-payments';

/* Get Organizations */
type GetOrganizationsResponse = ServerInferResponses<
  typeof contracts.admin.organizations.getOrganizations
>;

type GetOrganizationsQuery = ServerInferRequest<
  typeof contracts.admin.organizations.getOrganizations
>;

async function getOrganizations(
  req: GetOrganizationsQuery,
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
  req: GetOrganizationRequest,
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

type AdminBanOrganizationRequest = ServerInferRequest<
  typeof contracts.admin.organizations.adminBanOrganization
>;

type AdminBanOrganizationResponse = ServerInferResponses<
  typeof contracts.admin.organizations.adminBanOrganization
>;

async function adminBanOrganization(
  req: AdminBanOrganizationRequest,
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
        organizationUserList.map((user) => user.userId),
      ),
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
  req: UnbanOrganizationRequest,
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
        organizationUserList.map((user) => user.userId),
      ),
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
  req: AdminAddUserToOrganizationRequest,
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
      eq(organizationUsers.userId, userId),
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
    role: 'admin',
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
  req: AdminRemoveUserFromOrganizationRequest,
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
      eq(organizationUsers.userId, userId),
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
        eq(organizationUsers.userId, userId),
      ),
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
  req: AdminListOrganizationUsersRequest,
): Promise<AdminListOrganizationUsersResponse> {
  const { organizationId } = req.params;
  const { offset, limit = 10, search } = req.query;

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

  // Get all organization users for mapping (no pagination here)
  const allOrganizationUsers = await db.query.organizationUsers.findMany({
    where: eq(organizationUsers.organizationId, organizationId),
  });

  const organizationUsersMap = Object.fromEntries(
    allOrganizationUsers.map((ou) => [ou.userId, ou]),
  );

  const userWhereConditions = [
    inArray(
      users.id,
      allOrganizationUsers.map((ou) => ou.userId),
    ),
  ];

  if (search) {
    userWhereConditions.push(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      or(ilike(users.name, `%${search}%`), ilike(users.email, `%${search}%`))!,
    );
  }

  // Apply pagination to the users query
  const usersList = await db.query.users.findMany({
    where: and(...userWhereConditions),
    offset,
    limit: limit + 1,
  });

  return {
    status: 200,
    body: {
      users: usersList.slice(0, limit).map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        addedAt: organizationUsersMap[user.id].createdAt.toISOString(),
      })),
      hasNextPage: usersList.length > limit,
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
  req: AdminGetOrganizationStatisticsRequest,
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
      .from(deployedAgentMetadata)
      .where(eq(deployedAgentMetadata.organizationId, organizationId)),
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
  req: AdminDeleteOrganizationRequest,
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

  await deleteOrganization(organizationId);

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
  req: AdminGetOrganizationInferenceUsageRequest,
): Promise<AdminGetOrganizationInferenceUsageResponse> {
  const { organizationId } = req.params;
  const { startDate, endDate } = req.query;

  const serviceAccountId =
    await getOrganizationLettaServiceAccountId(organizationId);

  if (!serviceAccountId) {
    return {
      status: 404,
      body: {
        message: 'Organization not found',
      },
    };
  }

  return {
    status: 200,
    body: await getUsageByModelSummaryAndOrganizationId({
      lettaAgentsId: serviceAccountId,
      startDate,
      endDate,
    }),
  };
}

type AdminOrganizationCreditsSchema = ServerInferResponses<
  typeof contracts.admin.organizations.adminGetOrganizationCredits
>;

type AdminOrganizationCreditsRequest = ServerInferRequest<
  typeof contracts.admin.organizations.adminGetOrganizationCredits
>;

async function adminGetOrganizationCredits(
  req: AdminOrganizationCreditsRequest,
): Promise<AdminOrganizationCreditsSchema> {
  const { organizationId } = req.params;

  const organization = await db.query.organizationCredits.findFirst({
    where: eq(organizationCredits.organizationId, organizationId),
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
      credits: parseInt(organization.credits),
    },
  };
}

type AdminUpdateOrganizationRateLimitsRequest = ServerInferRequest<
  typeof contracts.admin.organizations.adminUpdateOrganizationRateLimitsForModel
>;

type AdminUpdateOrganizationRateLimitsResponse = ServerInferResponses<
  typeof contracts.admin.organizations.adminUpdateOrganizationRateLimitsForModel
>;

async function adminUpdateOrganizationRateLimitsForModel(
  req: AdminUpdateOrganizationRateLimitsRequest,
): Promise<AdminUpdateOrganizationRateLimitsResponse> {
  const { organizationId, modelId } = req.params;
  const { maxInferenceRequestsPerMinute, maxInferenceTokensPerMinute } =
    req.body;

  await db
    .insert(perModelPerOrganizationRateLimitOverrides)
    .values({
      maxTokensPerMinute: maxInferenceTokensPerMinute.toString(),
      maxRequestsPerMinute: maxInferenceRequestsPerMinute.toString(),
      modelId: modelId,
      organizationId: organizationId,
    })
    .onConflictDoUpdate({
      target: [
        perModelPerOrganizationRateLimitOverrides.modelId,
        perModelPerOrganizationRateLimitOverrides.organizationId,
      ],
      set: {
        maxTokensPerMinute: maxInferenceTokensPerMinute.toString(),
        maxRequestsPerMinute: maxInferenceRequestsPerMinute.toString(),
      },
    });

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

type ResetOrganizationRateLimitsContract = ServerInferRequest<
  typeof contracts.admin.organizations.adminResetOrganizationRateLimitsForModel
>;

type ResetOrganizationRateLimitsResponse = ServerInferResponses<
  typeof contracts.admin.organizations.adminResetOrganizationRateLimitsForModel
>;

async function adminResetOrganizationRateLimitsForModel(
  req: ResetOrganizationRateLimitsContract,
): Promise<ResetOrganizationRateLimitsResponse> {
  const { organizationId, modelId } = req.params;

  await db
    .delete(perModelPerOrganizationRateLimitOverrides)
    .where(
      and(
        eq(
          perModelPerOrganizationRateLimitOverrides.organizationId,
          organizationId,
        ),
        eq(perModelPerOrganizationRateLimitOverrides.modelId, modelId),
      ),
    );

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

type AdminGetOrganizationRateLimitsRequest = ServerInferRequest<
  typeof contracts.admin.organizations.adminGetOrganizationRateLimits
>;

type AdminGetOrganizationRateLimitsResponse = ServerInferResponses<
  typeof contracts.admin.organizations.adminGetOrganizationRateLimits
>;

async function adminGetOrganizationRateLimits(
  req: AdminGetOrganizationRateLimitsRequest,
): Promise<AdminGetOrganizationRateLimitsResponse> {
  const { organizationId } = req.params;

  const { search, limit = 5, offset = 0 } = req.query;

  const where = [
    eq(
      perModelPerOrganizationRateLimitOverrides.organizationId,
      organizationId,
    ),
  ];

  if (search) {
    where.push(ilike(inferenceModelsMetadata.name, `%${search}%`));
  }

  const organizationLimitsData = await db
    .select()
    .from(perModelPerOrganizationRateLimitOverrides)
    .innerJoin(
      inferenceModelsMetadata,
      eq(
        perModelPerOrganizationRateLimitOverrides.modelId,
        inferenceModelsMetadata.id,
      ),
    )
    .where(and(...where))
    .limit(limit + 1)
    .offset(offset);

  return {
    status: 200,
    body: {
      overrides: organizationLimitsData.map((res) => ({
        modelId: res.inference_models_metadata.id,
        modelName: res.inference_models_metadata.name,
        maxInferenceRequestsPerMinute: parseInt(
          res.per_model_per_organization_rate_limit_overrides
            .maxRequestsPerMinute,
          10,
        ),
        maxInferenceTokensPerMinute: parseInt(
          res.per_model_per_organization_rate_limit_overrides
            .maxTokensPerMinute,
          10,
        ),
      })),
    },
  };
}

type AdminAddCreditsToOrganizationRequest = ServerInferRequest<
  typeof contracts.admin.organizations.adminAddCreditsToOrganization
>;

type AdminAddCreditsToOrganizationResponse = ServerInferResponses<
  typeof contracts.admin.organizations.adminAddCreditsToOrganization
>;

export async function adminAddCreditsToOrganization(
  req: AdminAddCreditsToOrganizationRequest,
): Promise<AdminAddCreditsToOrganizationResponse> {
  const { organizationId } = req.params;
  const { amount, note } = req.body;

  const response = await addCreditsToOrganization({
    organizationId,
    amount,
    source: 'admin',
    note,
  });

  return {
    status: 200,
    body: {
      credits: parseInt(response.credits, 10),
    },
  };
}

type AdminRemoveCreditsFromOrganizationRequest = ServerInferRequest<
  typeof contracts.admin.organizations.adminRemoveCreditsFromOrganization
>;

type AdminRemoveCreditsFromOrganizationResponse = ServerInferResponses<
  typeof contracts.admin.organizations.adminRemoveCreditsFromOrganization
>;

async function adminRemoveCreditsFromOrganization(
  req: AdminRemoveCreditsFromOrganizationRequest,
): Promise<AdminRemoveCreditsFromOrganizationResponse> {
  const { organizationId } = req.params;
  const { amount, note } = req.body;

  const currentOrganization = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });

  if (!currentOrganization) {
    return {
      status: 404,
      body: {
        message: 'Organization not found',
      },
    };
  }

  const response = await removeCreditsFromOrganization({
    coreOrganizationId: currentOrganization.lettaAgentsId,
    amount,
    source: 'admin',
    note,
  });

  return {
    status: 200,
    body: {
      credits: parseInt(response.newCredits, 10),
    },
  };
}

type OrganizationCreditTransactionsSchema = ServerInferResponses<
  typeof contracts.admin.organizations.adminListOrganizationCreditTransactions
>;

type OrganizationCreditTransactionsRequest = ServerInferRequest<
  typeof contracts.admin.organizations.adminListOrganizationCreditTransactions
>;

async function adminListOrganizationCreditTransactions(
  req: OrganizationCreditTransactionsRequest,
): Promise<OrganizationCreditTransactionsSchema> {
  const { organizationId } = req.params;
  const { offset, limit = 10 } = req.query;

  const transactions = await db.query.organizationCreditTransactions.findMany({
    offset,
    limit: limit + 1,
    orderBy: desc(organizationCreditTransactions.createdAt),
    where: eq(organizationCreditTransactions.organizationId, organizationId),
  });

  return {
    status: 200,
    body: {
      transactions: transactions.slice(0, limit).map((transaction) => ({
        id: transaction.id,
        amount: parseInt(transaction.amount, 10),
        note: transaction.note || '',
        transactionType: transaction.transactionType,
        createdAt: transaction.createdAt.toISOString(),
      })),
      hasNextPage: transactions.length > limit,
    },
  };
}

type AdminUpdateOrganizationBillingSettings = ServerInferResponses<
  typeof contracts.admin.organizations.adminUpdateOrganizationBillingSettings
>;

type AdminUpdateOrganizationBillingSettingsRequest = ServerInferRequest<
  typeof contracts.admin.organizations.adminUpdateOrganizationBillingSettings
>;

async function adminUpdateOrganizationBillingSettings(
  req: AdminUpdateOrganizationBillingSettingsRequest,
): Promise<AdminUpdateOrganizationBillingSettings> {
  const { organizationId } = req.params;
  const user = await getUserOrThrow();
  const { monthlyCreditAllocation, pricingModel } = req.body;

  await db
    .update(organizationBillingDetails)
    .set({
      monthlyCreditAllocation: monthlyCreditAllocation.toString(),
      pricingModel,
    })
    .where(eq(organizationBillingDetails.organizationId, organizationId));

  await db.insert(organizationBillingDetailsAudit).values({
    organizationId,
    monthlyCreditAllocation: monthlyCreditAllocation.toString(),
    pricingModel,
    updatedBy: user.id,
  });

  await deleteRedisData('customerSubscription', {
    organizationId: organizationId,
  });

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

type AdminGetOrganizationBillingSettings = ServerInferResponses<
  typeof contracts.admin.organizations.adminGetOrganizationBillingSettings
>;

type AdminGetOrganizationBillingSettingsRequest = ServerInferRequest<
  typeof contracts.admin.organizations.adminGetOrganizationBillingSettings
>;

export async function adminGetOrganizationBillingSettings(
  req: AdminGetOrganizationBillingSettingsRequest,
): Promise<AdminGetOrganizationBillingSettings> {
  const { organizationId } = req.params;

  const organizationBilling =
    await db.query.organizationBillingDetails.findFirst({
      where: eq(organizationBillingDetails.organizationId, organizationId),
    });

  if (!organizationBilling) {
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
      monthlyCreditAllocation: parseInt(
        organizationBilling.monthlyCreditAllocation || '0',
        10,
      ),
      pricingModel: organizationBilling.pricingModel,
    },
  };
}

type AdminGetOrganizationVerifiedDomains = ServerInferResponses<
  typeof contracts.admin.organizations.adminGetOrganizationVerifiedDomains
>;

type AdminGetOrganizationVerifiedDomainsRequest = ServerInferRequest<
  typeof contracts.admin.organizations.adminGetOrganizationVerifiedDomains
>;

export async function adminGetOrganizationVerifiedDomains(
  req: AdminGetOrganizationVerifiedDomainsRequest,
): Promise<AdminGetOrganizationVerifiedDomains> {
  const { organizationId } = req.params;

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
    with: {
      organizationVerifiedDomains: true,
    },
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
      domains: organization.organizationVerifiedDomains.map((domain) => {
        return {
          domain: domain.domain,
        };
      }),
    },
  };
}

type AdminDeleteOrganizationVerifiedDomain = ServerInferResponses<
  typeof contracts.admin.organizations.adminDeleteOrganizationVerifiedDomain
>;

type AdminDeleteOrganizationVerifiedDomainRequest = ServerInferRequest<
  typeof contracts.admin.organizations.adminDeleteOrganizationVerifiedDomain
>;

export async function adminDeleteOrganizationVerifiedDomain(
  req: AdminDeleteOrganizationVerifiedDomainRequest,
): Promise<AdminDeleteOrganizationVerifiedDomain> {
  const { organizationId } = req.params;
  const { domain } = req.body;

  await db
    .delete(organizationVerifiedDomains)
    .where(
      and(
        eq(organizationVerifiedDomains.organizationId, organizationId),
        eq(organizationVerifiedDomains.domain, domain),
      ),
    );

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

type AdminAddVerifiedDomain = ServerInferResponses<
  typeof contracts.admin.organizations.adminAddVerifiedDomain
>;

type AdminAddVerifiedDomainRequest = ServerInferRequest<
  typeof contracts.admin.organizations.adminAddVerifiedDomain
>;

export async function adminAddVerifiedDomain(
  req: AdminAddVerifiedDomainRequest,
): Promise<AdminAddVerifiedDomain> {
  const { organizationId } = req.params;
  const { domain } = req.body;

  await db.insert(organizationVerifiedDomains).values({
    organizationId,
    domain: domain.toLowerCase(),
  });

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

type AdminAddSSOConfigurationRequest = ServerInferRequest<
  typeof contracts.admin.organizations.adminAddSSOConfiguration
>;

type AdminAddSSOConfigurationResponse = ServerInferResponses<
  typeof contracts.admin.organizations.adminAddSSOConfiguration
>;

async function adminAddSSOConfiguration(
  req: AdminAddSSOConfigurationRequest,
): Promise<AdminAddSSOConfigurationResponse> {
  const { organizationId } = req.params;
  const { domain, workOSOrganizationId } = req.body;

  await db.insert(organizationSSOConfiguration).values({
    organizationId,
    domain,
    workOSOrganizationId,
  });

  return {
    status: 200,
    body: {
      id: organizationId,
      domain,
      workOSOrganizationId,
    },
  };
}

type AdminDeleteSSOConfigurationRequest = ServerInferRequest<
  typeof contracts.admin.organizations.adminDeleteSSOConfiguration
>;

type AdminDeleteSSOConfigurationResponse = ServerInferResponses<
  typeof contracts.admin.organizations.adminDeleteSSOConfiguration
>;

async function adminDeleteSSOConfiguration(
  req: AdminDeleteSSOConfigurationRequest,
): Promise<AdminDeleteSSOConfigurationResponse> {
  const { organizationId, ssoConfigurationId } = req.params;

  await db
    .delete(organizationSSOConfiguration)
    .where(
      and(
        eq(organizationSSOConfiguration.organizationId, organizationId),
        eq(organizationSSOConfiguration.id, ssoConfigurationId),
      ),
    );

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

type AdminListSSOConfigurationsRequest = ServerInferRequest<
  typeof contracts.admin.organizations.adminListSSOConfigurations
>;

type AdminListSSOConfigurationsResponse = ServerInferResponses<
  typeof contracts.admin.organizations.adminListSSOConfigurations
>;

async function adminListSSOConfigurations(
  req: AdminListSSOConfigurationsRequest,
): Promise<AdminListSSOConfigurationsResponse> {
  const { organizationId } = req.params;
  const { limit = 10, offset = 0 } = req.query;

  const ssoConfigurations =
    await db.query.organizationSSOConfiguration.findMany({
      where: eq(organizationSSOConfiguration.organizationId, organizationId),
      limit: limit + 1,
      offset,
    });

  return {
    status: 200,
    body: {
      configurations: ssoConfigurations.slice(0, limit).map((config) => ({
        id: config.id,
        domain: config.domain,
        workOSOrganizationId: config.workOSOrganizationId,
      })),
      hasNextPage: ssoConfigurations.length > limit,
    },
  };
}

type ToggleBillingMethodRequest = ServerInferRequest<
  typeof contracts.admin.organizations.toggleBillingMethod
>;

type ToggleBillingMethodResponse = ServerInferResponses<
  typeof contracts.admin.organizations.toggleBillingMethod
>;

async function toggleBillingMethod(
  req: ToggleBillingMethodRequest,
): Promise<ToggleBillingMethodResponse> {
  const { organizationId } = req.params;
  const { method } = req.body;

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

  if (!method) {
    return {
      status: 400,
      body: {
        message: 'Method is required',
      },
    };
  }

  await db
    .update(organizationBillingDetails)
    .set({
      billingTier: method,
    })
    .where(eq(organizationBillingDetails.organizationId, organization.id));

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

type AdminGetBillingMethodRequest = ServerInferRequest<
  typeof contracts.admin.organizations.adminGetBillingMethod
>;

type AdminGetBillingMethodResponse = ServerInferResponses<
  typeof contracts.admin.organizations.adminGetBillingMethod
>;

async function adminGetBillingMethod(
  req: AdminGetBillingMethodRequest,
): Promise<AdminGetBillingMethodResponse> {
  const { organizationId } = req.params;

  const organization = await db.query.organizationBillingDetails.findFirst({
    where: eq(organizationBillingDetails.organizationId, organizationId),
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
      method: organization.billingTier,
    },
  };
}

type RefreshBillingDataRequest = ServerInferRequest<
  typeof contracts.admin.organizations.refreshBillingData
>;

type RefreshBillingDataResponse = ServerInferResponses<
  typeof contracts.admin.organizations.refreshBillingData
>;

async function refreshBillingData(
  req: RefreshBillingDataRequest,
): Promise<RefreshBillingDataResponse> {
  const { organizationId } = req.params;

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
    with: {
      organizationBillingDetails: {
        columns: {
          stripeCustomerId: true,
        },
      },
    },
  });

  if (!organization?.organizationBillingDetails?.stripeCustomerId) {
    return {
      status: 404,
      body: {
        message: 'Organization not found',
      },
    };
  }

  await handleStripeCustomerChange(
    organization.organizationBillingDetails.stripeCustomerId,
  );

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

export const adminOrganizationsRouter = {
  getOrganizations,
  getOrganization,
  refreshBillingData,
  adminBanOrganization,
  adminUnbanOrganization,
  adminAddUserToOrganization,
  adminRemoveUserFromOrganization,
  adminGetOrganizationStatistics,
  adminListOrganizationUsers,
  adminDeleteOrganization,
  adminGetOrganizationInferenceUsage,
  adminGetOrganizationCredits,
  adminAddCreditsToOrganization,
  adminRemoveCreditsFromOrganization,
  adminGetBillingMethod,
  adminListOrganizationCreditTransactions,
  adminUpdateOrganizationBillingSettings,
  adminGetOrganizationBillingSettings,
  adminUpdateOrganizationRateLimitsForModel,
  adminGetOrganizationRateLimits,
  adminResetOrganizationRateLimitsForModel,
  adminDeleteOrganizationVerifiedDomain,
  adminGetOrganizationVerifiedDomains,
  adminAddVerifiedDomain,
  adminAddSSOConfiguration,
  adminDeleteSSOConfiguration,
  adminListSSOConfigurations,
  toggleBillingMethod,
};
