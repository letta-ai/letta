import { getTemporalClient } from '../../../index';
import { TASK_QUEUE_NAME } from '../../config';
import * as crypto from 'crypto';

export async function startCleanupExpiredAccessTokens() {
  const sessionId = crypto.randomUUID();

  const handle = await getTemporalClient().workflow.start(
    'cleanupClientSideAccessTokens',
    {
      taskQueue: TASK_QUEUE_NAME,
      workflowId: 'cleanup-client-side-access-tokens-' + sessionId,
    },
  );

  return handle.result();
}
