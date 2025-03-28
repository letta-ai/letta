import { getTemporalClient } from '../../../index';
import { nanoid } from 'nanoid';
import { TASK_QUEUE_NAME } from '../../config';
import { migrateAgentsWorkflow } from '../../workflows/migrateAgentsWorkflow/migrateAgentsWorkflow';
import type { MigrateAgentsPayload } from '../../types';

export async function startMigrateAgents(payload: MigrateAgentsPayload) {
  await getTemporalClient().workflow.start(migrateAgentsWorkflow, {
    taskQueue: TASK_QUEUE_NAME,
    args: [payload],
    workflowId: 'migrate-agents-workflow-' + nanoid(),
  });
}
