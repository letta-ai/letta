import { getTemporalClient } from '../../../index';
import { TASK_QUEUE_NAME } from '../../config';
import type { MigrateAgentPayload } from '../../types';
import { randomUUID } from 'node:crypto';

export async function startMigrateAgent(payload: MigrateAgentPayload) {
  const sessionId = randomUUID();
  const baseTemplateName = payload.template.split(':')[0];

  const handle = await getTemporalClient().workflow.start(
    'migrateAgentWorkflow',
    {
      taskQueue: TASK_QUEUE_NAME,
      args: [payload],
      workflowId: 'migrate-agent-workflow-' + payload.agentId + '-' + sessionId,
    },
  );

  return handle.result();
}
