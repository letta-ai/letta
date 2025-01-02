import registerPromiseWorker from 'promise-worker/register';
import type { GetMessagesWorkerPayload } from '../types';

registerPromiseWorker(async (message: GetMessagesWorkerPayload) => {
  const { cursor, agentId, limit, headers, url = '' } = message;

  const queryparams = new URLSearchParams();

  if (cursor) {
    queryparams.append('before', cursor);
  }

  queryparams.append('limit', limit.toString());

  return fetch(
    `${url}/v1/agents/${agentId}/messages?${queryparams.toString()}`,
    {
      headers,
    },
  ).then((res) => res.json());
});
