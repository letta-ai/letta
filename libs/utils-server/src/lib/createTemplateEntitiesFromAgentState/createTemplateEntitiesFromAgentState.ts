import type { TxType
} from '@letta-cloud/service-database';
import {
  agentTemplateBlockTemplates,
  agentTemplateV2,
  blockTemplate,
  db
} from '@letta-cloud/service-database';
import type { AgentStateForSynchronization} from '@letta-cloud/utils-shared';
import { synchronizeSimulatedAgentWithAgentTemplate } from '@letta-cloud/utils-shared';
import { nanoid } from 'nanoid';

interface CreateTemplateFromAgentStateProps {
  agentState: AgentStateForSynchronization;
  organizationId: string;
  lettaTemplateId: string;
  projectId: string;
  override_agentTemplateId?: string;
  tx?: TxType;
}

export async function createTemplateEntitiesFromAgentState(
  props: CreateTemplateFromAgentStateProps,
) {
  const {
    agentState,
    tx,
    override_agentTemplateId,
    projectId,
    organizationId,
    lettaTemplateId,
  } = props;

  async function executeWithTransaction(transaction: TxType) {
    // first check if agentTemplateSchema
    const { agentTemplate, agentTemplateBlocks } =
      synchronizeSimulatedAgentWithAgentTemplate(agentState);

    // If schema doesn't exist, create it, this is for seamlessly migrating to new schema format for templates
    const [res] = await transaction
      .insert(agentTemplateV2)
      .values({
        ...agentTemplate,
        entityId: nanoid(8),
        lettaTemplateId,
        ...(override_agentTemplateId ? { id: override_agentTemplateId } : {}),
        organizationId,
        projectId,
      })
      .returning();

    for (const newBlock of agentTemplateBlocks) {
      const upsertedBlockResult = await transaction
        .insert(blockTemplate)
        .values({
          entityId: nanoid(8),
          organizationId,
          value: newBlock.value,
          lettaTemplateId,
          label: newBlock.label,
          projectId,
          limit: newBlock.limit,
          description: newBlock.description,
          preserveOnMigration: newBlock.preserveOnMigration,
          readOnly: newBlock.readOnly,
        })
        .onConflictDoUpdate({
          target: [blockTemplate.id],
          set: {
            value: newBlock.value,
            limit: newBlock.limit,
            description: newBlock.description,
            preserveOnMigration: newBlock.preserveOnMigration,
            readOnly: newBlock.readOnly,
            updatedAt: new Date(),
          },
        })
        .returning({ id: blockTemplate.id });

      const actualBlockTemplateId = upsertedBlockResult[0].id;

      // Upsert the junction table association
      await transaction
        .insert(agentTemplateBlockTemplates)
        .values({
          lettaTemplateId,
          agentTemplateSchemaId: res.id,
          blockTemplateId: actualBlockTemplateId,
          blockLabel: newBlock.label, // Denormalized for unique constraint
        })
        .onConflictDoNothing(); // Don't error if association already exists
    }
  };

  // If a transaction is provided, use it; otherwise create a new one
  if (tx) {
    return executeWithTransaction(tx);
  } else {
    return db.transaction(executeWithTransaction);
  }
}
