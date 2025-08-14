import { proxyActivities, isCancellation } from '@temporalio/workflow';
import type { activities } from '../../activities';
import type { MigrateAgentPayload } from '../../types';

const { migrateAgent } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 hour',
  retry: {
    maximumAttempts: 5,
    initialInterval: '1 second',
    maximumInterval: '1 minute',
    backoffCoefficient: 2,
  },
});

export async function migrateAgentWorkflow(
  payload: MigrateAgentPayload,
): Promise<boolean> {
  try {
    const result = await migrateAgent(payload);
    return result;
  } catch (error) {
    if (isCancellation(error)) {
      console.warn(`migrateAgentWorkflow for agent ${payload.agentId} was canceled:`, error);
      // TODO: handle cleanup if needed
    }
    throw error;
  }
}
