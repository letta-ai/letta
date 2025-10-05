import { useEffect, useRef, useCallback } from 'react';
import { useAtom } from 'jotai';
import type { LettaMessageUnion, SendMessageData } from '@letta-cloud/sdk-core';
import { useCurrentAPIHostConfig } from '@letta-cloud/utils-client';
import type { WorkerMessage, WorkerResponse, RunResponse } from './agentRunManager.types';
import { agentRunMessagesAtomFamily } from './agentRunMessagesStore';
import { useCurrentAgentMetaData } from '@letta-cloud/ui-ade-components';
import { workerSubscriptionManager } from './workerSubscriptionManager';
import { deepEqual } from 'fast-equals';

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

  const baseUrl = hostConfig.url;
  const baseUrlRef = useRef(baseUrl);
  const headersRef = useRef<Record<string, string>>({});

  // Update refs when config changes but don't trigger re-subscription
  useEffect(() => {
    baseUrlRef.current = baseUrl;
    headersRef.current = {
      'X-SOURCE-CLIENT': window.location.pathname,
      ...isLocal ? hostConfig.headers : {},
    };
  }, [baseUrl, hostConfig.headers, isLocal]);

  useEffect(() => {
    // Don't initialize if agentId is empty
    if (!agentId) {
      return;
    }


    // Subscribe through the singleton manager
    const result = workerSubscriptionManager.subscribe(
      agentId,
      baseUrlRef.current,
      headersRef.current
    );
    if (!result) {
      return;
    }

    const { worker } = result;
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


          setState((prev) => {
            if (deepEqual(prev.runResponses, response.runResponses)) {
              return prev;
            }

            return ({
              ...prev,
              runResponses: response.runResponses,
            })
          });
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

    // Cleanup on unmount
    return () => {
      worker.removeEventListener('message', handleWorkerMessage);
      workerSubscriptionManager.unsubscribe(agentId);
    };
  }, [agentId, setState]);

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
