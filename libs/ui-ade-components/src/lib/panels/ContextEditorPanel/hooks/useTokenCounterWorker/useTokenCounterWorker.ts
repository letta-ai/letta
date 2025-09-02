'use client';
import 'remote-web-worker';
import { useCallback, useEffect } from 'react';
import type {
  ComputeTokenCountWorkerPayload,
  WorkerResponse,
} from '../../types';

interface WorkerOptions {
  onMessage: (message: MessageEvent<WorkerResponse>) => void;
}

let worker: Worker;

if (typeof Worker !== 'undefined') {
  worker = new Worker(
    new URL(
      '../../workers/computeTokenCountWorker/computeTokenCountWorker.ts',
      import.meta.url,
    ),
  );
}

export function useTokenCounterWorker(options: WorkerOptions) {
  const { onMessage } = options;

  useEffect(() => {
    worker.onmessage = onMessage;

    worker.onerror = (error) => {
      console.error(error);
    };

    return () => {
      worker.onmessage = null;
      worker.onerror = null;
    };
  }, [onMessage]);

  const postMessage = useCallback((message: ComputeTokenCountWorkerPayload) => {
    worker.postMessage(message);
  }, []);

  return {
    postMessage,
  };
}
