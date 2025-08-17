import { getTemporalClient } from '../../../index';
import { TASK_QUEUE_NAME } from '../../config';
import type { MigrateSingleAgentPayload } from '../../types';
import { randomUUID } from 'node:crypto';

export async function startMigrateSingleAgent(
  payload: MigrateSingleAgentPayload,
) {
  const sessionId = randomUUID();

  const [_project, template] = payload.versionString.split('/');
  const baseName = template.split(':')[0];

  const handle = await getTemporalClient().workflow.start(
    'migrateSingleAgentWorkflow',
    {
      taskQueue: TASK_QUEUE_NAME,
      args: [payload],
      workflowId:
        'migrate-single-agent-workflow-' + payload.agentId + '-' + sessionId,
      searchAttributes: {
        Id: [baseName],
        AgentId: [payload.agentId],
        OrganizationId: [payload.organizationId],
      },
      memo: {
        templateVersion: template,
        agentId: payload.agentId,
      },
    },
  );

  return handle.result();
}
