import { db, invitedUsers, lettaAPIKeys, users } from '@letta-web/database';
import {
  getUserOrganizationIdOrThrow,
  getUserOrThrow,
} from '$letta/server/auth';
import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '$letta/web-api/contracts';
import { and, eq, gt } from 'drizzle-orm';

type GetCurrentOrganizationResponse = ServerInferResponses<
  typeof contracts.organizations.getCurrentOrganization
>;

async function getCurrentOrganization(): Promise<GetCurrentOrganizationResponse> {
  const organizationId = await getUserOrganizationIdOrThrow();

  const organization = await db.query.organizations.findFirst({
    where: eq(lettaAPIKeys.id, organizationId),
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
    where: eq(lettaAPIKeys.id, organizationId),
  });

  if (!organization) {
    throw new Error('Organization not found');
  }

  const where = [eq(users.organizationId, organizationId)];

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
  const { organizationId, id: userId } = await getUserOrThrow();
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

  const invitedUser = await db.query.invitedUsers.findFirst({
    where: eq(invitedUsers.email, email),
  });

  if (invitedUser) {
    return {
      status: 400,
      body: {
        message: 'User already invited',
      },
    };
  }

  await db.insert(invitedUsers).values({
    email,
    organizationId,
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
  const { organizationId } = await getUserOrThrow();
  const { memberId } = req.params;

  await db
    .delete(invitedUsers)
    .where(
      and(
        eq(invitedUsers.id, memberId),
        eq(invitedUsers.organizationId, organizationId)
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
  const { organizationId, id: userId } = await getUserOrThrow();
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
      and(eq(users.id, memberId), eq(users.organizationId, organizationId))
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
  const { organizationId } = await getUserOrThrow();
  const { cursor, limit = 20 } = req.query;

  const where = [eq(invitedUsers.organizationId, organizationId)];

  if (cursor) {
    where.push(gt(invitedUsers.id, cursor));
  }

  const invitedMembers = await db.query.invitedUsers.findMany({
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

export const organizationsRouter = {
  getCurrentOrganization,
  getCurrentOrganizationTeamMembers,
  removeTeamMember,
  inviteNewTeamMember,
  unInviteTeamMember,
  listInvitedMembers,
};
