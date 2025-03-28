import { getTemporalClient } from '../../../index';
import { TASK_QUEUE_NAME } from '../../config';
import { migrateAgentsWorkflow } from '../../workflows/migrateAgentsWorkflow/migrateAgentsWorkflow';
import type { MigrateAgentsPayload } from '../../types';
import crypto from 'crypto';

export async function startMigrateAgents(payload: MigrateAgentsPayload) {
  const sessionId = crypto.randomUUID();

  await getTemporalClient().workflow.start(migrateAgentsWorkflow, {
    taskQueue: TASK_QUEUE_NAME,
    args: [payload],
    workflowId: 'migrate-agents-workflow-' + sessionId,
  });
}
