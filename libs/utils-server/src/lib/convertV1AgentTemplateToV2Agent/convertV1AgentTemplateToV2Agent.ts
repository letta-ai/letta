import {
  deployedAgentTemplates,
  type TxType,
} from '@letta-cloud/service-database';
import {
  agentTemplates,
  agentTemplateV2,
  db,
} from '@letta-cloud/service-database';
import { and, eq } from 'drizzle-orm';
import { AgentsService } from '@letta-cloud/sdk-core';
import { createTemplateEntitiesFromAgentState } from '../createTemplateEntitiesFromAgentState/createTemplateEntitiesFromAgentState';

interface HandleMigrationFromOldTemplatesOptions {
  agentTemplateId: string;
  organizationId: string;
  lettaAgentsId: string;
  projectId: string;
  lettaTemplateId: string;
  tx?: TxType;
}

async function handleMigrationFromOldTemplates(
  options: HandleMigrationFromOldTemplatesOptions,
) {
  const {
    agentTemplateId,
    projectId,
    lettaTemplateId,
    organizationId,
    lettaAgentsId,
    tx,
  } = options;

  const agentState = await AgentsService.retrieveAgent(
    {
      agentId: agentTemplateId,
    },
    {
      user_id: lettaAgentsId,
    },
  );

  await createTemplateEntitiesFromAgentState({
    agentState,
    organizationId,
    lettaTemplateId,
    projectId,
    override_agentTemplateId: agentTemplateId,
    tx,
  });
}

interface ConvertV1AgentTemplateToV2AgentPayload {
  agentTemplateId: string;
  organizationId: string;
  lettaAgentsId: string;
  projectId: string;
  tx?: TxType;
}

export async function convertV1AgentTemplateToV2Agent(
  payload: ConvertV1AgentTemplateToV2AgentPayload,
) {
  const { agentTemplateId, organizationId, lettaAgentsId, projectId, tx } =
    payload;

  if (!agentTemplateId.startsWith('agent')) {
    return;
  }

  async function executeWithTransaction(transaction: TxType) {
    const exitingV2Template = await transaction.query.agentTemplateV2.findFirst(
      {
        where: and(
          eq(agentTemplateV2.organizationId, organizationId),
          eq(agentTemplateV2.id, agentTemplateId),
        ),
      },
    );

    if (exitingV2Template) {
      return;
    }

    const [v1Template, v1DeployedTemplate] = await Promise.all([
      transaction.query.agentTemplates.findFirst({
        where: and(
          eq(agentTemplates.organizationId, organizationId),
          eq(agentTemplates.id, agentTemplateId),
        ),
      }),
      transaction.query.deployedAgentTemplates.findFirst({
        where: and(
          eq(deployedAgentTemplates.organizationId, organizationId),
          eq(deployedAgentTemplates.id, agentTemplateId),
        ),
      }),
    ]);

    if (!v1Template && !v1DeployedTemplate) {
      throw new Error('V1 template not found');
    }

    // get agent state
    const agentState = await AgentsService.retrieveAgent(
      {
        agentId: agentTemplateId,
      },
      {
        user_id: lettaAgentsId,
      },
    );

    if (!agentState) {
      throw new Error('Agent state not found');
    }

    // Handle migration from old templates
    await handleMigrationFromOldTemplates({
      agentTemplateId,
      organizationId,
      lettaAgentsId,
      projectId,
      lettaTemplateId: agentTemplateId,
      tx: transaction,
    });
  }

  // If a transaction is provided, use it; otherwise create a new one
  if (tx) {
    return executeWithTransaction(tx);
  } else {
    return db.transaction(executeWithTransaction);
  }
}
