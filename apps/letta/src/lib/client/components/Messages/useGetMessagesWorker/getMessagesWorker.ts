import type { GetMessagesWorkerPayload } from '$letta/client/components/Messages/types';
import registerPromiseWorker from 'promise-worker/register';

registerPromiseWorker(async (message: GetMessagesWorkerPayload) => {
  const { cursor, agentId, limit } = message;

  const queryparams = new URLSearchParams();

  if (cursor) {
    queryparams.append('before', cursor);
  }

  queryparams.append('limit', limit.toString());

  return fetch(`/v1/agents/${agentId}/messages?${queryparams.toString()}`).then(
    (res) => res.json()
  );
});
