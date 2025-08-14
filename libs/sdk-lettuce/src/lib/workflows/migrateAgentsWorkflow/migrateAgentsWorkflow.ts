import { proxyActivities, isCancellation } from '@temporalio/workflow';
import type { activities } from '../../activities';
import type { MigrateAgentsPayload } from '../../types';

const { migrateAgents } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 hour',
  retry: {
    maximumAttempts: 5,
  },
});

export async function migrateAgentsWorkflow(
  payload: MigrateAgentsPayload,
): Promise<void> {
  try {
    await migrateAgents(payload);
  } catch (error) {
    if (isCancellation(error)) {
      console.warn('migrateAgentsworkflow was canceled:', error);
      // TODO: handle cleanup - e.g. if some agents were migrated, we should revert them?
    }
    throw error;
  }
}
