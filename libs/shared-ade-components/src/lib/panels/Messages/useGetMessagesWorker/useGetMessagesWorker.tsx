'use client';
import { useCallback } from 'react';

import PromiseWorker from 'promise-worker';
import type { ListAgentMessagesResponse } from '@letta-web/letta-agents-api';
import type { GetMessagesWorkerPayload } from '../types';

let worker: Worker;

if (typeof Worker !== 'undefined') {
  worker = new Worker(new URL('./getMessagesWorker.ts', import.meta.url), {
    type: 'module',
  });
}

export function useGetMessagesWorker() {
  const getMessages = useCallback(
    async (
      message: GetMessagesWorkerPayload,
    ): Promise<ListAgentMessagesResponse> => {
      const promiseWorker = new PromiseWorker(worker);

      return promiseWorker.postMessage(message);
    },
    [],
  );

  return {
    getMessages,
  };
}
