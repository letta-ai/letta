'use client';
import { useCallback } from 'react';

import type { GetMessagesWorkerPayload } from '$web/client/components/Messages/types';
import PromiseWorker from 'promise-worker';
import type { ListAgentMessagesResponse } from '@letta-web/letta-agents-api';

let worker: Worker;

if (typeof Worker !== 'undefined') {
  worker = new Worker(new URL('./getMessagesWorker.ts', import.meta.url));
}

export function useGetMessagesWorker() {
  const getMessages = useCallback(
    async (
      message: GetMessagesWorkerPayload
    ): Promise<ListAgentMessagesResponse> => {
      const promiseWorker = new PromiseWorker(worker);

      return promiseWorker.postMessage(message);
    },
    []
  );

  return {
    getMessages,
  };
}
