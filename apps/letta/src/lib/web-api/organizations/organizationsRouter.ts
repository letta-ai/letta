import {
  db,
  organizationInvitedUsers,
  users,
  organizations,
  projects,
  lettaAPIKeys,
} from '@letta-web/database';
import {
  getUserOrganizationIdOrThrow,
  getUserOrThrow,
} from '$letta/server/auth';
import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '$letta/web-api/contracts';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { deleteProject } from '$letta/web-api/projects/projectsRouter';
import { AdminService } from '@letta-web/letta-agents-api';

type GetCurrentOrganizationResponse = ServerInferResponses<
  typeof contracts.organizations.getCurrentOrganization
>;

async function getCurrentOrganization(): Promise<GetCurrentOrganizationResponse> {
  const organizationId = await getUserOrganizationIdOrThrow();

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
  const { cursor, limit = 20 } = req.query;
  const organizationId = await getUserOrganizationIdOrThrow();

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });

  if (!organization) {
    throw new Error('Organization not found');
  }

  const where = [
    eq(users.activeOrganizationId, organizationId),
    isNull(users.deletedAt),
  ];

  if (cursor) {
    where.push(gt(users.id, cursor));
  }

  const members = await db.query.users.findMany({
    where: and(...where),
    limit: limit + 1,
  });

  return {
    status: 200,
    body: {
      nextCursor: members.length > limit ? members[limit - 1].id : undefined,
      members: members.slice(0, limit).map((member) => ({
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
  const { activeOrganizationId, id: userId } = await getUserOrThrow();
  const { email } = req.body;

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (user) {
    return {
      status: 400,
      body: {
        message: 'User already exists',
      },
    };
  }

  const invitedUser = await db.query.organizationInvitedUsers.findFirst({
    where: eq(organizationInvitedUsers.email, email),
  });

  if (invitedUser) {
    return {
      status: 400,
      body: {
        message: 'User already invited',
      },
    };
  }

  await db.insert(organizationInvitedUsers).values({
    email,
    organizationId: activeOrganizationId,
    invitedBy: userId,
  });

  return {
    status: 201,
    body: {
      email,
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
  const { activeOrganizationId } = await getUserOrThrow();
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
  const { activeOrganizationId, id: userId } = await getUserOrThrow();
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

  await db
    .delete(users)
    .where(
      and(
        eq(users.id, memberId),
        eq(users.activeOrganizationId, activeOrganizationId)
      )
    );

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
  const { activeOrganizationId } = await getUserOrThrow();
  const { cursor, limit = 20 } = req.query;

  const where = [
    eq(organizationInvitedUsers.organizationId, activeOrganizationId),
  ];

  if (cursor) {
    where.push(gt(organizationInvitedUsers.id, cursor));
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
  const { activeOrganizationId } = await getUserOrThrow();
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
  const { activeOrganizationId } = await getUserOrThrow();

  await db
    .update(organizations)
    .set({ deletedAt: new Date() })
    .where(eq(organizations.id, activeOrganizationId));

  // return all projects in this organization
  const projectsList = await db.query.projects.findMany({
    where: eq(projects.organizationId, activeOrganizationId),
  });

  const operations = [];

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
      orgId: activeOrganizationId,
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

export const organizationsRouter = {
  getCurrentOrganization,
  getCurrentOrganizationTeamMembers,
  removeTeamMember,
  inviteNewTeamMember,
  unInviteTeamMember,
  listInvitedMembers,
  deleteOrganization,
  updateOrganization,
};
