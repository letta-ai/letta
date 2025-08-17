import { updateAgentFromAgentTemplateId } from '@letta-cloud/utils-server';
import type { UpdateAgentFromAgentTemplateIdPayload } from '../../types';
import { db, deployedAgentVariables } from '@letta-cloud/service-database';
import { eq } from 'drizzle-orm';

export async function updateAgentFromAgentTemplateIdActivity(
  payload: UpdateAgentFromAgentTemplateIdPayload,
): Promise<boolean> {
  const {
    agentId,
    agentTemplateId,
    preserveToolVariables,
    preserveCoreMemories,
    organizationId,
    lettaAgentsId,
  } = payload;

  try {
    console.log(
      `Starting updateAgentFromAgentTemplateId for agent ${agentId} with template ${agentTemplateId}`
    );

    const deployedAgent = await db.query.deployedAgentVariables.findFirst({
      where: eq(deployedAgentVariables.deployedAgentId, agentId),
      columns: {
        value: true,
      }
    });

    await updateAgentFromAgentTemplateId({
      agentToUpdateId: agentId,
      agentTemplateId,
      memoryVariables: deployedAgent?.value || {},
      preserveCoreMemories,
      preserveToolVariables,
      lettaAgentsUserId: lettaAgentsId,
      organizationId,
    });

    console.log(
      `Successfully updated agent ${agentId} from template ${agentTemplateId}`
    );
    return true;
  } catch (error) {
    console.error(
      `Failed to update agent ${agentId} from template ${agentTemplateId}:`,
      error
    );
    throw error;
  }
}
