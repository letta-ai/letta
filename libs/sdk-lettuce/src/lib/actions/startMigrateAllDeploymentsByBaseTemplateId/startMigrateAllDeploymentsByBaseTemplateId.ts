import { getTemporalClient } from '../../../index';
import { TASK_QUEUE_NAME } from '../../config';
import type { MigrateAllDeploymentsByBaseTemplateIdPayload } from '../../types';
import { randomUUID } from 'node:crypto';

export async function startMigrateAllDeploymentsByBaseTemplateId(
  payload: MigrateAllDeploymentsByBaseTemplateIdPayload,
) {
  const sessionId = randomUUID();

  const handle = await getTemporalClient().workflow.start('migrateAllDeploymentsByBaseTemplateIdWorkflow', {
    taskQueue: TASK_QUEUE_NAME,
    args: [payload],
    workflowId: 'migrate-all-deployments-by-template-' + sessionId,
    searchAttributes: {
      Id: [payload.baseTemplateId],
      OrganizationId: [payload.organizationId],
    },
    memo: {
      baseTemplateId: payload.baseTemplateId,
      organizationId: payload.organizationId,
    },
  });

  return {
    workflowId: handle.workflowId,
    runId: handle.firstExecutionRunId,
  };
}
