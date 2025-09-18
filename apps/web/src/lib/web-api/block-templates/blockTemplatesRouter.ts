import {
  db,
  blockTemplate,
  projects,
  agentTemplates,
  agentTemplateBlockTemplates,
  agentTemplateV2,
} from '@letta-cloud/service-database';
import { getUserWithActiveOrganizationIdOrThrow } from '$web/server/auth';
import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '../contracts';
import { and, eq, ilike } from 'drizzle-orm';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { nanoid } from 'nanoid';

type CreateBlockTemplateRequest = ServerInferRequest<
  typeof contracts.blockTemplates.createBlockTemplate
>;
type CreateBlockTemplateResponse = ServerInferResponses<
  typeof contracts.blockTemplates.createBlockTemplate
>;

export async function createBlockTemplate(
  req: CreateBlockTemplateRequest,
): Promise<CreateBlockTemplateResponse> {
  const {
    label,
    value,
    limit,
    description,
    preserveOnMigration,
    readOnly,
    lettaTemplateId,
    projectId,
  } = req.body;

  const { activeOrganizationId: organizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.CREATE_BLOCK_TEMPLATES)) {
    return {
      status: 403,
      body: null,
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

  const [output] = await db
    .insert(blockTemplate)
    .values({
      entityId: nanoid(8),
      label,
      lettaTemplateId,
      value,
      limit,
      description,
      preserveOnMigration,
      readOnly,
      projectId,
      organizationId,
    })
    .returning();

  return {
    status: 201,
    body: {
      id: output.id,
      entityId: output.entityId,
      label: output.label,
      value: output.value,
      limit: output.limit,
      description: output.description,
      preserveOnMigration: output.preserveOnMigration,
      readOnly: output.readOnly,
      createdAt: output.createdAt.toISOString(),
      updatedAt: output.updatedAt.toISOString(),
    },
  };
}

type UpdateBlockTemplateRequest = ServerInferRequest<
  typeof contracts.blockTemplates.updateBlockTemplate
>;
type UpdateBlockTemplateResponse = ServerInferResponses<
  typeof contracts.blockTemplates.updateBlockTemplate
>;

export async function updateBlockTemplate(
  req: UpdateBlockTemplateRequest,
): Promise<UpdateBlockTemplateResponse> {
  const { blockTemplateId } = req.params;
  const { value, limit, description, preserveOnMigration, readOnly } = req.body;

  const { activeOrganizationId: organizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.UPDATE_BLOCK_TEMPLATES)) {
    return {
      status: 403,
      body: null,
    };
  }

  // Verify block template exists and belongs to the organization
  const existingBlockTemplate = await db.query.blockTemplate.findFirst({
    where: and(
      eq(blockTemplate.id, blockTemplateId),
      eq(blockTemplate.organizationId, organizationId),
    ),
  });

  if (!existingBlockTemplate) {
    return {
      status: 404,
      body: {
        message: 'Block template not found',
      },
    };
  }

  const updateData: Partial<typeof blockTemplate.$inferInsert> = {};
  if (typeof value === 'string') {
    updateData.value = value;
  }
  if (typeof limit === 'number') {
    updateData.limit = limit;
  }
  if (typeof description === 'string') {
    updateData.description = description;
  }

  if (typeof preserveOnMigration === 'boolean') {
    updateData.preserveOnMigration = preserveOnMigration;
  }
  if (typeof readOnly === 'boolean') {
    updateData.readOnly = readOnly;
  }

  const [updatedBlockTemplate] = await db
    .update(blockTemplate)
    .set(updateData)
    .where(
      and(
        eq(blockTemplate.id, blockTemplateId),
        eq(blockTemplate.organizationId, organizationId),
      ),
    )
    .returning();

  return {
    status: 200,
    body: {
      id: updatedBlockTemplate.id,
      label: updatedBlockTemplate.label,
      value: updatedBlockTemplate.value,
      limit: updatedBlockTemplate.limit,
      description: updatedBlockTemplate.description,
      entityId: updatedBlockTemplate.entityId,
      preserveOnMigration: updatedBlockTemplate.preserveOnMigration,
      readOnly: updatedBlockTemplate.readOnly,
      createdAt: updatedBlockTemplate.createdAt.toISOString(),
      updatedAt: updatedBlockTemplate.updatedAt.toISOString(),
    },
  };
}

type GetBlockTemplatesRequest = ServerInferRequest<
  typeof contracts.blockTemplates.getBlockTemplates
>;
type GetBlockTemplatesResponse = ServerInferResponses<
  typeof contracts.blockTemplates.getBlockTemplates
>;

export async function getBlockTemplates(
  req: GetBlockTemplatesRequest,
): Promise<GetBlockTemplatesResponse> {
  const { activeOrganizationId: organizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.READ_BLOCK_TEMPLATES)) {
    return {
      status: 403,
      body: null,
    };
  }

  const { offset, limit = 10, search, projectId } = req.query;

  const where = [eq(blockTemplate.organizationId, organizationId)];

  if (projectId) {
    where.push(eq(blockTemplate.projectId, projectId));
  }

  if (search) {
    where.push(ilike(blockTemplate.label, `%${search}%`));
  }

  const blockTemplateResults = await db.query.blockTemplate.findMany({
    where: and(...where),
    offset,
    limit: limit + 1,
    orderBy: (blockTemplateSchema, { desc }) => [
      desc(blockTemplateSchema.createdAt),
    ],
  });

  return {
    status: 200,
    body: {
      blockTemplates: blockTemplateResults
        .slice(0, limit)
        .map((blockTemplate) => ({
          id: blockTemplate.id,
          label: blockTemplate.label,
          value: blockTemplate.value,
          limit: blockTemplate.limit,
          entityId: blockTemplate.entityId,
          description: blockTemplate.description,
          preserveOnMigration: blockTemplate.preserveOnMigration,
          readOnly: blockTemplate.readOnly,
          createdAt: blockTemplate.createdAt.toISOString(),
          updatedAt: blockTemplate.updatedAt.toISOString(),
        })),
      hasNextPage: blockTemplateResults.length > limit,
    },
  };
}

type GetBlockTemplateRequest = ServerInferRequest<
  typeof contracts.blockTemplates.getBlockTemplate
>;
type GetBlockTemplateResponse = ServerInferResponses<
  typeof contracts.blockTemplates.getBlockTemplate
>;

export async function getBlockTemplate(
  req: GetBlockTemplateRequest,
): Promise<GetBlockTemplateResponse> {
  const { blockTemplateId } = req.params;

  const { activeOrganizationId: organizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.READ_BLOCK_TEMPLATES)) {
    return {
      status: 403,
      body: null,
    };
  }

  const output = await db.query.blockTemplate.findFirst({
    where: and(
      eq(blockTemplate.id, blockTemplateId),
      eq(blockTemplate.organizationId, organizationId),
    ),
  });

  if (!output) {
    return {
      status: 404,
      body: {
        message: 'Block template not found',
      },
    };
  }

  return {
    status: 200,
    body: {
      id: output.id,
      label: output.label,
      value: output.value,
      limit: output.limit,
      description: output.description,
      entityId: output.entityId,
      preserveOnMigration: output.preserveOnMigration,
      readOnly: output.readOnly,
      createdAt: output.createdAt.toISOString(),
      updatedAt: output.updatedAt.toISOString(),
    },
  };
}

type DeleteBlockTemplateRequest = ServerInferRequest<
  typeof contracts.blockTemplates.deleteBlockTemplate
>;
type DeleteBlockTemplateResponse = ServerInferResponses<
  typeof contracts.blockTemplates.deleteBlockTemplate
>;

export async function deleteBlockTemplate(
  req: DeleteBlockTemplateRequest,
): Promise<DeleteBlockTemplateResponse> {
  const { blockTemplateId } = req.params;

  const { activeOrganizationId: organizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.DELETE_BLOCK_TEMPLATES)) {
    return {
      status: 403,
      body: null,
    };
  }

  // Verify block template exists and belongs to the organization
  const existingBlockTemplate = await db.query.blockTemplate.findFirst({
    where: and(
      eq(blockTemplate.id, blockTemplateId),
      eq(blockTemplate.organizationId, organizationId),
    ),
  });

  if (!existingBlockTemplate) {
    return {
      status: 404,
      body: {
        message: 'Block template not found',
      },
    };
  }

  await db
    .delete(blockTemplate)
    .where(
      and(
        eq(blockTemplate.id, blockTemplateId),
        eq(blockTemplate.organizationId, organizationId),
      ),
    );

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

type AttachBlockToAgentTemplateRequest = ServerInferRequest<
  typeof contracts.blockTemplates.attachBlockToAgentTemplate
>;
type AttachBlockToAgentTemplateResponse = ServerInferResponses<
  typeof contracts.blockTemplates.attachBlockToAgentTemplate
>;

export async function attachBlockToAgentTemplate(
  req: AttachBlockToAgentTemplateRequest,
): Promise<AttachBlockToAgentTemplateResponse> {
  const { agentTemplateId, blockTemplateId } = req.params;

  const { activeOrganizationId: organizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.CREATE_UPDATE_DELETE_TEMPLATES)) {
    return {
      status: 403,
      body: null,
    };
  }

  // Verify agent template exists and belongs to the organization
  const agentTemplate = await db.query.agentTemplateV2.findFirst({
    where: and(
      eq(agentTemplateV2.id, agentTemplateId),
      eq(agentTemplateV2.organizationId, organizationId),
    ),
  });

  if (!agentTemplate) {
    return {
      status: 404,
      body: {
        message: 'Agent template not found',
      },
    };
  }

  // Verify block template exists and belongs to the same organization
  const output = await db.query.blockTemplate.findFirst({
    where: and(
      eq(blockTemplate.id, blockTemplateId),
      eq(blockTemplate.organizationId, organizationId),
    ),
  });

  if (!output) {
    return {
      status: 404,
      body: {
        message: 'Block template not found',
      },
    };
  }

  // Check if association already exists
  const existingAssociation =
    await db.query.agentTemplateBlockTemplates.findFirst({
      where: and(
        eq(agentTemplateBlockTemplates.agentTemplateSchemaId, agentTemplate.id),
        eq(agentTemplateBlockTemplates.blockTemplateId, blockTemplateId),
      ),
    });

  if (existingAssociation) {
    return {
      status: 400,
      body: {
        message: 'Block template is already attached to this agent template',
        errorCode: 'conflict',
      },
    };
  }

  // Create the association
  await db.insert(agentTemplateBlockTemplates).values({
    agentTemplateSchemaId: agentTemplate.id,
    blockTemplateId,
    lettaTemplateId: agentTemplate.lettaTemplateId,
    blockLabel: output.label,
  });

  return {
    status: 201,
    body: {
      success: true,
      message: 'Block template successfully attached to agent template',
    },
  };
}

type DetachBlockFromAgentTemplateRequest = ServerInferRequest<
  typeof contracts.blockTemplates.detachBlockFromAgentTemplate
>;
type DetachBlockFromAgentTemplateResponse = ServerInferResponses<
  typeof contracts.blockTemplates.detachBlockFromAgentTemplate
>;

export async function detachBlockFromAgentTemplate(
  req: DetachBlockFromAgentTemplateRequest,
): Promise<DetachBlockFromAgentTemplateResponse> {
  const { agentTemplateId, blockTemplateId } = req.params;

  const { activeOrganizationId: organizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.CREATE_UPDATE_DELETE_TEMPLATES)) {
    return {
      status: 403,
      body: null,
    };
  }

  // Verify agent template exists and belongs to the organization
  const agentTemplate = await db.query.agentTemplateV2.findFirst({
    where: and(
      eq(agentTemplateV2.id, agentTemplateId),
      eq(agentTemplateV2.organizationId, organizationId),
    ),
  });

  if (!agentTemplate) {
    return {
      status: 404,
      body: {
        message: 'Agent template not found',
      },
    };
  }

  // Check if association exists
  const existingAssociation =
    await db.query.agentTemplateBlockTemplates.findFirst({
      where: and(
        eq(agentTemplateBlockTemplates.agentTemplateSchemaId, agentTemplate.id),
        eq(agentTemplateBlockTemplates.blockTemplateId, blockTemplateId),
      ),
    });

  if (!existingAssociation) {
    return {
      status: 404,
      body: {
        message: 'Block template is not attached to this agent template',
      },
    };
  }

  // Delete the association
  await db
    .delete(agentTemplateBlockTemplates)
    .where(
      and(
        eq(agentTemplateBlockTemplates.agentTemplateSchemaId, agentTemplate.id),
        eq(agentTemplateBlockTemplates.blockTemplateId, blockTemplateId),
      ),
    );

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

type GetAgentTemplateBlockTemplatesRequest = ServerInferRequest<
  typeof contracts.blockTemplates.getAgentTemplateBlockTemplates
>;
type GetAgentTemplateBlockTemplatesResponse = ServerInferResponses<
  typeof contracts.blockTemplates.getAgentTemplateBlockTemplates
>;

export async function getAgentTemplateBlockTemplates(
  req: GetAgentTemplateBlockTemplatesRequest,
): Promise<GetAgentTemplateBlockTemplatesResponse> {
  const { agentTemplateId } = req.params;

  const { activeOrganizationId: organizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.READ_BLOCK_TEMPLATES)) {
    return {
      status: 403,
      body: null,
    };
  }

  // Verify agent template exists and belongs to the organization
  const agentTemplate = await db.query.agentTemplateV2.findFirst({
    where: and(
      eq(agentTemplates.id, agentTemplateId),
      eq(agentTemplates.organizationId, organizationId),
    ),
  });

  if (!agentTemplate) {
    return {
      status: 404,
      body: {
        message: 'Agent template not found',
      },
    };
  }

  // Get the current agent template schema
  const currentSchema = await db.query.agentTemplateV2.findFirst({
    where: and(eq(agentTemplateV2.id, agentTemplateId)),
    orderBy: (schema, { desc }) => [desc(schema.createdAt)],
  });

  if (!currentSchema) {
    return {
      status: 404,
      body: {
        message: 'Agent template schema not found',
      },
    };
  }

  // Get associated block templates
  const blockTemplates = await db
    .select({
      id: blockTemplate.id,
      label: blockTemplate.label,
      value: blockTemplate.value,
      limit: blockTemplate.limit,
      description: blockTemplate.description,
      preserveOnMigration: blockTemplate.preserveOnMigration,
      readOnly: blockTemplate.readOnly,
      createdAt: blockTemplate.createdAt,
      updatedAt: blockTemplate.updatedAt,
      entityId: blockTemplate.entityId,
    })
    .from(agentTemplateBlockTemplates)
    .innerJoin(
      blockTemplate,
      eq(agentTemplateBlockTemplates.blockTemplateId, blockTemplate.id),
    )
    .where(
      and(
        eq(agentTemplateBlockTemplates.agentTemplateSchemaId, currentSchema.id),
        eq(blockTemplate.organizationId, organizationId),
      ),
    )
    .orderBy(blockTemplate.createdAt);

  return {
    status: 200,
    body: {
      blockTemplates: blockTemplates.map((blockTemplate) => ({
        id: blockTemplate.id,
        label: blockTemplate.label,
        value: blockTemplate.value,
        limit: blockTemplate.limit,
        entityId: blockTemplate.entityId,
        description: blockTemplate.description,
        preserveOnMigration: blockTemplate.preserveOnMigration,
        readOnly: blockTemplate.readOnly,
        createdAt: blockTemplate.createdAt.toISOString(),
        updatedAt: blockTemplate.updatedAt.toISOString(),
      })),
    },
  };
}

type CreateAndAttachBlockToAgentTemplateRequest = ServerInferRequest<
  typeof contracts.blockTemplates.createAndAttachBlockToAgentTemplate
>;
type CreateAndAttachBlockToAgentTemplateResponse = ServerInferResponses<
  typeof contracts.blockTemplates.createAndAttachBlockToAgentTemplate
>;

export async function createAndAttachBlockToAgentTemplate(
  req: CreateAndAttachBlockToAgentTemplateRequest,
): Promise<CreateAndAttachBlockToAgentTemplateResponse> {
  const { agentTemplateId } = req.params;
  const {
    label,
    value,
    limit,
    description,
    preserveOnMigration,
    readOnly,
    lettaTemplateId,
    projectId,
  } = req.body;

  const { activeOrganizationId: organizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.CREATE_BLOCK_TEMPLATES)) {
    return {
      status: 403,
      body: null,
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

  // Verify agent template exists and belongs to the organization
  const agentTemplate = await db.query.agentTemplateV2.findFirst({
    where: and(
      eq(agentTemplateV2.id, agentTemplateId),
      eq(agentTemplateV2.organizationId, organizationId),
    ),
  });

  if (!agentTemplate) {
    return {
      status: 404,
      body: {
        message: 'Agent template not found',
      },
    };
  }

  // Use a transaction to ensure both operations succeed or fail together
  const result = await db.transaction(async (tx) => {
    // Create the block template
    const [createdBlockTemplate] = await tx
      .insert(blockTemplate)
      .values({
        entityId: nanoid(8),
        label,
        lettaTemplateId,
        value,
        limit,
        description,
        preserveOnMigration,
        readOnly,
        projectId,
        organizationId,
      })
      .returning();

    // Check if association already exists
    const existingAssociation =
      await tx.query.agentTemplateBlockTemplates.findFirst({
        where: and(
          eq(
            agentTemplateBlockTemplates.agentTemplateSchemaId,
            agentTemplate.id,
          ),
          eq(
            agentTemplateBlockTemplates.blockTemplateId,
            createdBlockTemplate.id,
          ),
        ),
      });

    if (existingAssociation) {
      // This shouldn't happen with a fresh block, but check just in case
      throw new Error(
        'Block template is already attached to this agent template',
      );
    }

    // Create the association
    await tx.insert(agentTemplateBlockTemplates).values({
      agentTemplateSchemaId: agentTemplate.id,
      blockTemplateId: createdBlockTemplate.id,
      lettaTemplateId: agentTemplate.lettaTemplateId,
      blockLabel: createdBlockTemplate.label,
    });

    return createdBlockTemplate;
  });

  return {
    status: 201,
    body: {
      blockTemplate: {
        id: result.id,
        label: result.label,
        value: result.value,
        limit: result.limit,
        description: result.description,
        entityId: result.entityId,
        preserveOnMigration: result.preserveOnMigration,
        readOnly: result.readOnly,
        createdAt: result.createdAt.toISOString(),
        updatedAt: result.updatedAt.toISOString(),
      },
      success: true,
      message: 'Block template created and attached successfully',
    },
  };
}
