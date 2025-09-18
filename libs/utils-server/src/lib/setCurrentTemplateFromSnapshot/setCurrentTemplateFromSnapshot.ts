import { db, lettaTemplates, blockTemplate, agentTemplateV2, agentTemplateBlockTemplates } from '@letta-cloud/service-database';
import { and, eq } from 'drizzle-orm';
import type { TemplateSnapshotSchemaType } from '@letta-cloud/utils-shared';

export const SET_CURRENT_TEMPLATE_FROM_SNAPSHOT_ERRORS = {
  TEMPLATE_NOT_FOUND: 'Template not found',
  NOT_CURRENT_VERSION: 'Only the :current version can be updated from snapshot',
  INVALID_SNAPSHOT: 'Invalid template snapshot format',
  AGENT_IS_MANAGER_DELETE_FORBIDDEN: 'Cannot delete agent that is a manager of the group',
};

interface SetCurrentTemplateFromSnapshotOptions {
  projectId: string;
  templateName: string;
  organizationId: string;
  snapshot: TemplateSnapshotSchemaType;
}

export async function setCurrentTemplateFromSnapshot(
  options: SetCurrentTemplateFromSnapshotOptions,
): Promise<{ success: boolean; message?: string }> {
  const { projectId, templateName, organizationId, snapshot } = options;

  // Validate snapshot structure
  if (!snapshot || !snapshot.agents || !snapshot.blocks) {
    throw new Error(SET_CURRENT_TEMPLATE_FROM_SNAPSHOT_ERRORS.INVALID_SNAPSHOT);
  }

  // Find the current template
  const currentTemplate = await db.query.lettaTemplates.findFirst({
    where: and(
      eq(lettaTemplates.name, templateName),
      eq(lettaTemplates.projectId, projectId),
      eq(lettaTemplates.organizationId, organizationId),
      eq(lettaTemplates.version, 'current'),
    ),
  });

  if (!currentTemplate) {
    throw new Error(SET_CURRENT_TEMPLATE_FROM_SNAPSHOT_ERRORS.TEMPLATE_NOT_FOUND);
  }

  const templateId = currentTemplate.id;

  await db.transaction(async (tx) => {
    // 1. Get existing entities to preserve what's possible based on entityId
    const existingBlocks = await tx.query.blockTemplate.findMany({
      where: eq(blockTemplate.lettaTemplateId, templateId),
    });
    const existingAgents = await tx.query.agentTemplateV2.findMany({
      where: eq(agentTemplateV2.lettaTemplateId, templateId),
    });

    // 5. Handle agents - preserve by entityId, delete others, insert new ones
    const snapshotAgentEntityIds = new Set(snapshot.agents.map((a) => a.entityId));

    // Delete agents that are no longer in snapshot
    const agentsToDelete = existingAgents.filter(a => !snapshotAgentEntityIds.has(a.entityId));


    const groupManagerEntityId = currentTemplate.groupConfiguration?.managerAgentEntityId;

    if (groupManagerEntityId) {
      const isInAgentsToDelete = agentsToDelete.some(agent => agent.entityId === groupManagerEntityId);
      if (isInAgentsToDelete) {
        throw new Error(SET_CURRENT_TEMPLATE_FROM_SNAPSHOT_ERRORS.AGENT_IS_MANAGER_DELETE_FORBIDDEN);
      }
    }


    // 2. Delete associations first
    await tx.delete(agentTemplateBlockTemplates).where(eq(agentTemplateBlockTemplates.lettaTemplateId, templateId));

    // 3. Update template metadata
    await tx
      .update(lettaTemplates)
      .set({
        type: snapshot.type,
        groupConfiguration: snapshot.configuration || null,
      })
      .where(eq(lettaTemplates.id, templateId));

    // 4. Handle blocks - preserve by entityId
    const snapshotBlockEntityIds = new Set(snapshot.blocks.map((b) => b.entityId));

    // Delete blocks that are no longer in snapshot
    const blocksToDelete = existingBlocks.filter(b => !snapshotBlockEntityIds.has(b.entityId));
    if (blocksToDelete.length > 0) {
      for (const block of blocksToDelete) {
        await tx.delete(blockTemplate).where(eq(blockTemplate.id, block.id));
      }
    }

    // Update or insert blocks
    for (const snapshotBlock of snapshot.blocks) {
      const existingBlock = existingBlocks.find(b => b.entityId === snapshotBlock.entityId);

      if (existingBlock) {
        // Update existing block
        await tx
          .update(blockTemplate)
          .set({
            value: snapshotBlock.value,
            limit: snapshotBlock.limit || 1000,
            description: snapshotBlock.description || '',
            preserveOnMigration: snapshotBlock.preserveOnMigration || false,
            readOnly: snapshotBlock.readOnly || false,
          })
          .where(eq(blockTemplate.id, existingBlock.id));
      } else {
        // Insert new block
        await tx.insert(blockTemplate).values({
          lettaTemplateId: templateId,
          organizationId,
          projectId,
          entityId: snapshotBlock.entityId,
          value: snapshotBlock.value,
          limit: snapshotBlock.limit || 1000,
          label: snapshotBlock.label,
          description: snapshotBlock.description || '',
          preserveOnMigration: snapshotBlock.preserveOnMigration || false,
          readOnly: snapshotBlock.readOnly || false,
        });
      }
    }


    if (agentsToDelete.length > 0) {
      for (const agent of agentsToDelete) {
        await tx.delete(agentTemplateV2).where(eq(agentTemplateV2.id, agent.id));
      }
    }


    // Update or insert agents
    for (const snapshotAgent of snapshot.agents) {
      const existingAgent = existingAgents.find(a => a.entityId === snapshotAgent.entityId);

      if (existingAgent) {
        // Update existing agent
        await tx
          .update(agentTemplateV2)
          .set({
            name: snapshotAgent.name,
            systemPrompt: snapshotAgent.systemPrompt,
            toolIds: snapshotAgent.toolIds || [],
            toolRules: snapshotAgent.toolRules || [],
            sourceIds: snapshotAgent.sourceIds || [],
            identityIds: snapshotAgent.identityIds || [],
            tags: snapshotAgent.tags || [],
            model: snapshotAgent.model,
            agentType: snapshotAgent.agentType,
            properties: snapshotAgent.properties,
            memoryVariables: snapshotAgent.memoryVariables,
            toolVariables: snapshotAgent.toolVariables,
          })
          .where(eq(agentTemplateV2.id, existingAgent.id));
      } else {
        // Insert new agent
        await tx.insert(agentTemplateV2).values({
          lettaTemplateId: templateId,
          organizationId,
          projectId,
          entityId: snapshotAgent.entityId,
          name: snapshotAgent.name,
          systemPrompt: snapshotAgent.systemPrompt,
          toolIds: snapshotAgent.toolIds || [],
          toolRules: snapshotAgent.toolRules || [],
          sourceIds: snapshotAgent.sourceIds || [],
          identityIds: snapshotAgent.identityIds || [],
          tags: snapshotAgent.tags || [],
          model: snapshotAgent.model,
          agentType: snapshotAgent.agentType,
          properties: snapshotAgent.properties,
          memoryVariables: snapshotAgent.memoryVariables,
          toolVariables: snapshotAgent.toolVariables,
        });
      }
    }

    // 6. Create agent-block associations from snapshot relationships
    if (snapshot.relationships && snapshot.relationships.length > 0) {
      // Get the actual record IDs for the relationships
      const agentEntityIdToId = new Map(existingAgents.map(a => [a.entityId, a.id]));
      const blockEntityIdToId = new Map(existingBlocks.map(b => [b.entityId, b.id]));

      // Also include newly created entities
      const newAgents = await tx.query.agentTemplateV2.findMany({
        where: eq(agentTemplateV2.lettaTemplateId, templateId),
      });
      const newBlocks = await tx.query.blockTemplate.findMany({
        where: eq(blockTemplate.lettaTemplateId, templateId),
      });

      // Update maps with all current entities
      newAgents.forEach(a => agentEntityIdToId.set(a.entityId, a.id));
      newBlocks.forEach(b => blockEntityIdToId.set(b.entityId, b.id));

      const relationshipsToCreate = snapshot.relationships
        .map(rel => {
          const agentId = agentEntityIdToId.get(rel.agentEntityId);
          const blockId = blockEntityIdToId.get(rel.blockEntityId);
          const block = newBlocks.find(b => b.id === blockId);

          if (agentId && blockId && block) {
            return {
              lettaTemplateId: templateId,
              agentTemplateSchemaId: agentId,
              blockTemplateId: blockId,
              blockLabel: block.label,
            };
          }
          return null;
        })
        .filter(Boolean) as Array<{
          lettaTemplateId: string;
          agentTemplateSchemaId: string;
          blockTemplateId: string;
          blockLabel: string;
        }>;

      if (relationshipsToCreate.length > 0) {
        await tx.insert(agentTemplateBlockTemplates).values(relationshipsToCreate)
          .onConflictDoNothing(); // Avoid duplicates
      }
    }
  });

  return {
    success: true,
    message: 'Current template updated from snapshot successfully',
  };
}
