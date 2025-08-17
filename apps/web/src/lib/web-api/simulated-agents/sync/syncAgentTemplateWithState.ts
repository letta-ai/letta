import {
  db,
  agentTemplateV2,
  blockTemplate,
  agentTemplateBlockTemplates,
} from '@letta-cloud/service-database';
import { and, eq } from 'drizzle-orm';
import type { AgentState } from '@letta-cloud/sdk-core';
import { synchronizeSimulatedAgentWithAgentTemplate } from '@letta-cloud/utils-shared';

export interface SyncAgentTemplateWithStateOptions {
  agentTemplateId: string;
  organizationId: string;
  agentState: AgentState;
  lettaAgentsId: string;
  projectId: string;
}

export async function syncAgentTemplateWithState({
  agentTemplateId,
  organizationId,
  agentState,
}: SyncAgentTemplateWithStateOptions) {
  // pull memory variables from agentTemplate blocks
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
    })
    .from(agentTemplateBlockTemplates)
    .innerJoin(
      blockTemplate,
      eq(agentTemplateBlockTemplates.blockTemplateId, blockTemplate.id),
    )
    .where(
      and(
        eq(agentTemplateBlockTemplates.agentTemplateSchemaId, agentTemplateId),
        eq(blockTemplate.organizationId, organizationId),
      ),
    )
    .orderBy(blockTemplate.createdAt);


  agentState.memory.blocks = blockTemplates;

  // Synchronize the agent state to template format
  const { agentTemplate } =
    synchronizeSimulatedAgentWithAgentTemplate(agentState);

  await db
    .update(agentTemplateV2)
    .set(agentTemplate)
    .where(
      and(
        eq(agentTemplateV2.organizationId, organizationId),
        eq(agentTemplateV2.id, agentTemplateId),
      ),
    )
    .returning();
}
