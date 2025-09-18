import type { TemplateSnapshotSchemaType } from '../../types';
import type {
  agentTemplateV2,
  blockTemplate,
  lettaTemplates,
  agentTemplateBlockTemplates,
} from '@letta-cloud/service-database';

type InferredTemplate = typeof lettaTemplates.$inferSelect;

interface TemplateType extends InferredTemplate {
  agentTemplates: Array<typeof agentTemplateV2.$inferSelect>;
  blockTemplates: Array<typeof blockTemplate.$inferSelect>;
  agentTemplateBlockTemplates: Array<typeof agentTemplateBlockTemplates.$inferSelect>;
}

export function generateTemplateSnapshot(
  template: TemplateType,
): TemplateSnapshotSchemaType {
  return {
    agents: template.agentTemplates.map((agent) => ({
      entityId: agent.entityId,
      name: agent.name,
      model: agent.model,
      systemPrompt: agent.systemPrompt,
      toolIds: agent.toolIds,
      sourceIds: agent.sourceIds,
      properties: agent.properties,
      toolVariables: agent.toolVariables,
      tags: agent.tags,
      identityIds: agent.identityIds,
      agentType: agent.agentType,
      toolRules: agent.toolRules,
      memoryVariables: agent.memoryVariables,
    })),
    blocks: template.blockTemplates.map((block) => ({
      entityId: block.entityId,
      label: block.label,
      value: block.value,
      limit: block.limit,
      description: block.description,
      preserveOnMigration: block.preserveOnMigration,
      readOnly: block.readOnly,
    })),
    relationships: template.agentTemplateBlockTemplates.map((relationship) => {
      const agent = template.agentTemplates.find(a => a.id === relationship.agentTemplateSchemaId);
      const block = template.blockTemplates.find(b => b.id === relationship.blockTemplateId);
      return {
        agentEntityId: agent?.entityId || '',
        blockEntityId: block?.entityId || '',
      };
    }).filter(r => r.agentEntityId && r.blockEntityId),
    configuration: template.groupConfiguration || {},
    type: template.type,
    version: template.version,
  };
}
