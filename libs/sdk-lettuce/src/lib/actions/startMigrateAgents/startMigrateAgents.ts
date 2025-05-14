import { getTemporalClient } from '../../../index';
import { TASK_QUEUE_NAME } from '../../config';
import type { MigrateAgentsPayload } from '../../types';
import { randomUUID } from 'node:crypto';

export async function startMigrateAgents(payload: MigrateAgentsPayload) {
  const sessionId = randomUUID();
  const baseTemplateName = payload.template.split(':')[0];
  await getTemporalClient().workflow.start('migrateAgentsWorkflow', {
    taskQueue: TASK_QUEUE_NAME,
    args: [payload],
    workflowId: 'migrate-agents-workflow-' + sessionId,
    searchAttributes: {
      Id: [baseTemplateName],
      OrganizationId: [payload.organizationId],
    },
    memo: {
      templateVersion: payload.template,
    },
  });
}
