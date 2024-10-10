'use client';
import { useCallback, useEffect, useRef } from 'react';
import type { WorkerPayload, WorkerResponse } from '../../types';

interface WorkerOptions {
  onMessage: (message: MessageEvent<WorkerResponse>) => void;
}

export function useCoreMemorySummaryWorker(options: WorkerOptions) {
  const workerRef = useRef<Worker | null>(null);
  const { onMessage } = options;

  useEffect(() => {
    workerRef.current = new Worker(
      new URL(
        '../../workers/computeCoreMemorySummaryWorker/computeCoreMemorySummaryWorker.ts',
        import.meta.url
      )
    );

    workerRef.current.onmessage = onMessage;

    workerRef.current.onerror = (error) => {
      console.error(error);
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, [onMessage]);

  const postMessage = useCallback((message: WorkerPayload) => {
    workerRef.current?.postMessage(message);
  }, []);

  return {
    postMessage,
  };
}
