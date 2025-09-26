import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '@letta-cloud/sdk-web';
import {
  db,
  deployedAgentTemplates,
  launchLinkConfigurations,
  shareChatIdentity,
  shareChatUser,
} from '@letta-cloud/service-database';
import { and, desc, eq } from 'drizzle-orm';
import { getUserWithActiveOrganizationIdOrThrow } from '$web/server/auth';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { IdentitiesService } from '@letta-cloud/sdk-core';
import { createOrReturnSharedChatConfiguration } from '$web/server/lib/createOrReturnSharedChatConfiguration/createOrReturnSharedChatConfiguration';
import { cloudApiRouter } from 'tmp-cloud-api-router';

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

type GetLaunchLinkMetadataByLaunchIdRequest = ServerInferRequest<
  typeof contracts.launchLinks.getLaunchLinkMetadataByLaunchId
>;

type GetLaunchLinkMetadataByLaunchIdResponse = ServerInferResponses<
  typeof contracts.launchLinks.getLaunchLinkMetadataByLaunchId
>;

async function getLaunchLinkMetadataByLaunchId(
  req: GetLaunchLinkMetadataByLaunchIdRequest,
): Promise<GetLaunchLinkMetadataByLaunchIdResponse> {
  const { launchId } = req.params;

  const { activeOrganizationId } =
    await getUserWithActiveOrganizationIdOrThrow();
  const launchLink = await db.query.launchLinkConfigurations.findFirst({
    where: eq(launchLinkConfigurations.launchLink, launchId),
    columns: {
      organizationId: true,
      agentTemplateId: true,
      accessLevel: true,
      launchLink: true,
    },
    with: {
      organization: {
        columns: {
          name: true,
        },
      },
      agentTemplate: {
        with: {
          deployedAgentTemplates: {
            orderBy: desc(deployedAgentTemplates.createdAt),
            limit: 1,
          },
        },
      },
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

  if (launchLink.accessLevel === 'organization') {
    if (launchLink.organizationId !== activeOrganizationId) {
      return {
        status: 403,
        body: {
          message: 'You do not have permission to view this launch link',
        },
      };
    }
  }

  const deployedAgentTemplate =
    launchLink.agentTemplate?.deployedAgentTemplates[0];

  if (!deployedAgentTemplate) {
    return {
      status: 404,
      body: {
        message: 'Deployed agent template not found',
      },
    };
  }

  return {
    status: 200,
    body: {
      organizationName: launchLink.organization?.name || '',
      ...launchLink,
      memoryVariables: deployedAgentTemplate.memoryVariables?.data || [],
    },
  };
}

type CreateShareChatFromLaunchLink = ServerInferRequest<
  typeof contracts.launchLinks.createShareChatFromLaunchLink
>;

type CreateShareChatFromLaunchLinkResponse = ServerInferResponses<
  typeof contracts.launchLinks.createShareChatFromLaunchLink
>;

async function createShareChatFromLaunchLink(
  req: CreateShareChatFromLaunchLink,
): Promise<CreateShareChatFromLaunchLinkResponse> {
  const { agentTemplateId } = req.params;
  const { memoryVariables } = req.body;
  const {
    activeOrganizationId,
    id: userId,
    lettaAgentsId,
    name: userName,
  } = await getUserWithActiveOrganizationIdOrThrow();

  // check for existing chat
  const existingChat = await db.query.shareChatUser.findFirst({
    where: and(
      eq(shareChatUser.agentTemplateId, agentTemplateId),
      eq(shareChatUser.userId, userId),
    ),
  });

  if (existingChat) {
    return {
      status: 200,
      body: {
        chatId: existingChat.chatId,
      },
    };
  }

  const launchLink = await db.query.launchLinkConfigurations.findFirst({
    where: eq(launchLinkConfigurations.agentTemplateId, agentTemplateId),
    columns: {
      organizationId: true,
      agentTemplateId: true,
      accessLevel: true,
      launchLink: true,
    },
    with: {
      agentTemplate: {
        with: {
          organization: {
            columns: {
              name: true,
            },
          },
          project: {
            columns: {
              slug: true,
            },
          },
          deployedAgentTemplates: {
            orderBy: desc(deployedAgentTemplates.createdAt),
            limit: 1,
          },
        },
      },
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

  if (launchLink.accessLevel === 'organization') {
    if (launchLink.organizationId !== activeOrganizationId) {
      return {
        status: 403,
        body: {
          message: 'You do not have permission to view this launch link',
        },
      };
    }
  }

  const templateName = launchLink.agentTemplate?.name;

  if (!templateName) {
    return {
      status: 404,
      body: {
        message: 'Template not found',
      },
    };
  }

  const deployedAgentTemplate =
    launchLink.agentTemplate.deployedAgentTemplates[0];

  if (!deployedAgentTemplate) {
    return {
      status: 404,
      body: {
        message: 'Deployed agent template not found',
      },
    };
  }

  const organizationName = launchLink.agentTemplate.organization?.name;

  if (!organizationName) {
    return {
      status: 404,
      body: {
        message: 'Organization not found',
      },
    };
  }

  const projectSlug = launchLink.agentTemplate?.project?.slug;

  if (!projectSlug) {
    return {
      status: 404,
      body: {
        message: 'Project not found',
      },
    };
  }

  const response = await cloudApiRouter.templates.createAgentsFromTemplate(
    {
      params: {
        project_id: projectSlug || '',
        template_version: `${launchLink.agentTemplate.name}:${deployedAgentTemplate.version}`,
      },
      body: {
        agent_name: `Chatting with ${templateName}`,
        memory_variables: memoryVariables || {},
      },
    },
    {
      request: {
        organizationId: activeOrganizationId,
        lettaAgentsUserId: lettaAgentsId,
        source: 'web',
        projectSlug: projectSlug,
        userId,
      },
    },
  );

  if (response.status !== 201) {
    return {
      status: 500,
      body: {
        message: 'Failed to create agent',
      },
    };
  }

  const [agent] = response.body.agents;

  if (!agent) {
    return {
      status: 500,
      body: {
        message: 'Failed to create agent',
      },
    };
  }

  const shareChat = await createOrReturnSharedChatConfiguration({
    agentId: agent.id,
    organizationId: activeOrganizationId,
    projectId: launchLink.agentTemplate.projectId,
    launchLinkId: launchLink.agentTemplateId,
    accessLevel: 'restricted',
  });

  if (!shareChat) {
    return {
      status: 500,
      body: {
        message: 'Failed to create shared chat',
      },
    };
  }

  // identityId
  const identities = await IdentitiesService.listIdentities(
    {
      identifierKey: `chat-user-${userId}`,
      projectId: launchLink.agentTemplate.projectId,
    },
    {
      user_id: lettaAgentsId,
    },
  );

  let identityId = identities[0]?.id;

  if (!identityId) {
    // create identity

    const identity = await IdentitiesService.createIdentity(
      {
        requestBody: {
          identifier_key: `chat-user-${userId}`,
          name: userName,
          agent_ids: [agent.id],
          identity_type: 'user',
          project_id: launchLink.agentTemplate.projectId,
        },
      },
      {
        user_id: lettaAgentsId,
      },
    );

    identityId = identity.id;
  } else {
    await IdentitiesService.updateIdentity(
      {
        identityId,
        requestBody: {
          agent_ids: [agent.id],
        },
      },
      {
        user_id: lettaAgentsId,
      },
    );
  }

  if (!identityId) {
    return {
      status: 500,
      body: {
        message: 'Failed to create identity',
      },
    };
  }

  await db
    .insert(shareChatIdentity)
    .values({
      identityId,
      organizationId: activeOrganizationId,
      projectId: launchLink.agentTemplate.projectId,
    })
    .onConflictDoNothing();

  await db.insert(shareChatUser).values({
    chatId: shareChat.chatId,
    deployedAgentId: agent.id,
    identityId,
    agentTemplateId,
    userId,
  });

  return {
    status: 200,
    body: {
      chatId: shareChat.chatId,
    },
  };
}

export const launchLinkRoutes = {
  getLaunchLink,
  updateLaunchLink,
  createLaunchLink,
  getLaunchLinkMetadataByLaunchId,
  createShareChatFromLaunchLink,
};
