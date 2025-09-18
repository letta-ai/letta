import { getTemporalClient } from '../../../index';
import { TASK_QUEUE_NAME } from '../../config';
import type { MigrateDeploymentEntitiesPayload } from '../../types';
import { randomUUID } from 'node:crypto';

export async function startMigrateDeploymentEntities(
  payload: MigrateDeploymentEntitiesPayload,
) {
  const sessionId = randomUUID();

  await getTemporalClient().workflow.start('migrateDeploymentEntitiesWorkflow', {
    taskQueue: TASK_QUEUE_NAME,
    args: [payload],
    workflowId: 'migrate-deployment-entities-workflow-' + sessionId,
    searchAttributes: {
      Id: [payload.deploymentId],
      OrganizationId: [payload.organizationId],
    },
    memo: {
      deploymentId: payload.deploymentId,
      templateId: payload.templateId,
    },
  });
}
