import {
  db,
  organizationBillingDetails,
  organizationCredits,
  organizationInvitedUsers,
  organizationPreferences,
  organizations,
  organizationUsers,
  users,
} from '@letta-cloud/database';
import {
  createOrganization as authCreateOrganization,
  getUserActiveOrganizationIdOrThrow,
  getUserOrThrow,
  getUserWithActiveOrganizationIdOrThrow,
} from '$web/server/auth';
import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '$web/web-api/contracts';
import { and, eq, gt, ilike } from 'drizzle-orm';
import { generateInviteCode, parseInviteCode } from '$web/utils';
import {
  createSetupIntent,
  getPaymentCustomer,
  listCreditCards,
  removePaymentMethod,
} from '@letta-cloud/payments';
import { setDefaultPaymentMethod } from '@letta-cloud/payments';
import { ApplicationServices } from '@letta-cloud/rbac';

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

  const where = [eq(organizationUsers.organizationId, organizationId)];

  if (search) {
    where.push(ilike(users.name, `%${search}%`));
  }

  const members = await db.query.organizationUsers.findMany({
    where: and(...where),
    offset,
    limit: limit + 1,
    with: {
      user: true,
    },
  });

  return {
    status: 200,
    body: {
      nextCursor:
        members.length > limit ? members[limit - 1].userId : undefined,
      members: members.slice(0, limit).map((member) => ({
        id: member.userId,
        role: member.role,
        name: member.user.name,
        email: member.user.email,
        createdAt: member.createdAt.toISOString(),
        updatedAt: member.updatedAt.toISOString(),
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
  const { email } = req.body;

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
      .where(and(eq(organizationUsers.userId, memberId))),
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
  const { id, email } = await getUserOrThrow();

  const res = await authCreateOrganization({
    name: req.body.name,
    email,
  });

  await Promise.all([
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
  const paymentCustomer = await getPaymentCustomer(activeOrganizationId);
  const creditCards = await listCreditCards({
    organizationId: activeOrganizationId,
  });

  return {
    status: 200,
    body: {
      billingTier: organization.billingTier || 'basic',
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
        isDefault:
          paymentCustomer?.invoice_settings.default_payment_method === card.id,
        name: card.billing_details.name || '',
      })),
      totalCredits: parseInt(credits.credits, 10),
    },
  };
}

type StartSetupIntentResponse = ServerInferResponses<
  typeof contracts.organizations.startSetupIntent
>;

export async function startSetupIntent(): Promise<StartSetupIntentResponse> {
  const { activeOrganizationId } =
    await getUserWithActiveOrganizationIdOrThrow();

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
  const { activeOrganizationId } =
    await getUserWithActiveOrganizationIdOrThrow();

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

export const organizationsRouter = {
  getCurrentOrganization,
  getCurrentOrganizationPreferences,
  getCurrentOrganizationTeamMembers,
  removeTeamMember,
  inviteNewTeamMember,
  unInviteTeamMember,
  listInvitedMembers,
  deleteOrganization,
  updateOrganization,
  createOrganization,
  getCurrentOrganizationBillingInfo,
  regenerateInviteCode,
  getInviteByCode,
  startSetupIntent,
  updateOrganizationUserRole,
  removeOrganizationBillingMethod,
  setDefaultOrganizationBillingMethod,
};
