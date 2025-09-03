import type { TxType } from '@letta-cloud/service-database';
import {
  agentTemplateV2,
  blockTemplate,
  agentTemplateBlockTemplates,
} from '@letta-cloud/service-database';
import { eq } from 'drizzle-orm';

interface CopyTemplateEntitiesOptions {
  sourceTemplateId: string;
  targetTemplateId: string;
  tx: TxType;
}

export async function copyTemplateEntities(
  options: CopyTemplateEntitiesOptions,
) {
  const { sourceTemplateId, targetTemplateId, tx } = options;

  // 1. Get all agent templates for the source template
  const originalAgentTemplates = await tx
    .select()
    .from(agentTemplateV2)
    .where(eq(agentTemplateV2.lettaTemplateId, sourceTemplateId));

  // 2. Get all block templates for the source template
  const originalBlockTemplates = await tx
    .select()
    .from(blockTemplate)
    .where(eq(blockTemplate.lettaTemplateId, sourceTemplateId));

  // 3. Create new block templates and maintain ID mapping
  const newBlockTemplateMap = new Map<string, string>();

  for (const blockTemp of originalBlockTemplates) {
    const [newBlockTemplate] = await tx
      .insert(blockTemplate)
      .values({
        organizationId: blockTemp.organizationId,
        entityId: blockTemp.entityId,
        projectId: blockTemp.projectId,
        lettaTemplateId: targetTemplateId,
        value: blockTemp.value,
        label: blockTemp.label,
        limit: blockTemp.limit,
        description: blockTemp.description,
        preserveOnMigration: blockTemp.preserveOnMigration,
        readOnly: blockTemp.readOnly,
      })
      .returning();

    newBlockTemplateMap.set(blockTemp.id, newBlockTemplate.id);
  }

  // 4. Create new agent templates and their relationships
  for (const agentTemp of originalAgentTemplates) {
    const [newAgentTemplate] = await tx
      .insert(agentTemplateV2)
      .values({
        name: agentTemp.name,
        entityId: agentTemp.entityId,
        organizationId: agentTemp.organizationId,
        projectId: agentTemp.projectId,
        lettaTemplateId: targetTemplateId,
        memoryVariables: agentTemp.memoryVariables,
        toolVariables: agentTemp.toolVariables,
        tags: agentTemp.tags,
        identityIds: agentTemp.identityIds,
        systemPrompt: agentTemp.systemPrompt,
        agentType: agentTemp.agentType,
        toolIds: agentTemp.toolIds,
        toolRules: agentTemp.toolRules,
        sourceIds: agentTemp.sourceIds,
        model: agentTemp.model,
        properties: agentTemp.properties,
      })
      .returning();

    // 5. Copy agent-block relationships
    const agentBlockRelationships = await tx
      .select()
      .from(agentTemplateBlockTemplates)
      .where(
        eq(agentTemplateBlockTemplates.agentTemplateSchemaId, agentTemp.id),
      );

    for (const relationship of agentBlockRelationships) {
      const newBlockTemplateId = newBlockTemplateMap.get(
        relationship.blockTemplateId,
      );

      if (newBlockTemplateId) {
        await tx.insert(agentTemplateBlockTemplates).values({
          agentTemplateSchemaId: newAgentTemplate.id,
          blockTemplateId: newBlockTemplateId,
          lettaTemplateId: targetTemplateId,
          blockLabel: relationship.blockLabel,
        });
      }
    }
  }
}
