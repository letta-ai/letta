import { proxyActivities } from '@temporalio/workflow';
import type { activities } from '../../activities';
import type { MigrateAgentsPayload } from '../../types';

const { migrateAgents } = proxyActivities<typeof activities>({});

export async function migrateAgentsWorkflow(
  payload: MigrateAgentsPayload,
): Promise<void> {
  await migrateAgents(payload);
}
