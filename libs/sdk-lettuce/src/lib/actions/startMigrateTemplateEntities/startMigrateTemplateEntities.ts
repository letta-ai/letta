import { getTemporalClient } from '../../../index';
import { TASK_QUEUE_NAME } from '../../config';
import type { MigrateTemplateEntitiesPayload } from '../../types';
import { randomUUID } from 'node:crypto';

export async function startMigrateTemplateEntities(
  payload: MigrateTemplateEntitiesPayload,
) {
  const sessionId = randomUUID();

  const [_project, template] = payload.versionString.split('/');
  const baseName = template.split(':')[0];

  await getTemporalClient().workflow.start('migrateTemplateEntitiesWorkflow', {
    taskQueue: TASK_QUEUE_NAME,
    args: [payload],
    workflowId: 'migrate-template-entities-workflow-' + sessionId,
    searchAttributes: {
      Id: [baseName],
      OrganizationId: [payload.organizationId],
    },
    memo: {
      templateVersion: template,
      batchSize: payload.batchSize?.toString() || '25',
    },
  });
}
