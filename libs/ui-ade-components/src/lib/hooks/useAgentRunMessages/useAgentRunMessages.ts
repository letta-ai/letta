import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useAtom } from 'jotai';
import type { LettaMessageUnion, SendMessageData } from '@letta-cloud/sdk-core';
import { useCurrentAPIHostConfig } from '@letta-cloud/utils-client';
import type { WorkerMessage, WorkerResponse, RunResponse } from './agentRunManager.types';
import {
  agentRunMessagesAtomFamily,
  tryAcquireLock,
  waitForLock,
  releaseLock,
  holdsLock,
} from './agentRunMessagesStore';
import { useCurrentAgentMetaData } from '@letta-cloud/ui-ade-components';

interface LoadingState {
  isLoadingRuns: boolean;
  isFetchingRuns: boolean;
  fetchingMessagesMap: Map<string, boolean>;
  isSendingMessage: boolean;
  isInitialLoad: boolean;
}

interface ErrorState {
  runsError: Error | null;
  messageErrorsMap: Map<string, Error>;
}

export interface UseAgentRunMessagesResponse {
  runResponses: RunResponse[];
  loadingState: LoadingState;
  errorState: ErrorState;
  loadMoreRuns: () => Promise<void>;
  loadMoreMessagesFromRun: (runId: string) => Promise<void>;
  sendMessage: (payload: SendMessageData) => void;
  editMessage: (message: LettaMessageUnion) => void;
}

export interface UseAgentRunMessagesOptions {
  agentId: string;
}

// Singleton worker instance shared across all hook instances
let workerInstance: Worker | null = null;

function getWorker(): Worker | null {
  if (!workerInstance && typeof Worker !== 'undefined') {
    workerInstance = new Worker(
      new URL('./agentRunManager.worker.ts', import.meta.url),
      { type: 'module' }
    );
  }
  return workerInstance;
}

export function useAgentRunMessages({
  agentId,
}: UseAgentRunMessagesOptions): UseAgentRunMessagesResponse {
  // Use Jotai atom for shared state across hook instances
  const [state, setState] = useAtom(agentRunMessagesAtomFamily(agentId));
  const workerRef = useRef<Worker | null>(null);

  const { isLocal } = useCurrentAgentMetaData();
  const hostConfig = useCurrentAPIHostConfig({
    isLocal,
    attachApiKey: true,
  });

  const { baseUrl, headers } = useMemo(() => {
    return {
      baseUrl: hostConfig.url,
      headers: {
        'X-SOURCE-CLIENT': window.location.pathname,
        ...isLocal ? hostConfig.headers : {},
      }
    }
  }, [hostConfig, isLocal]);

  // Generate a unique ID for this hook instance (stable across re-renders)
  const instanceIdRef = useRef(`${agentId}-${Math.random().toString(36).slice(2)}`);
  const instanceId = instanceIdRef.current;

  const hasLockRef = useRef(false);
  const isInitializingRef = useRef(false);

  useEffect(() => {
    // Don't initialize if agentId is empty
    if (!agentId) {
      return;
    }

    // Prevent multiple initializations from the same instance
    if (isInitializingRef.current) {
      return;
    }
    isInitializingRef.current = true;

    const worker = getWorker();
    if (!worker) {
      isInitializingRef.current = false;
      return;
    }
    workerRef.current = worker;

    // Listen for messages from worker (all instances listen)
    const handleWorkerMessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;

      if (response.agentId !== agentId) {
        // Ignore messages for other agents
        return;
      }

      switch (response.type) {
        case 'RUN_RESPONSES_UPDATED':
          setState((prev) => ({
            ...prev,
            runResponses: response.runResponses,
          }));
          break;
        case 'LOADING_STATE_UPDATED':
          setState((prev) => ({
            ...prev,
            loadingState: {
              isLoadingRuns: response.loadingState.isLoadingRuns,
              isFetchingRuns: response.loadingState.isFetchingRuns,
              fetchingMessagesMap: new Map(response.loadingState.fetchingMessagesMap),
              isSendingMessage: response.loadingState.isSendingMessage,
              isInitialLoad: response.loadingState.isInitialLoad,
            },
          }));
          break;
        case 'ERROR_STATE_UPDATED':
          setState((prev) => ({
            ...prev,
            errorState: {
              runsError: response.errorState.runsError
                ? new Error(response.errorState.runsError.message)
                : null,
              messageErrorsMap: new Map(
                response.errorState.messageErrorsMap.map(([runId, error]) => [
                  runId,
                  new Error(error.message),
                ])
              ),
            },
          }));
          break;
        case 'ERROR':
          console.error('Worker error:', response.error);
          break;
      }
    };

    worker.addEventListener('message', handleWorkerMessage);

    // Set API configuration (outside lock - all instances need this for sendMessage)
    const setConfigMessage: WorkerMessage = {
      type: 'SET_API_CONFIG',
      agentId,
      baseUrl,
      headers,
    };
    worker.postMessage(setConfigMessage);

    // Function to initialize worker subscription (runs only for lock holder)
    const initializeWorkerSubscription = () => {
      // Debounce initialization slightly to prevent race conditions
      setTimeout(() => {
        // Initialize manager for this agent
        const initMessage: WorkerMessage = {
          type: 'INIT',
          agentId,
        };
        worker.postMessage(initMessage);

        // Initialize run monitor (only lock holder does this)
        const initRunMonitorMessage: WorkerMessage = {
          type: 'INIT_RUN_MONITOR',
          agentId,
        };
        worker.postMessage(initRunMonitorMessage);

        // Subscribe to updates
        const subscribeMessage: WorkerMessage = {
          type: 'SUBSCRIBE',
          agentId,
        };
        worker.postMessage(subscribeMessage);
      }, 50);
    };

    // Try to acquire the lock
    if (tryAcquireLock(agentId, instanceId)) {
      hasLockRef.current = true;

      initializeWorkerSubscription();
    } else {
      // Lock is held by another instance, register to wait
      waitForLock(agentId, () => {
        // Lock transferred to us, acquire it
        if (tryAcquireLock(agentId, instanceId)) {
          hasLockRef.current = true;
          initializeWorkerSubscription();
        }
      });
    }

    // Cleanup on unmount
    return () => {
      worker.removeEventListener('message', handleWorkerMessage);

      // If we hold the lock, release it
      if (hasLockRef.current && holdsLock(agentId, instanceId)) {
        const fullyReleased = releaseLock(agentId, instanceId);

        if (fullyReleased) {
          // No one waiting, clean up worker subscription
          const unsubscribeMessage: WorkerMessage = {
            type: 'UNSUBSCRIBE',
            agentId,
          };
          worker.postMessage(unsubscribeMessage);

          const flushMessage: WorkerMessage = {
            type: 'FLUSH',
            agentId,
          };
          worker.postMessage(flushMessage);
        }
      }

      isInitializingRef.current = false;
    };
  }, [agentId, setState, baseUrl, headers, instanceId]);

  const loadMoreRuns = useCallback(async () => {
    if (!agentId) return;

    const worker = workerRef.current;
    if (!worker) return;

    const message: WorkerMessage = {
      type: 'LOAD_MORE_RUNS',
      agentId,
    };
    worker.postMessage(message);
  }, [agentId]);

  const loadMoreMessagesFromRun = useCallback(async (runId: string) => {
    if (!agentId) return;

    const worker = workerRef.current;
    if (!worker) return;

    const message: WorkerMessage = {
      type: 'LOAD_MORE_MESSAGES_FROM_RUN',
      agentId,
      runId,
    };
    worker.postMessage(message);
  }, [agentId]);

  const sendMessage = useCallback((payload: SendMessageData) => {
    if (!agentId) return;

    const worker = workerRef.current;
    if (!worker) return;

    const message: WorkerMessage = {
      type: 'SEND_MESSAGE',
      agentId,
      payload,
    };
    worker.postMessage(message);
  }, [agentId]);

  const editMessage = useCallback((messageToEdit: LettaMessageUnion) => {
    if (!agentId) return;

    const worker = workerRef.current;
    if (!worker) return;

    const message: WorkerMessage = {
      type: 'EDIT_MESSAGE',
      agentId,
      message: messageToEdit,
    };
    worker.postMessage(message);
  }, [agentId]);

  return {
    runResponses: state.runResponses,
    loadingState: state.loadingState,
    errorState: state.errorState,
    loadMoreRuns,
    loadMoreMessagesFromRun,
    sendMessage,
    editMessage,
  };
}
