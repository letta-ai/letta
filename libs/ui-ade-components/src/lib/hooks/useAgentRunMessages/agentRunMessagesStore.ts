import { atom } from 'jotai';
import { atomFamily } from 'jotai/utils';
import type { RunResponse } from './agentRunManager.types';

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

interface AgentRunMessagesState {
  agentId: string;
  runResponses: RunResponse[];
  loadingState: LoadingState;
  errorState: ErrorState;
}

// Atom family for per-agentId state
// atomFamily creates a function that takes agentId and returns an atom
export const agentRunMessagesAtomFamily = atomFamily((agentId: string) => {
  const initialState: AgentRunMessagesState = {
    agentId,
    runResponses: [],
    loadingState: {
      isLoadingRuns: false,
      isFetchingRuns: false,
      fetchingMessagesMap: new Map(),
      isSendingMessage: false,
      isInitialLoad: true,
    },
    errorState: {
      runsError: null,
      messageErrorsMap: new Map(),
    },
  };

  return atom<AgentRunMessagesState>(initialState);
});
