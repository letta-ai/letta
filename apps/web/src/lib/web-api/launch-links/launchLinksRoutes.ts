import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '@letta-cloud/web-api-client';
import { db, launchLinkConfigurations } from '@letta-cloud/database';
import { and, eq } from 'drizzle-orm';
import { getUserWithActiveOrganizationIdOrThrow } from '$web/server/auth';
import { ApplicationServices } from '@letta-cloud/rbac';

type GetLaunchLinkContractRequest = ServerInferRequest<
  typeof contracts.launchLinks.getLaunchLink
>;

type GetLaunchLinkContractResponse = ServerInferResponses<
  typeof contracts.launchLinks.getLaunchLink
>;

async function getLaunchLink(
  req: GetLaunchLinkContractRequest,
): Promise<GetLaunchLinkContractResponse> {
  const { agentTemplateId } = req.params;
  const { permissions, activeOrganizationId } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.READ_TEMPLATES)) {
    return {
      status: 403,
      body: {
        message: 'You do not have permission to read a launch link',
      },
    };
  }

  const launchLink = await db.query.launchLinkConfigurations.findFirst({
    where: and(
      eq(launchLinkConfigurations.agentTemplateId, agentTemplateId),
      eq(launchLinkConfigurations.organizationId, activeOrganizationId),
    ),
    columns: {
      agentTemplateId: true,
      accessLevel: true,
      launchLink: true,
    },
  });

  if (!launchLink) {
    return {
      status: 404,
      body: {
        message: 'Launch link not found',
      },
    };
  }

  return {
    status: 200,
    body: launchLink,
  };
}

type UpdateLaunchLinkContractRequest = ServerInferRequest<
  typeof contracts.launchLinks.updateLaunchLink
>;

type UpdateLaunchLinkContractResponse = ServerInferResponses<
  typeof contracts.launchLinks.updateLaunchLink
>;

async function updateLaunchLink(
  req: UpdateLaunchLinkContractRequest,
): Promise<UpdateLaunchLinkContractResponse> {
  const { agentTemplateId } = req.params;
  const { accessLevel } = req.body;

  const { permissions, activeOrganizationId } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (
    !permissions.has(
      ApplicationServices.UPDATE_ORGANIZATION_ENVIRONMENT_VARIABLES,
    )
  ) {
    return {
      status: 403,
      body: {
        message: 'You do not have permission to update a launch link',
      },
    };
  }

  const launchLink = await db.query.launchLinkConfigurations.findFirst({
    where: and(
      eq(launchLinkConfigurations.agentTemplateId, agentTemplateId),
      eq(launchLinkConfigurations.organizationId, activeOrganizationId),
    ),
  });

  if (!launchLink) {
    return {
      status: 404,
      body: {
        message: 'Launch link not found',
      },
    };
  }

  const [returning] = await db
    .update(launchLinkConfigurations)
    .set({
      accessLevel,
    })
    .where(eq(launchLinkConfigurations.agentTemplateId, agentTemplateId))
    .returning({
      agentTemplateId: launchLinkConfigurations.agentTemplateId,
      accessLevel: launchLinkConfigurations.accessLevel,
      launchLink: launchLinkConfigurations.launchLink,
    });

  return {
    status: 200,
    body: returning,
  };
}

type CreateLaunchLinkContractRequest = ServerInferRequest<
  typeof contracts.launchLinks.createLaunchLink
>;

type CreateLaunchLinkContractResponse = ServerInferResponses<
  typeof contracts.launchLinks.createLaunchLink
>;

async function createLaunchLink(
  req: CreateLaunchLinkContractRequest,
): Promise<CreateLaunchLinkContractResponse> {
  const { agentTemplateId } = req.params;
  const { activeOrganizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.CREATE_UPDATE_DELETE_TEMPLATES)) {
    return {
      status: 403,
      body: {
        message: 'You do not have permission to create a launch link',
      },
    };
  }

  const randomId = `${Math.random().toString(36).substring(2, 15)}${Date.now().toString(36)}`;

  const [launchLink] = await db
    .insert(launchLinkConfigurations)
    .values({
      agentTemplateId: agentTemplateId,
      accessLevel: 'organization',
      launchLink: randomId,
      organizationId: activeOrganizationId,
    })
    .returning({
      agentTemplateId: launchLinkConfigurations.agentTemplateId,
      accessLevel: launchLinkConfigurations.accessLevel,
      launchLink: launchLinkConfigurations.launchLink,
    });

  return {
    status: 201,
    body: launchLink,
  };
}

export const launchLinkRoutes = {
  getLaunchLink,
  updateLaunchLink,
  createLaunchLink,
};
