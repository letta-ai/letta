import { getTemporalClient } from '../../../index';
import { TASK_QUEUE_NAME } from '../../config';
import type { MigrateBatchPayload } from '../../types';
import { randomUUID } from 'node:crypto';

export async function startMigrateBatch(payload: MigrateBatchPayload) {
  const sessionId = randomUUID();

  const [_project, template] = payload.versionString.split('/');
  const baseName = template.split(':')[0];

  const handle = await getTemporalClient().workflow.start(
    'migrateBatchWorkflow',
    {
      taskQueue: TASK_QUEUE_NAME,
      args: [payload],
      workflowId:
        'migrate-batch-workflow-' + payload.batchNumber + '-' + sessionId,
      searchAttributes: {
        Id: [baseName],
        BatchNumber: [payload.batchNumber.toString()],
        OrganizationId: [payload.organizationId],
      },
      memo: {
        templateVersion: template,
        batchNumber: payload.batchNumber.toString(),
        agentCount: payload.agents.length.toString(),
      },
    },
  );

  return handle.result();
}
