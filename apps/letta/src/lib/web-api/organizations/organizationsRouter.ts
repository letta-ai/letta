import {
  db,
  organizationInvitedUsers,
  users,
  organizations,
  projects,
  lettaAPIKeys,
  organizationUsers,
} from '@letta-web/database';
import {
  createOrganization as authCreateOrganization,
  getUserActiveOrganizationIdOrThrow,
  getUserOrThrow,
  getUserWithActiveOrganizationIdOrThrow,
} from '$letta/server/auth';
import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '$letta/web-api/contracts';
import { and, eq, gt, inArray, like } from 'drizzle-orm';
import { deleteProject } from '$letta/web-api/projects/projectsRouter';
import { AdminService } from '@letta-web/letta-agents-api';

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
  req: GetCurrentOrganizationTeamMembersRequest
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
    where.push(like(users.name, `%${search}%`));
  }

  const members = await db.query.organizationUsers.findMany({
    where: and(...where),
    offset,
    limit: limit + 1,
  });

  const userList = await db.query.users.findMany({
    where: and(
      inArray(
        users.id,
        members.map((member) => member.userId)
      )
    ),
  });

  return {
    status: 200,
    body: {
      nextCursor:
        userList.length > limit ? members[limit - 1].userId : undefined,
      members: userList.slice(0, limit).map((member) => ({
        id: member.id,
        name: member.name,
        email: member.email,
        createdAt: member.createdAt.toISOString(),
        updatedAt: member.updatedAt.toISOString(),
      })),
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
  req: InviteNewTeamMemberRequest
): Promise<InviteNewTeamMemberResponse> {
  const { activeOrganizationId, id: userId } =
    await getUserWithActiveOrganizationIdOrThrow();
  const { email } = req.body;

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (user) {
    // check if user is already in the organization
    const userInOrganization = await db.query.organizationUsers.findFirst({
      where: and(
        eq(organizationUsers.userId, user.id),
        eq(organizationUsers.organizationId, activeOrganizationId)
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
      permissions: {},
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

  const invitedUser = await db.query.organizationInvitedUsers.findFirst({
    where: and(
      eq(organizationInvitedUsers.email, email),
      eq(organizationInvitedUsers.organizationId, activeOrganizationId)
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
      invitedBy: userId,
    })
    .returning({ id: organizationInvitedUsers.id });

  return {
    status: 201,
    body: {
      email,
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
  req: UnInviteTeamMemberRequest
): Promise<UnInviteTeamMemberResponse> {
  const { activeOrganizationId } =
    await getUserWithActiveOrganizationIdOrThrow();
  const { memberId } = req.params;

  await db
    .delete(organizationInvitedUsers)
    .where(
      and(
        eq(organizationInvitedUsers.id, memberId),
        eq(organizationInvitedUsers.organizationId, activeOrganizationId)
      )
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
  req: RemoveTeamMember
): Promise<RemoveTeamMemberResponse> {
  const { activeOrganizationId, id: userId } =
    await getUserWithActiveOrganizationIdOrThrow();
  const { memberId } = req.params;

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
          eq(users.activeOrganizationId, activeOrganizationId)
        )
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
  req: ListInvitedMembersRequest
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
    where.push(like(organizationInvitedUsers.email, `%${search}%`));
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
  req: UpdateOrganizationRequest
): Promise<UpdateOrganizationResponse> {
  const { activeOrganizationId } =
    await getUserWithActiveOrganizationIdOrThrow();
  const { name } = req.body;

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
  const { activeOrganizationId } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!activeOrganizationId) {
    return {
      status: 400,
      body: {
        message: 'No active organization',
      },
    };
  }

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, activeOrganizationId),
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
    .set({ deletedAt: new Date() })
    .where(eq(organizations.id, activeOrganizationId));

  // return all projects in this organization
  const projectsList = await db.query.projects.findMany({
    where: eq(projects.organizationId, activeOrganizationId),
  });

  const operations = [];

  // remove users from the organization
  operations.push(
    db
      .delete(organizationUsers)
      .where(eq(organizationUsers.organizationId, activeOrganizationId))
  );

  operations.push(
    await Promise.all(
      projectsList.map(async (project) => {
        return deleteProject({
          params: {
            projectId: project.id,
          },
        });
      })
    )
  );

  // delete api keys
  operations.push(
    db
      .update(lettaAPIKeys)
      .set({ deletedAt: new Date() })
      .where(eq(lettaAPIKeys.organizationId, activeOrganizationId))
  );

  // delete data on letta-agents
  // this should propagate to all agents, tools, etc
  operations.push(
    AdminService.deleteOrganization({
      orgId: organization.lettaAgentsId,
    })
  );

  await Promise.all(operations);

  return {
    status: 200,
    body: {
      success: true,
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
  req: CreateOrganizationRequest
): Promise<CreateOrganizationResponse> {
  const { id } = await getUserOrThrow();

  const res = await authCreateOrganization({
    name: req.body.name,
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
      permissions: { isOrganizationAdmin: true },
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

export const organizationsRouter = {
  getCurrentOrganization,
  getCurrentOrganizationTeamMembers,
  removeTeamMember,
  inviteNewTeamMember,
  unInviteTeamMember,
  listInvitedMembers,
  deleteOrganization,
  updateOrganization,
  createOrganization,
};
