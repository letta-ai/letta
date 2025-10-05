import AgentRunManager from './agentRunManager';
import type { WorkerMessage, WorkerResponse } from './agentRunManager.types';

// Store active subscriptions per agent
const subscriptions = new Map<string, () => void>();

// Handle messages from the main thread
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  console.log(message)

  try {
    switch (message.type) {
      case 'INIT': {
        // Initialize manager for this agent
        AgentRunManager.getInstance(message.agentId);
        break;
      }

      case 'SET_API_CONFIG': {
        const manager = AgentRunManager.getInstance(message.agentId);
        manager.setApiConfig(message.baseUrl, message.headers);
        break;
      }

      case 'INIT_RUN_MONITOR': {
        const manager = AgentRunManager.getInstance(message.agentId);
        manager.initializeRunMonitor();
        break;
      }

      case 'SUBSCRIBE': {
        const manager = AgentRunManager.getInstance(message.agentId);

        // Unsubscribe existing subscriptions if any
        const existingUnsubscribe = subscriptions.get(message.agentId);
        if (existingUnsubscribe) {
          existingUnsubscribe();
        }

        // Subscribe to run response updates
        const unsubscribeRunResponses = manager.subscribeToRunResponses((runResponses) => {
          const response: WorkerResponse = {
            type: 'RUN_RESPONSES_UPDATED',
            agentId: message.agentId,
            runResponses,
          };
          self.postMessage(response);
        });

        // Subscribe to loading state updates
        const unsubscribeLoadingState = manager.subscribeToLoadingState((state) => {
          const response: WorkerResponse = {
            type: 'LOADING_STATE_UPDATED',
            agentId: message.agentId,
            loadingState: {
              isLoadingRuns: state.isLoadingRuns,
              isFetchingRuns: state.isFetchingRuns,
              fetchingMessagesMap: Array.from(state.fetchingMessagesMap.entries()),
              isSendingMessage: state.isSendingMessage,
              isInitialLoad: state.isInitialLoad,
            },
          };
          self.postMessage(response);
        });

        // Subscribe to error state updates
        const unsubscribeErrorState = manager.subscribeToErrorState((state) => {
          const response: WorkerResponse = {
            type: 'ERROR_STATE_UPDATED',
            agentId: message.agentId,
            errorState: {
              runsError: state.runsError ? { message: state.runsError.message, name: state.runsError.name } : null,
              messageErrorsMap: Array.from(state.messageErrorsMap.entries()).map(([runId, error]) => [
                runId,
                { message: error.message, name: error.name },
              ]),
            },
          };
          self.postMessage(response);
        });

        // Store combined unsubscribe function
        subscriptions.set(message.agentId, () => {
          unsubscribeRunResponses();
          unsubscribeLoadingState();
          unsubscribeErrorState();
        });

        const response: WorkerResponse = {
          type: 'SUBSCRIBED',
          agentId: message.agentId,
        };
        self.postMessage(response);
        break;
      }

      case 'UNSUBSCRIBE': {
        const unsubscribe = subscriptions.get(message.agentId);
        if (unsubscribe) {
          unsubscribe();
          subscriptions.delete(message.agentId);
        }

        const response: WorkerResponse = {
          type: 'UNSUBSCRIBED',
          agentId: message.agentId,
        };
        self.postMessage(response);
        break;
      }

      case 'SEND_MESSAGE': {
        const manager = AgentRunManager.getInstance(message.agentId);
        await manager.sendMessage(message.payload);
        break;
      }

      case 'LOAD_MORE_RUNS': {
        const manager = AgentRunManager.getInstance(message.agentId);
        await manager.loadMoreRuns();
        break;
      }

      case 'LOAD_MORE_MESSAGES_FROM_RUN': {
        const manager = AgentRunManager.getInstance(message.agentId);
        await manager.loadMoreMessagesFromRun(message.runId);
        break;
      }

      case 'EDIT_MESSAGE': {
        const manager = AgentRunManager.getInstance(message.agentId);
        manager.editMessage(message.message);
        break;
      }

      case 'FLUSH': {
        const unsubscribe = subscriptions.get(message.agentId);
        if (unsubscribe) {
          unsubscribe();
          subscriptions.delete(message.agentId);
        }

        const manager = AgentRunManager.getInstance(message.agentId);
        manager.flush();

        const response: WorkerResponse = {
          type: 'FLUSHED',
          agentId: message.agentId,
        };
        self.postMessage(response);
        break;
      }

      default:
        console.warn('Unknown message type:', message);
    }
  } catch (error) {
    const response: WorkerResponse = {
      type: 'ERROR',
      agentId: message.agentId,
      error: error instanceof Error ? error.message : String(error),
    };
    self.postMessage(response);
  }
};
