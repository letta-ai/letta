import registerPromiseWorker from 'promise-worker/register';
import type { GetMessagesWorkerPayload } from '../types';

registerPromiseWorker(async (message: GetMessagesWorkerPayload) => {
  const { cursor, agentId, limit, headers, url = '' } = message;

  const queryparams = new URLSearchParams();

  if (cursor) {
    queryparams.append('before', cursor);
  }

  queryparams.append('limit', limit.toString());

  queryparams.append('use_assistant_message', 'false');

  const selfUrl = self.location.href.replace('blob:', ''); // remove `blob:` from the URL

  const absolute = new URL(url || selfUrl);

  absolute.pathname = `/v1/agents/${agentId}/messages`;
  absolute.search = queryparams.toString();

  return fetch(absolute, {
    headers,
  }).then((res) => res.json());
});
