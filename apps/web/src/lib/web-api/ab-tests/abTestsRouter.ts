import {
  db,
  abTests,
  projects,
  abTestAgentTemplates,
  agentTemplates,
} from '@letta-cloud/service-database';
import { getUserWithActiveOrganizationIdOrThrow } from '$web/server/auth';
import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '$web/web-api/contracts';
import { and, count, eq, ilike } from 'drizzle-orm';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { getCustomerSubscription } from '@letta-cloud/service-payments';
import { getUsageLimits } from '@letta-cloud/utils-shared';
import { createSimulatedAgent } from '@letta-cloud/utils-server';
import { AgentsService } from '@letta-cloud/sdk-core';
import * as Sentry from '@sentry/nextjs';

type CreateAbTestRequest = ServerInferRequest<
  typeof contracts.abTest.createAbTest
>;
type CreateAbTestResponse = ServerInferResponses<
  typeof contracts.abTest.createAbTest
>;

export async function createAbTest(
  req: CreateAbTestRequest,
): Promise<CreateAbTestResponse> {
  const { name, description, uuid, projectId } = req.body;

  const { activeOrganizationId: organizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.CREATE_AB_TESTS)) {
    return {
      status: 403,
      body: null,
    };
  }

  // existing abTest count
  const [abTestCountReturn] = await db
    .select({ count: count() })
    .from(abTests)
    .where(eq(abTests.organizationId, organizationId));

  const subscription = await getCustomerSubscription(organizationId);
  const limits = await getUsageLimits(subscription.tier);

  if (abTestCountReturn?.count >= limits.abTests) {
    return {
      status: 400,
      body: {
        message: 'AB test limit reached',
        limit: limits.abTests,
        errorCode: 'usageLimit',
      },
    };
  }

  // Verify project exists and belongs to the organization
  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.organizationId, organizationId),
    ),
  });

  if (!project) {
    return {
      status: 400,
      body: {
        message: 'Project not found or does not belong to your organization',
        errorCode: 'validation',
      },
    };
  }

  const [abTest] = await db
    .insert(abTests)
    .values({
      id: uuid,
      name,
      description,
      projectId,
      organizationId,
    })
    .returning();

  return {
    status: 201,
    body: {
      id: abTest.id,
      name: abTest.name,
      description: abTest.description,
      organizationId: abTest.organizationId,
      projectId: abTest.projectId,
      createdAt: abTest.createdAt.toISOString(),
      updatedAt: abTest.updatedAt.toISOString(),
    },
  };
}

type UpdateAbTestRequest = ServerInferRequest<
  typeof contracts.abTest.updateAbTest
>;
type UpdateAbTestResponse = ServerInferResponses<
  typeof contracts.abTest.updateAbTest
>;

export async function updateAbTest(
  req: UpdateAbTestRequest,
): Promise<UpdateAbTestResponse> {
  const { abTestId } = req.params;
  const { name, description } = req.body;

  const { activeOrganizationId: organizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.UPDATE_AB_TESTS)) {
    return {
      status: 403,
      body: null,
    };
  }

  // Verify ab test exists and belongs to the organization
  const existingAbTest = await db.query.abTests.findFirst({
    where: and(
      eq(abTests.id, abTestId),
      eq(abTests.organizationId, organizationId),
    ),
  });

  if (!existingAbTest) {
    return {
      status: 404,
      body: {
        message: 'AB test not found',
      },
    };
  }

  const [updatedAbTest] = await db
    .update(abTests)
    .set({
      name,
      description,
    })
    .where(
      and(eq(abTests.id, abTestId), eq(abTests.organizationId, organizationId)),
    )
    .returning();

  return {
    status: 200,
    body: {
      id: updatedAbTest.id,
      name: updatedAbTest.name,
      description: updatedAbTest.description,
      organizationId: updatedAbTest.organizationId,
      projectId: updatedAbTest.projectId,
      createdAt: updatedAbTest.createdAt.toISOString(),
      updatedAt: updatedAbTest.updatedAt.toISOString(),
    },
  };
}

type GetAbTestsRequest = ServerInferRequest<typeof contracts.abTest.getAbTests>;
type GetAbTestsResponse = ServerInferResponses<
  typeof contracts.abTest.getAbTests
>;

export async function getAbTests(
  req: GetAbTestsRequest,
): Promise<GetAbTestsResponse> {
  const { activeOrganizationId: organizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.READ_AB_TESTS)) {
    return {
      status: 403,
      body: null,
    };
  }

  const { offset, limit = 10, search, projectId } = req.query;

  const where = [eq(abTests.organizationId, organizationId)];

  if (projectId) {
    where.push(eq(abTests.projectId, projectId));
  }

  if (search) {
    where.push(ilike(abTests.name, `%${search}%`));
  }

  const abTestResults = await db.query.abTests.findMany({
    where: and(...where),
    offset,
    limit: limit + 1,
    orderBy: (abTests, { desc }) => [desc(abTests.createdAt)],
  });

  return {
    status: 200,
    body: {
      abTests: abTestResults.slice(0, limit).map((abTest) => ({
        id: abTest.id,
        name: abTest.name,
        description: abTest.description,
        organizationId: abTest.organizationId,
        projectId: abTest.projectId,
        createdAt: abTest.createdAt.toISOString(),
        updatedAt: abTest.updatedAt.toISOString(),
      })),
      hasNextPage: abTestResults.length > limit,
    },
  };
}

type GetAbTestRequest = ServerInferRequest<typeof contracts.abTest.getAbTest>;
type GetAbTestResponse = ServerInferResponses<
  typeof contracts.abTest.getAbTest
>;

export async function getAbTest(
  req: GetAbTestRequest,
): Promise<GetAbTestResponse> {
  const { abTestId } = req.params;

  const { activeOrganizationId: organizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.READ_AB_TESTS)) {
    return {
      status: 403,
      body: null,
    };
  }

  const abTest = await db.query.abTests.findFirst({
    where: and(
      eq(abTests.id, abTestId),
      eq(abTests.organizationId, organizationId),
    ),
  });

  if (!abTest) {
    return {
      status: 404,
      body: {
        message: 'AB test not found',
      },
    };
  }

  return {
    status: 200,
    body: {
      id: abTest.id,
      name: abTest.name,
      description: abTest.description,
      organizationId: abTest.organizationId,
      projectId: abTest.projectId,
      createdAt: abTest.createdAt.toISOString(),
      updatedAt: abTest.updatedAt.toISOString(),
    },
  };
}

type DeleteAbTestRequest = ServerInferRequest<
  typeof contracts.abTest.deleteAbTest
>;
type DeleteAbTestResponse = ServerInferResponses<
  typeof contracts.abTest.deleteAbTest
>;

export async function deleteAbTest(
  req: DeleteAbTestRequest,
): Promise<DeleteAbTestResponse> {
  const { abTestId } = req.params;

  const { activeOrganizationId: organizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.DELETE_AB_TESTS)) {
    return {
      status: 403,
      body: null,
    };
  }

  // Verify ab test exists and belongs to the organization
  const existingAbTest = await db.query.abTests.findFirst({
    where: and(
      eq(abTests.id, abTestId),
      eq(abTests.organizationId, organizationId),
    ),
  });

  if (!existingAbTest) {
    return {
      status: 404,
      body: {
        message: 'AB test not found',
      },
    };
  }

  await db
    .delete(abTests)
    .where(
      and(eq(abTests.id, abTestId), eq(abTests.organizationId, organizationId)),
    );

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

type GetAbTestTemplatesRequest = ServerInferRequest<
  typeof contracts.abTest.getAbTestTemplates
>;

type GetAbTestTemplatesResponse = ServerInferResponses<
  typeof contracts.abTest.getAbTestTemplates
>;

export async function getAbTestTemplates(
  req: GetAbTestTemplatesRequest,
): Promise<GetAbTestTemplatesResponse> {
  const { abTestId } = req.params;

  const { activeOrganizationId: organizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.READ_AB_TESTS)) {
    return {
      status: 403,
      body: null,
    };
  }

  // check if AB test exists and belongs to the organization
  const existingAbTest = await db.query.abTests.findFirst({
    where: and(
      eq(abTests.id, abTestId),
      eq(abTests.organizationId, organizationId),
    ),
    with: {
      project: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!existingAbTest) {
    return {
      status: 404,
      body: {
        message: 'AB test not found',
      },
    };
  }

  const templates = await db.query.abTestAgentTemplates.findMany({
    where: and(
      eq(abTestAgentTemplates.abTestId, abTestId),
      eq(abTestAgentTemplates.organizationId, organizationId),
    ),
    with: {
      agentTemplate: {
        columns: {
          name: true,
        },
      },
      deployedAgentTemplate: {
        columns: {
          version: true,
        },
      },
      simulatedAgent: {
        columns: {
          agentId: true,
        },
      },
    },
  });

  // Fetch templates associated with the AB test
  // This part is omitted in the original code, assuming a similar structure to other queries
  return {
    status: 200,
    body: {
      templates: templates.map((template) => ({
        id: template.id,
        coreAgentId: template.simulatedAgent?.agentId,
        simulatedAgentId: template.simulatedAgentId,
        templateName: `${template?.agentTemplate?.name || 'deleted-template'}:${template.deployedAgentTemplate?.version || 'current'}`,
      })),
    },
  };
}

type AttachAbTestTemplateRequest = ServerInferRequest<
  typeof contracts.abTest.attachAbTestTemplate
>;

type AttachAbTestTemplateResponse = ServerInferResponses<
  typeof contracts.abTest.attachAbTestTemplate
>;

export async function attachAbTestTemplate(
  req: AttachAbTestTemplateRequest,
): Promise<AttachAbTestTemplateResponse> {
  const { abTestId } = req.params;
  const { memoryVariables, templateName } = req.body;

  const {
    activeOrganizationId: organizationId,
    lettaAgentsId,
    permissions,
  } = await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.UPDATE_AB_TESTS)) {
    return {
      status: 403,
      body: null,
    };
  }

  // Verify AB test exists and belongs to the organization
  const existingAbTest = await db.query.abTests.findFirst({
    where: and(
      eq(abTests.id, abTestId),
      eq(abTests.organizationId, organizationId),
    ),
  });

  if (!existingAbTest) {
    return {
      status: 404,
      body: {
        message: 'AB test not found',
      },
    };
  }

  // if templateName is not in the format "name:version", throw an error
  if (!templateName.includes(':')) {
    return {
      status: 400,
      body: {
        message: 'Template name must be in the format "name:version"',
      },
    };
  }

  const [name, version] = templateName.split(':');

  const isLatest = !version || version === 'current';

  // get template
  const agentTemplate = await db.query.agentTemplates.findFirst({
    where: and(
      eq(agentTemplates.name, name),
      eq(agentTemplates.organizationId, organizationId),
    ),
    with: {
      deployedAgentTemplates: {
        where: (deployedAgentTemplates, { eq }) =>
          eq(deployedAgentTemplates.version, version),
      },
    },
  });

  if (!agentTemplate) {
    return {
      status: 404,
      body: {
        message: 'Agent template not found',
      },
    };
  }

  const deployedAgentTemplate = agentTemplate.deployedAgentTemplates?.[0];

  if (!isLatest && !deployedAgentTemplate) {
    return {
      status: 404,
      body: {
        message: `Agent template version ${version} not found`,
      },
    };
  }

  const simulatedAgent = await createSimulatedAgent({
    projectId: existingAbTest.projectId,
    organizationId,
    lettaAgentsId,
    isDefault: false,
    memoryVariables: memoryVariables || {},
    agentTemplateId: agentTemplate.id,
  });

  if (!simulatedAgent.agent) {
    return {
      status: 500,
      body: {
        message: 'Failed to create simulated agent',
      },
    };
  }

  // Attach the template
  const [attachedTemplate] = await db
    .insert(abTestAgentTemplates)
    .values({
      abTestId,
      agentTemplateId: agentTemplate.id,
      projectId: existingAbTest.projectId,
      deployedAgentTemplateId: isLatest ? null : deployedAgentTemplate.id,
      organizationId,
      simulatedAgentId: simulatedAgent.simulatedAgentRecord.id,
    })
    .returning();

  return {
    status: 200,
    body: {
      id: attachedTemplate.id,
      simulatedAgentId: attachedTemplate.simulatedAgentId,
      coreAgentId: simulatedAgent.agent.id,
      templateName,
    },
  };
}

type DetachAbTestTemplateRequest = ServerInferRequest<
  typeof contracts.abTest.detachAbTestTemplate
>;

type DetachAbTestTemplateResponse = ServerInferResponses<
  typeof contracts.abTest.detachAbTestTemplate
>;

export async function detachAbTestTemplate(
  req: DetachAbTestTemplateRequest,
): Promise<DetachAbTestTemplateResponse> {
  const { abTestId, attachedTemplateId } = req.params;

  const {
    activeOrganizationId: organizationId,
    lettaAgentsId,
    permissions,
  } = await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.UPDATE_AB_TESTS)) {
    return {
      status: 403,
      body: null,
    };
  }

  // Verify AB test exists and belongs to the organization
  const existingAbTest = await db.query.abTests.findFirst({
    where: and(
      eq(abTests.id, abTestId),
      eq(abTests.organizationId, organizationId),
    ),
  });

  if (!existingAbTest) {
    return {
      status: 404,
      body: {
        message: 'AB test not found',
      },
    };
  }

  // Verify the template is attached to the AB test
  const existingTemplate = await db.query.abTestAgentTemplates.findFirst({
    where: and(
      eq(abTestAgentTemplates.abTestId, abTestId),
      eq(abTestAgentTemplates.id, attachedTemplateId),
    ),
  });

  if (!existingTemplate) {
    return {
      status: 404,
      body: {
        message: 'Template not found in this AB test',
      },
    };
  }

  // delete simulated agent
  try {
    await AgentsService.deleteAgent(
      {
        agentId: existingTemplate.simulatedAgentId,
      },
      {
        user_id: lettaAgentsId,
      },
    );
  } catch (e) {
    Sentry.captureException(e);
  }

  // Detach the template
  await db
    .delete(abTestAgentTemplates)
    .where(
      and(
        eq(abTestAgentTemplates.abTestId, abTestId),
        eq(abTestAgentTemplates.id, attachedTemplateId),
      ),
    );

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}
