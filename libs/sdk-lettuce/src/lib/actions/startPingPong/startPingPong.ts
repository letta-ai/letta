import { getTemporalClient } from '../../../index';

import { TASK_QUEUE_NAME } from '../../config';
import * as crypto from 'crypto';

export async function startPingPong(name: string) {
  const sessionId = crypto.randomUUID();

  const handle = await getTemporalClient().workflow.start('ping', {
    taskQueue: TASK_QUEUE_NAME,
    args: [name],
    workflowId: 'ping-' + sessionId,
  });
  return handle.result();
}
