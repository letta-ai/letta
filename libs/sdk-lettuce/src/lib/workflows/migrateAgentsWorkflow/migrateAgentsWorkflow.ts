import {
  proxyActivities,
  isCancellation,
  startChild,
} from '@temporalio/workflow';
import type { activities } from '../../activities';
import type { MigrateAgentsPayload, MigrateAgentPayload } from '../../types';

const { getAgentsFromTemplate, getAgentsByIds } = proxyActivities<
  typeof activities
>({
  startToCloseTimeout: '1 hour',
  retry: {
    maximumAttempts: 5,
    initialInterval: '1 second',
    maximumInterval: '1 minute',
    backoffCoefficient: 2,
  },
});

export async function migrateAgentsWorkflow(
  payload: MigrateAgentsPayload,
): Promise<{ successful: number; failed: number; total: number }> {
  const {
    memoryVariables,
    agentIds: specificAgentIds,
    organizationId,
    template,
    preserveCoreMemories,
    preserveToolVariables,
    coreUserId,
  } = payload;

  try {
    // Get the list of agents to migrate
    const agents = specificAgentIds
      ? await getAgentsByIds(specificAgentIds)
      : await getAgentsFromTemplate(template, organizationId, coreUserId);

    if (agents.length === 0) {
      console.log('No agents found to migrate');
      return { successful: 0, failed: 0, total: 0 };
    }

    console.log(
      `Starting migration of ${agents.length} agents to template ${template}`,
    );

    // Start individual agent migration workflows
    const childWorkflowHandles = agents.map(async (agent, index) => {
      const agentPayload: MigrateAgentPayload = {
        memoryVariables: memoryVariables || agent.variables,
        preserveCoreMemories,
        preserveToolVariables,
        agentId: agent.agentId,
        template,
        coreUserId,
        organizationId,
      };

      try {
        const handle = await startChild('migrateAgentWorkflow', {
          args: [agentPayload],
          workflowId: `migrate-agent-${agent.agentId}-${Date.now()}-${index}`,
        });

        const result = await handle.result();
        return { agentId: agent.agentId, success: result };
      } catch (err) {
        console.error(`Failed to migrate agent ${agent.agentId}:`, err);
        return { agentId: agent.agentId, success: false, error: err };
      }
    });

    // Wait for all child workflows to complete
    const results = await Promise.allSettled(childWorkflowHandles);

    let successful = 0;
    let failed = 0;

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.success) {
        successful++;
      } else {
        failed++;
        if (result.status === 'rejected') {
          console.error('Child workflow failed:', result.reason);
        } else if (result.status === 'fulfilled' && !result.value.success) {
          console.error(
            `Agent migration failed for ${result.value.agentId}:`,
            (result.value as any).error,
          );
        }
      }
    }

    console.log(
      `Migration completed: ${successful} successful, ${failed} failed out of ${agents.length} total`,
    );

    return { successful, failed, total: agents.length };
  } catch (err) {
    if (isCancellation(err)) {
      console.warn('migrateAgentsWorkflow was canceled:', err);
    }
    throw err;
  }
}
