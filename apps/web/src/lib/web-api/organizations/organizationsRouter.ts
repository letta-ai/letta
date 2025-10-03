import {
  agentTemplates,
  autoTopUpCreditsConfiguration,
  db,
  organizationBillingDetails,
  organizationCredits,
  organizationInvitedUsers,
  organizationInviteRules,
  organizationLowBalanceNotificationLock,
  organizationPreferences,
  organizations,
  organizationUsers,
  organizationVerifiedDomains,
  projects,
  users,
} from '@letta-cloud/service-database';
import {
  getUserActiveOrganizationIdOrThrow,
  getUserWithActiveOrganizationIdOrThrow,
} from '$web/server/auth';
import { createOrganization as authCreateOrganization, generateServerSideAPIKey } from '@letta-cloud/service-auth';
import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '$web/web-api/contracts';
import { and, count, eq, gt, ilike } from 'drizzle-orm';
import {
  generateInviteCode,
  generateInviteCodeLink,
  parseInviteCode,
} from '$web/utils';
import {
  createPayment,
  createSetupIntent,
  getPaymentCustomer,
  getPaymentMethodDetails,
  listCreditCards,
  removePaymentMethod,
  setDefaultPaymentMethod,
  listPaymentIntents,
  getPaymentCharge,
  getCustomerSubscription,
  resumeSubscription,
  cancelSubscription,
  getActiveBillableAgentsCount,
} from '@letta-cloud/service-payments';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import {
  addCreditsToOrganization,
  getOrganizationCredits,
  getRemainingRecurrentCredits,
} from '@letta-cloud/utils-server';
import { creditsToDollars } from '@letta-cloud/utils-shared';
import { sendEmail } from '@letta-cloud/service-email';
import { upgradeCustomer } from '@letta-cloud/service-payments';
import { getRedisModelTransactions } from '@letta-cloud/utils-server';
import {
  BlocksService,
  EmbeddingsService,
  IdentitiesService,
  SourcesService,
} from '@letta-cloud/sdk-core';

type GetCurrentOrganizationResponse = ServerInferResponses<
  typeof contracts.organizations.getCurrentOrganization
>;

async function getCurrentOrganization(): Promise<GetCurrentOrganizationResponse> {
  const organizationId = await getUserActiveOrganizationIdOrThrow();

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });

  if (!organization) {
    throw new Error('Organization not found');
  }

  return {
    status: 200,
    body: {
      id: organization.id,
      name: organization.name,
      isAdmin: organization.isAdmin,
      createdAt: organization.createdAt.toISOString(),
      updatedAt: organization.updatedAt.toISOString(),
    },
  };
}

type GetCurrentOrganizationTeamMembersResponse = ServerInferResponses<
  typeof contracts.organizations.getCurrentOrganizationTeamMembers
>;

type GetCurrentOrganizationTeamMembersRequest = ServerInferRequest<
  typeof contracts.organizations.getCurrentOrganizationTeamMembers
>;

async function getCurrentOrganizationTeamMembers(
  req: GetCurrentOrganizationTeamMembersRequest,
): Promise<GetCurrentOrganizationTeamMembersResponse> {
  const { offset, limit = 20, search } = req.query;
  const organizationId = await getUserActiveOrganizationIdOrThrow();

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });

  if (!organization) {
    throw new Error('Organization not found');
  }

  // Build the query using select with join for proper filtering
  const query = db
    .select()
    .from(organizationUsers)
    .innerJoin(users, eq(organizationUsers.userId, users.id))
    .where(
      and(
        eq(organizationUsers.organizationId, organizationId),
        ...(search ? [ilike(users.name, `%${search}%`)] : []),
      ),
    );

  const members = await query.offset(offset || 0).limit(limit + 1);

  return {
    status: 200,
    body: {
      nextCursor:
        members.length > limit
          ? members[limit - 1].organization_users.userId
          : undefined,
      members: members.slice(0, limit).map((member) => ({
        id: member.organization_users.userId,
        role: member.organization_users.role,
        name: member.users.name,
        email: member.users.email,
        createdAt: member.organization_users.createdAt.toISOString(),
        updatedAt: member.organization_users.updatedAt.toISOString(),
      })),
    },
  };
}

type RegenerateInviteCodeRequest = ServerInferRequest<
  typeof contracts.organizations.regenerateInviteCode
>;

type RegenerateInviteCodeResponse = ServerInferResponses<
  typeof contracts.organizations.regenerateInviteCode
>;

async function regenerateInviteCode(
  req: RegenerateInviteCodeRequest,
): Promise<RegenerateInviteCodeResponse> {
  const { activeOrganizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();
  const { memberId } = req.params;

  if (!permissions.has(ApplicationServices.UPDATE_USERS_IN_ORGANIZATION)) {
    return {
      status: 403,
      body: {
        message: 'Permission denied',
      },
    };
  }

  const invitedMember = await db.query.organizationInvitedUsers.findFirst({
    where: eq(organizationInvitedUsers.id, memberId),
    with: {
      organization: true,
    },
  });

  if (!invitedMember) {
    return {
      status: 404,
      body: {
        message: 'User not found',
      },
    };
  }

  const inviteCode = generateInviteCode({
    email: invitedMember.email,
    organizationId: activeOrganizationId,
  });

  await db
    .update(organizationInvitedUsers)
    .set({
      inviteCode,
    })
    .where(
      and(
        eq(organizationInvitedUsers.id, memberId),
        eq(organizationInvitedUsers.organizationId, activeOrganizationId),
      ),
    );

  void sendEmail({
    to: invitedMember.email,
    type: 'invite',
    options: {
      inviteUrl: generateInviteCodeLink(inviteCode),
      organizationName: invitedMember.organization.name,
      locale: 'en',
    },
  });

  return {
    status: 200,
    body: {
      id: invitedMember.id,
      email: invitedMember.email,
      inviteCode,
    },
  };
}

type InviteNewTeamMemberRequest = ServerInferRequest<
  typeof contracts.organizations.inviteNewTeamMember
>;

type InviteNewTeamMemberResponse = ServerInferResponses<
  typeof contracts.organizations.inviteNewTeamMember
>;

async function inviteNewTeamMember(
  req: InviteNewTeamMemberRequest,
): Promise<InviteNewTeamMemberResponse> {
  const {
    activeOrganizationId,
    id: userId,
    permissions,
  } = await getUserWithActiveOrganizationIdOrThrow();
  const { email: pEmail } = req.body;

  const email = pEmail.toLowerCase();

  if (!permissions.has(ApplicationServices.UPDATE_USERS_IN_ORGANIZATION)) {
    return {
      status: 403,
      body: {
        message: 'Permission denied',
      },
    };
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (user) {
    // check if user is already in the organization
    const userInOrganization = await db.query.organizationUsers.findFirst({
      where: and(
        eq(organizationUsers.userId, user.id),
        eq(organizationUsers.organizationId, activeOrganizationId),
      ),
    });

    if (userInOrganization) {
      return {
        status: 400,
        body: {
          message: 'User already in the organization',
          errorCode: 'userAlreadyInOrganization',
        },
      };
    }

    // add user to the organization
    await db.insert(organizationUsers).values({
      userId: user.id,
      organizationId: activeOrganizationId,
      role: 'admin',
    });

    const nextUser = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });

    if (!nextUser) {
      return {
        status: 500,
        body: {
          message: 'User not found',
        },
      };
    }

    return {
      status: 200,
      body: {
        email,
        name: nextUser.name,
        id: user.id,
      },
    };
  }

  const inviteCode = generateInviteCode({
    email,
    organizationId: activeOrganizationId,
  });

  const invitedUser = await db.query.organizationInvitedUsers.findFirst({
    where: and(
      eq(organizationInvitedUsers.email, email),
      eq(organizationInvitedUsers.organizationId, activeOrganizationId),
    ),
  });

  if (invitedUser) {
    return {
      status: 400,
      body: {
        message: 'User already invited',
        errorCode: 'userAlreadyInvited',
      },
    };
  }

  const [res] = await db
    .insert(organizationInvitedUsers)
    .values({
      email,
      organizationId: activeOrganizationId,
      inviteCode,
      invitedBy: userId,
    })
    .returning({ id: organizationInvitedUsers.id });

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, activeOrganizationId),
  });

  if (organization) {
    void sendEmail({
      to: email,
      type: 'invite',
      options: {
        inviteUrl: generateInviteCodeLink(inviteCode),
        organizationName: organization.name,
        locale: 'en',
      },
    });
  }

  return {
    status: 201,
    body: {
      email,
      inviteCode,
      id: res.id,
    },
  };
}

type UnInviteTeamMemberRequest = ServerInferRequest<
  typeof contracts.organizations.unInviteTeamMember
>;

type UnInviteTeamMemberResponse = ServerInferResponses<
  typeof contracts.organizations.unInviteTeamMember
>;

async function unInviteTeamMember(
  req: UnInviteTeamMemberRequest,
): Promise<UnInviteTeamMemberResponse> {
  const { activeOrganizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();
  const { memberId } = req.params;

  if (!permissions.has(ApplicationServices.UPDATE_USERS_IN_ORGANIZATION)) {
    return {
      status: 403,
      body: {
        message: 'Permission denied',
      },
    };
  }

  await db
    .delete(organizationInvitedUsers)
    .where(
      and(
        eq(organizationInvitedUsers.id, memberId),
        eq(organizationInvitedUsers.organizationId, activeOrganizationId),
      ),
    );

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

type RemoveTeamMember = ServerInferRequest<
  typeof contracts.organizations.removeTeamMember
>;

type RemoveTeamMemberResponse = ServerInferResponses<
  typeof contracts.organizations.removeTeamMember
>;

async function removeTeamMember(
  req: RemoveTeamMember,
): Promise<RemoveTeamMemberResponse> {
  const {
    activeOrganizationId,
    permissions,
    id: userId,
  } = await getUserWithActiveOrganizationIdOrThrow();
  const { memberId } = req.params;

  if (!permissions.has(ApplicationServices.UPDATE_USERS_IN_ORGANIZATION)) {
    return {
      status: 403,
      body: {
        message: 'Permission denied',
      },
    };
  }

  // you cannot remove yourself
  if (memberId === userId) {
    return {
      status: 400,
      body: {
        message: 'You cannot remove yourself',
      },
    };
  }

  await Promise.all([
    db
      .delete(organizationUsers)
      .where(
        and(
          eq(organizationUsers.userId, memberId),
          eq(organizationUsers.organizationId, activeOrganizationId),
        ),
      ),
    db
      .update(users)
      .set({
        activeOrganizationId: null,
      })
      .where(
        and(
          eq(users.id, memberId),
          eq(users.activeOrganizationId, activeOrganizationId),
        ),
      ),
  ]);

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

type ListInvitedMembersRequest = ServerInferRequest<
  typeof contracts.organizations.listInvitedMembers
>;

type ListInvitedMembersResponse = ServerInferResponses<
  typeof contracts.organizations.listInvitedMembers
>;

async function listInvitedMembers(
  req: ListInvitedMembersRequest,
): Promise<ListInvitedMembersResponse> {
  const { activeOrganizationId } =
    await getUserWithActiveOrganizationIdOrThrow();
  const { cursor, limit = 20, search } = req.query;

  const where = [
    eq(organizationInvitedUsers.organizationId, activeOrganizationId),
  ];

  if (cursor) {
    where.push(gt(organizationInvitedUsers.id, cursor));
  }

  if (search) {
    where.push(ilike(organizationInvitedUsers.email, `%${search}%`));
  }

  const invitedMembers = await db.query.organizationInvitedUsers.findMany({
    where: and(...where),
    limit: limit + 1,
  });

  return {
    status: 200,
    body: {
      nextCursor:
        invitedMembers.length > limit
          ? invitedMembers[limit - 1].id
          : undefined,
      members: invitedMembers.slice(0, limit).map((member) => ({
        id: member.id,
        email: member.email,
        inviteCode: member.inviteCode,
        invitedBy: member.invitedBy,
        createdAt: member.createdAt.toISOString(),
        updatedAt: member.updatedAt.toISOString(),
      })),
    },
  };
}

/* Update organization */
type UpdateOrganizationRequest = ServerInferRequest<
  typeof contracts.organizations.updateOrganization
>;

type UpdateOrganizationResponse = ServerInferResponses<
  typeof contracts.organizations.updateOrganization
>;

async function updateOrganization(
  req: UpdateOrganizationRequest,
): Promise<UpdateOrganizationResponse> {
  const { activeOrganizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();
  const { name } = req.body;

  if (!permissions.has(ApplicationServices.UPDATE_ORGANIZATION)) {
    return {
      status: 403,
      body: {
        message: 'Permission denied',
      },
    };
  }

  await db
    .update(organizations)
    .set({
      name,
    })
    .where(eq(organizations.id, activeOrganizationId));

  return {
    status: 200,
    body: {
      name,
    },
  };
}

/* Delete organization */
type DeleteOrganizationResponse = ServerInferResponses<
  typeof contracts.organizations.deleteOrganization
>;

async function deleteOrganization(): Promise<DeleteOrganizationResponse> {
  // not implemented yet
  return {
    status: 501,
    body: {
      message: 'Not implemented',
    },
  };
}

/* Create organization */
type CreateOrganizationRequest = ServerInferRequest<
  typeof contracts.organizations.createOrganization
>;

type CreateOrganizationResponse = ServerInferResponses<
  typeof contracts.organizations.createOrganization
>;

async function createOrganization(
  req: CreateOrganizationRequest,
): Promise<CreateOrganizationResponse> {
  const { id, email, activeOrganizationId } =
    await getUserWithActiveOrganizationIdOrThrow();

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, activeOrganizationId),
  });

  if (!org?.isAdmin) {
    return {
      status: 403,
      body: {
        message: 'Permission denied',
      },
    };
  }

  const res = await authCreateOrganization({
    name: req.body.name,
    email,
  });

  await Promise.all([
    generateServerSideAPIKey({
      name: `Default API Key`,
      organizationId: res.organizationId,
      creatorUserId: id,
    }),
    db
      .update(users)
      .set({
        activeOrganizationId: res.organizationId,
      })
      .where(eq(users.id, id)),
    db.insert(organizationUsers).values({
      userId: id,
      role: 'admin',
      organizationId: res.organizationId,
    }),
  ]);

  return {
    status: 201,
    body: {
      id: res.organizationId,
      name: req.body.name,
    },
  };
}

/* getCurrentOrganizationPreferences */
type GetCurrentOrganizationPreferencesResponse = ServerInferResponses<
  typeof contracts.organizations.getCurrentOrganizationPreferences
>;

async function getCurrentOrganizationPreferences(): Promise<GetCurrentOrganizationPreferencesResponse> {
  const { activeOrganizationId } =
    await getUserWithActiveOrganizationIdOrThrow();

  const organization = await db.query.organizationPreferences.findFirst({
    where: eq(organizationPreferences.organizationId, activeOrganizationId),
  });

  if (!organization) {
    throw new Error('Organization not found');
  }

  return {
    status: 200,
    body: {
      defaultProjectId: organization.defaultProjectId,
    },
  };
}

type GetInviteByCode = ServerInferRequest<
  typeof contracts.organizations.getInviteByCode
>;

type GetInviteByCodeResponse = ServerInferResponses<
  typeof contracts.organizations.getInviteByCode
>;

async function getInviteByCode(
  req: GetInviteByCode,
): Promise<GetInviteByCodeResponse> {
  const { inviteCode } = req.params;

  const { isExpired } = parseInviteCode(inviteCode);

  if (isExpired) {
    return {
      status: 404,
      body: {
        message: 'Invite not found',
      },
    };
  }

  const invite = await db.query.organizationInvitedUsers.findFirst({
    where: eq(organizationInvitedUsers.inviteCode, inviteCode),
  });

  if (!invite) {
    return {
      status: 404,
      body: {
        message: 'Invite not found',
      },
    };
  }

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, invite.organizationId),
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
      organizationName: organization.name,
      email: invite.email,
    },
  };
}

type GetCurrentOrganizationBillingInfo = ServerInferResponses<
  typeof contracts.organizations.getCurrentOrganizationBillingInfo
>;

async function getCurrentOrganizationBillingInfo(): Promise<GetCurrentOrganizationBillingInfo> {
  const { activeOrganizationId } =
    await getUserWithActiveOrganizationIdOrThrow();

  const [organization, credits] = await Promise.all([
    db.query.organizationBillingDetails.findFirst({
      where: eq(
        organizationBillingDetails.organizationId,
        activeOrganizationId,
      ),
    }),
    db.query.organizationCredits.findFirst({
      where: eq(organizationCredits.organizationId, activeOrganizationId),
    }),
  ]);

  if (!organization || !credits) {
    throw new Error('Organization not found');
  }

  // do not run in parallel as payment customer may not exist yet
  const subscription = await getCustomerSubscription(activeOrganizationId);
  const recurrentCredits = await getRemainingRecurrentCredits(activeOrganizationId, subscription);

  return {
    status: 200,
    body: {
      billingTier: subscription.tier,
      isCancelled: !!subscription.cancelled,
      billingPeriodEnd: subscription.billingPeriodEnd,

      totalCredits: parseInt(credits.credits, 10),
      recurrentCredits,
    },
  };
}

type GetOrganizationPaymentMethodsResponse = ServerInferResponses<
  typeof contracts.organizations.getOrganizationPaymentMethods
>;

async function getOrganizationPaymentMethods(): Promise<GetOrganizationPaymentMethodsResponse> {
  const { activeOrganizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.MANAGE_BILLING)) {
    return {
      status: 403,
      body: {
        message: 'Permission denied',
      },
    };
  }

  const [creditCards, paymentCustomer] = await Promise.all([
    listCreditCards({
      organizationId: activeOrganizationId,
    }),
    getPaymentCustomer(activeOrganizationId, true),
  ]);

  return {
    status: 200,
    body: {
      creditCards: creditCards.map((card) => ({
        id: card.id,
        brand: card.card.brand,
        last4: card.card.last4,
        expMonth: card.card.exp_month,
        expYear: card.card.exp_year,
        isExpired:
          card.card.exp_year < new Date().getFullYear() ||
          (card.card.exp_year === new Date().getFullYear() &&
            card.card.exp_month < new Date().getMonth() + 1),
        billingAddress: {
          address1: card.billing_details.address?.line1 || '',
          address2: card.billing_details.address?.line2 || '',
          city: card.billing_details.address?.city || '',
          state: card.billing_details.address?.state || '',
          postalCode: card.billing_details.address?.postal_code || '',
          country: card.billing_details.address?.country || '',
        },
        isDefault: paymentCustomer?.defaultPaymentMethod === card.id,
        name: card.billing_details.name || '',
      })),
    },
  };
}

type StartSetupIntentResponse = ServerInferResponses<
  typeof contracts.organizations.startSetupIntent
>;

export async function startSetupIntent(): Promise<StartSetupIntentResponse> {
  const { activeOrganizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.MANAGE_BILLING)) {
    return {
      status: 403,
      body: {
        message: 'Permission denied',
      },
    };
  }

  const intent = await createSetupIntent({
    organizationId: activeOrganizationId,
  });

  if (!intent?.client_secret) {
    return {
      status: 500,
      body: {
        message: 'Failed to create setup intent',
      },
    };
  }

  return {
    status: 200,
    body: {
      clientSecret: intent.client_secret,
    },
  };
}

type PurchaseCreditsRequest = ServerInferRequest<
  typeof contracts.organizations.purchaseCredits
>;

type PurchaseCreditsResponse = ServerInferResponses<
  typeof contracts.organizations.purchaseCredits
>;

async function removeLowBalanceLock(orgId: string) {
  const lock = await db.query.organizationLowBalanceNotificationLock.findFirst({
    where: eq(organizationLowBalanceNotificationLock.organizationId, orgId),
  });

  if (lock) {
    await db
      .delete(organizationLowBalanceNotificationLock)
      .where(eq(organizationLowBalanceNotificationLock.organizationId, orgId));
  }
}

export async function purchaseCredits(
  req: PurchaseCreditsRequest,
): Promise<PurchaseCreditsResponse> {
  const { activeOrganizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.MANAGE_BILLING)) {
    return {
      status: 403,
      body: {
        message: 'Permission denied',
      },
    };
  }

  const { credits, cardId } = req.body;

  const payment = await createPayment({
    organizationId: activeOrganizationId,
    cardId,
    amountInCents: creditsToDollars(credits) * 100,
  });

  if (payment.status !== 'succeeded') {
    return {
      status: 400,
      body: {
        message: payment.status,
        errorCode: 'paymentError',
      },
    };
  }

  await addCreditsToOrganization({
    organizationId: activeOrganizationId,
    amount: credits,
    source: 'Purchase',
  });

  // remove the low balance lock if it exists, so users can be notified again if they go below the threshold
  void removeLowBalanceLock(activeOrganizationId);

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

type RemoveOrganizationBillingMethodRequest = ServerInferRequest<
  typeof contracts.organizations.removeOrganizationBillingMethod
>;

type RemoveOrganizationBillingMethodResponse = ServerInferResponses<
  typeof contracts.organizations.removeOrganizationBillingMethod
>;

export async function removeOrganizationBillingMethod(
  req: RemoveOrganizationBillingMethodRequest,
): Promise<RemoveOrganizationBillingMethodResponse> {
  const { methodId } = req.params;

  const { permissions } = await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.MANAGE_BILLING)) {
    return {
      status: 403,
      body: {
        message: 'Permission denied',
      },
    };
  }

  await removePaymentMethod({
    paymentMethodId: methodId,
  });

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

type SetDefaultOrganizationBillingMethodRequest = ServerInferRequest<
  typeof contracts.organizations.setDefaultOrganizationBillingMethod
>;

type SetDefaultOrganizationBillingMethodResponse = ServerInferResponses<
  typeof contracts.organizations.setDefaultOrganizationBillingMethod
>;

export async function setDefaultOrganizationBillingMethod(
  req: SetDefaultOrganizationBillingMethodRequest,
): Promise<SetDefaultOrganizationBillingMethodResponse> {
  const { methodId } = req.params;
  const { activeOrganizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.MANAGE_BILLING)) {
    return {
      status: 403,
      body: {
        message: 'Permission denied',
      },
    };
  }

  await setDefaultPaymentMethod({
    paymentMethodId: methodId,
    organizationId: activeOrganizationId,
  });

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

type UpdateOrganizationUserRoleRequest = ServerInferRequest<
  typeof contracts.organizations.updateOrganizationUserRole
>;

type UpdateOrganizationUserRoleResponse = ServerInferResponses<
  typeof contracts.organizations.updateOrganizationUserRole
>;

const ApplicationServicesSet = new Set<string>(
  Object.values(ApplicationServices),
);

export async function updateOrganizationUserRole(
  req: UpdateOrganizationUserRoleRequest,
): Promise<UpdateOrganizationUserRoleResponse> {
  const { activeOrganizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  const subscription = await getCustomerSubscription(activeOrganizationId);

  if (subscription.tier !== 'enterprise') {
    return {
      status: 403,
      body: {
        message: 'Permission denied',
      },
    };
  }

  if (!permissions.has(ApplicationServices.UPDATE_USERS_IN_ORGANIZATION)) {
    return {
      status: 403,
      body: {
        message: 'Permission denied',
      },
    };
  }

  const { userId } = req.params;

  const { role, customPermissions } = req.body;

  await db
    .update(organizationUsers)
    .set({
      role,
      customPermissions: (customPermissions || []).filter((v) =>
        ApplicationServicesSet.has(v),
      ) as ApplicationServices[],
    })
    .where(
      and(
        eq(organizationUsers.userId, userId),
        eq(organizationUsers.organizationId, activeOrganizationId),
      ),
    );

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

type ListVerifiedDomainsResponse = ServerInferResponses<
  typeof contracts.organizations.listVerifiedDomains
>;

export async function listVerifiedDomains(): Promise<ListVerifiedDomainsResponse> {
  const { activeOrganizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.UPDATE_ORGANIZATION)) {
    return {
      status: 403,
      body: {
        message: 'Permission denied',
      },
    };
  }

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, activeOrganizationId),
    with: {
      organizationVerifiedDomains: true,
    },
  });

  if (!organization) {
    throw new Error('Organization not found');
  }

  return {
    status: 200,
    body: {
      domains: organization.organizationVerifiedDomains.map((domain) => ({
        id: domain.id,
        domain: domain.domain,
      })),
    },
  };
}

type CreateInviteRuleRequest = ServerInferRequest<
  typeof contracts.organizations.createInviteRule
>;

type CreateInviteRuleResponse = ServerInferResponses<
  typeof contracts.organizations.createInviteRule
>;

export async function createInviteRule(
  req: CreateInviteRuleRequest,
): Promise<CreateInviteRuleResponse> {
  const { activeOrganizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.UPDATE_ORGANIZATION)) {
    return {
      status: 403,
      body: {
        message: 'Permission denied',
      },
    };
  }

  const { domainId, role } = req.body;

  // check if domain exists
  const domain = await db.query.organizationVerifiedDomains.findFirst({
    where: eq(organizationVerifiedDomains.id, domainId),
  });

  if (!domain) {
    return {
      status: 404,
      body: {
        message: 'Domain not found',
        errorCode: 'domainNotFound',
      },
    };
  }

  // check if rule already exists
  const rule = await db.query.organizationInviteRules.findFirst({
    where: and(
      eq(organizationInviteRules.verifiedDomain, domainId),
      eq(organizationInviteRules.organizationId, activeOrganizationId),
    ),
  });

  if (rule) {
    return {
      status: 400,
      body: {
        message: 'Rule already exists',
        errorCode: 'ruleAlreadyExists',
      },
    };
  }

  const [res] = await db
    .insert(organizationInviteRules)
    .values({
      verifiedDomain: domainId,
      role,
      organizationId: activeOrganizationId,
    })
    .returning({ id: organizationVerifiedDomains.id });

  return {
    status: 201,
    body: {
      id: res.id,
      role: role,
      domain: domain.domain,
    },
  };
}

type ListInviteRulesResponse = ServerInferResponses<
  typeof contracts.organizations.listInviteRules
>;

export async function listInviteRules(): Promise<ListInviteRulesResponse> {
  const { activeOrganizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.UPDATE_ORGANIZATION)) {
    return {
      status: 403,
      body: {
        message: 'Permission denied',
      },
    };
  }

  const rules = await db.query.organizationInviteRules.findMany({
    where: eq(organizationInviteRules.organizationId, activeOrganizationId),
    with: {
      domain: true,
    },
  });

  return {
    status: 200,
    body: {
      rules: rules.map((rule) => ({
        id: rule.id,
        domain: rule.domain.domain,
        role: rule.role,
      })),
    },
  };
}

type DeleteInviteRuleRequest = ServerInferRequest<
  typeof contracts.organizations.deleteInviteRule
>;

type DeleteInviteRuleResponse = ServerInferResponses<
  typeof contracts.organizations.deleteInviteRule
>;

export async function deleteInviteRule(
  req: DeleteInviteRuleRequest,
): Promise<DeleteInviteRuleResponse> {
  const { activeOrganizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.UPDATE_ORGANIZATION)) {
    return {
      status: 403,
      body: {
        message: 'Permission denied',
      },
    };
  }

  const { ruleId } = req.params;

  await db
    .delete(organizationInviteRules)
    .where(
      and(
        eq(organizationInviteRules.id, ruleId),
        eq(organizationInviteRules.organizationId, activeOrganizationId),
      ),
    );

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

type GetOrganizationBillingHistoryResponse = ServerInferResponses<
  typeof contracts.organizations.getOrganizationBillingHistory
>;

type GetOrganizationBillingHistoryRequest = ServerInferRequest<
  typeof contracts.organizations.getOrganizationBillingHistory
>;

export async function getOrganizationBillingHistory(
  req: GetOrganizationBillingHistoryRequest,
): Promise<GetOrganizationBillingHistoryResponse> {
  const { cursor, limit } = req.query;

  const { activeOrganizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.MANAGE_BILLING)) {
    return {
      status: 403,
      body: {},
    };
  }

  const paymentHistory = await listPaymentIntents({
    cursor,
    limit,
    organizationId: activeOrganizationId,
  });

  return {
    status: 200,
    body: {
      nextCursor: paymentHistory.nextCursor || undefined,
      history: await Promise.all(
        paymentHistory.history.map(async (history) => {
          const paymentMethod =
            typeof history.payment_method === 'string'
              ? await getPaymentMethodDetails(
                  typeof history.customer === 'string'
                    ? history.customer
                    : history.customer?.id || '',
                  history.payment_method || '',
                )
              : history.payment_method;

          const recentCharge =
            typeof history.latest_charge === 'string'
              ? await getPaymentCharge(history.latest_charge || '')
              : history.latest_charge;

          return {
            id: history.id,
            amount: history.amount / 100,
            createdAt: new Date(history.created * 1000).toISOString(),
            description: history.description || '',
            receiptLink: recentCharge?.receipt_url || '',
            paymentMethod: {
              id: paymentMethod?.id || '',
              last4: paymentMethod?.card?.last4 || '',
              expMonth: paymentMethod?.card?.exp_month || 0,
              expYear: paymentMethod?.card?.exp_year || 0,
              brand: paymentMethod?.card?.brand || '',
            },
          };
        }),
      ),
    },
  };
}

type GetOrganizationCreditsResponse = ServerInferResponses<
  typeof contracts.organizations.getOrganizationCredits
>;

export async function getOrganizationCreditsRoute(): Promise<GetOrganizationCreditsResponse> {
  const { activeOrganizationId } =
    await getUserWithActiveOrganizationIdOrThrow();

  const credits = await getOrganizationCredits(activeOrganizationId);

  if (isNaN(credits)) {
    return {
      status: 500,
      body: {
        message: 'Failed to get credits',
      },
    };
  }

  return {
    status: 200,
    body: {
      credits,
    },
  };
}

type UpgradeOrganizationRequest = ServerInferRequest<
  typeof contracts.organizations.upgradeOrganization
>;

type UpgradeOrganizationResponse = ServerInferResponses<
  typeof contracts.organizations.upgradeOrganization
>;

async function upgradeOrganization(
  req: UpgradeOrganizationRequest,
): Promise<UpgradeOrganizationResponse> {
  const { activeOrganizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.MANAGE_BILLING)) {
    return {
      status: 403,
      body: {
        message: 'Permission denied',
      },
    };
  }

  const { tier, cardId } = req.body;

  await upgradeCustomer({
    organizationId: activeOrganizationId,
    tier,
    cardId,
  });

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

type CancelSubscriptionResponse = ServerInferResponses<
  typeof contracts.organizations.cancelOrganizationSubscription
>;

async function cancelOrganizationSubscription(): Promise<CancelSubscriptionResponse> {
  const { activeOrganizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.MANAGE_BILLING)) {
    return {
      status: 403,
      body: {
        message: 'Permission denied',
      },
    };
  }

  await cancelSubscription(activeOrganizationId);
  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

type GetOrganizationQuotasResponse = ServerInferResponses<
  typeof contracts.organizations.getOrganizationQuotas
>;

async function getOrganizationQuotas(): Promise<GetOrganizationQuotasResponse> {
  const { activeOrganizationId } =
    await getUserWithActiveOrganizationIdOrThrow();

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, activeOrganizationId),
  });

  if (!organization) {
    throw new Error('Organization not found');
  }

  const [agents, freeModelRequests, premiumModelRequests] = await Promise.all([
    getActiveBillableAgentsCount(activeOrganizationId),
    getRedisModelTransactions('free', activeOrganizationId),
    getRedisModelTransactions('premium', activeOrganizationId),
  ]);

  return {
    status: 200,
    body: {
      freeModelRequests,
      premiumModelRequests,
      agents,
    },
  };
}

type ResumeSubscriptionResponse = ServerInferResponses<
  typeof contracts.organizations.resumeOrganizationSubscription
>;

async function resumeOrganizationSubscription(): Promise<ResumeSubscriptionResponse> {
  const { activeOrganizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.MANAGE_BILLING)) {
    return {
      status: 403,
      body: {
        message: 'Permission denied',
      },
    };
  }

  await resumeSubscription(activeOrganizationId);

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

type GetFullOrganizationQuotasResponse = ServerInferResponses<
  typeof contracts.organizations.getFullOrganizationQuotas
>;

async function getFullOrganizationQuotas(): Promise<GetFullOrganizationQuotasResponse> {
  const { activeOrganizationId, lettaAgentsId } =
    await getUserWithActiveOrganizationIdOrThrow();

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, activeOrganizationId),
  });

  if (!organization) {
    throw new Error('Organization not found');
  }

  const [
    agentsCount,
    freeInferencesPerMonth,
    premiumInferencesPerMonth,
    [projectsData],
    identities,
    dataSources,
    storage,
    [templatesData],
    memoryBlocks,
  ] = await Promise.all([
    getActiveBillableAgentsCount(activeOrganizationId),
    getRedisModelTransactions('free', activeOrganizationId),
    getRedisModelTransactions('premium', activeOrganizationId),
    db
      .select({ count: count() })
      .from(projects)
      .where(eq(projects.organizationId, activeOrganizationId)),
    IdentitiesService.countIdentities(
      {},
      {
        user_id: lettaAgentsId,
      },
    ),
    SourcesService.countSources(
      {
        userId: lettaAgentsId,
      },
      {
        user_id: lettaAgentsId,
      },
    ),
    EmbeddingsService.getTotalStorageSize(
      {},
      {
        user_id: lettaAgentsId,
      },
    ),
    db
      .select({
        count: count(),
      })
      .from(agentTemplates)
      .where(eq(agentTemplates.organizationId, activeOrganizationId)),
    BlocksService.countBlocks(
      {
        userId: lettaAgentsId,
      },
      {
        user_id: lettaAgentsId,
      },
    ),
  ]);

  return {
    status: 200,
    body: {
      freeInferencesPerMonth,
      premiumInferencesPerMonth,
      agents: agentsCount,
      projects: projectsData.count,
      templates: templatesData.count,
      identities,
      dataSources,
      storage,
      memoryBlocks,
    },
  };
}

type GetAutoTopUpConfigurationResponse = ServerInferResponses<
  typeof contracts.organizations.getAutoTopUpConfiguration
>;

async function getAutoTopUpConfiguration(): Promise<GetAutoTopUpConfigurationResponse> {
  const { activeOrganizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.MANAGE_BILLING)) {
    return {
      status: 403,
      body: {
        message: 'Permission denied',
      },
    };
  }

  const config = await db.query.autoTopUpCreditsConfiguration.findFirst({
    where: eq(autoTopUpCreditsConfiguration.organizationId, activeOrganizationId),
  });

  return {
    status: 200,
    body: config
      ? {
          threshold: config.threshold,
          refillAmount: config.refillAmount,
          enabled: config.enabled,
          createdAt: config.createdAt.toISOString(),
          updatedAt: config.updatedAt.toISOString(),
        }
      : {
          threshold: 5000,
          refillAmount: 5000,
          enabled: false,
        },
  };
}

type UpsertAutoTopUpConfigurationRequest = ServerInferRequest<
  typeof contracts.organizations.upsertAutoTopUpConfiguration
>;

type UpsertAutoTopUpConfigurationResponse = ServerInferResponses<
  typeof contracts.organizations.upsertAutoTopUpConfiguration
>;

async function upsertAutoTopUpConfiguration(
  req: UpsertAutoTopUpConfigurationRequest,
): Promise<UpsertAutoTopUpConfigurationResponse> {
  const { activeOrganizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.MANAGE_BILLING)) {
    return {
      status: 403,
      body: {
        message: 'Permission denied',
      },
    };
  }

  const { threshold, refillAmount, enabled } = req.body;

  await db
    .insert(autoTopUpCreditsConfiguration)
    .values({
      organizationId: activeOrganizationId,
      threshold,
      refillAmount,
      enabled,
    })
    .onConflictDoUpdate({
      target: autoTopUpCreditsConfiguration.organizationId,
      set: {
        threshold,
        refillAmount,
        enabled,
      },
    });

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

export const organizationsRouter = {
  getCurrentOrganization,
  getCurrentOrganizationPreferences,
  getCurrentOrganizationTeamMembers,
  removeTeamMember,
  purchaseCredits,
  cancelOrganizationSubscription,
  resumeOrganizationSubscription,
  inviteNewTeamMember,
  unInviteTeamMember,
  upgradeOrganization,
  listInvitedMembers,
  deleteOrganization,
  updateOrganization,
  createOrganization,
  getCurrentOrganizationBillingInfo,
  regenerateInviteCode,
  getInviteByCode,
  startSetupIntent,
  getOrganizationCredits: getOrganizationCreditsRoute,
  updateOrganizationUserRole,
  getOrganizationPaymentMethods,
  removeOrganizationBillingMethod,
  setDefaultOrganizationBillingMethod,
  listVerifiedDomains,
  createInviteRule,
  getOrganizationQuotas,
  listInviteRules,
  deleteInviteRule,
  getOrganizationBillingHistory,
  getFullOrganizationQuotas,
  getAutoTopUpConfiguration,
  upsertAutoTopUpConfiguration,
};
