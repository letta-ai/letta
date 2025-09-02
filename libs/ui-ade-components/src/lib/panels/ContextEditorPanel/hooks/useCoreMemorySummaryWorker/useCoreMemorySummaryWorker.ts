'use client';
import 'remote-web-worker';
import { useCallback, useEffect } from 'react';
import type {
  ComputeCoreMemoryWorkerPayload,
  WorkerResponse,
} from '../../types';

interface WorkerOptions {
  onMessage: (message: MessageEvent<WorkerResponse>) => void;
}

let worker: Worker;

if (typeof Worker !== 'undefined') {
  worker = new Worker(
    new URL(
      '../../workers/computeCoreMemorySummaryWorker/computeCoreMemorySummaryWorker.ts',
      import.meta.url,
    ),
  );
}

export function useCoreMemorySummaryWorker(options: WorkerOptions) {
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

  const postMessage = useCallback((message: ComputeCoreMemoryWorkerPayload) => {
    worker.postMessage(message);
  }, []);

  return {
    postMessage,
  };
}
