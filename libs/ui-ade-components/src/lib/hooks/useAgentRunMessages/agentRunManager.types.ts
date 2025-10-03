import type {
  LettaMessageUnion,
  LettaPing,
  LettaStopReason,
  LettaUsageStatistics,
  Run,
  SendMessageData
} from '@letta-cloud/sdk-core';

// Message types for worker communication
export type WorkerMessage =
  | { type: 'INIT'; agentId: string }
  | { type: 'SET_API_CONFIG'; agentId: string; baseUrl: string; headers: Record<string, string> }
  | { type: 'INIT_RUN_MONITOR'; agentId: string }
  | { type: 'SUBSCRIBE'; agentId: string }
  | { type: 'UNSUBSCRIBE'; agentId: string }
  | { type: 'SEND_MESSAGE'; agentId: string; payload: SendMessageData }
  | { type: 'LOAD_MORE_RUNS'; agentId: string }
  | { type: 'LOAD_MORE_MESSAGES_FROM_RUN'; agentId: string; runId: string }
  | { type: 'EDIT_MESSAGE'; agentId: string; message: LettaMessageUnion }
  | { type: 'FLUSH'; agentId: string };

export interface SerializedLoadingState {
  isLoadingRuns: boolean;
  isFetchingRuns: boolean;
  fetchingMessagesMap: Array<[string, boolean]>;
  isSendingMessage: boolean;
  isInitialLoad: boolean;
}

export interface SerializedError {
  message: string;
  name: string;
}

export interface SerializedErrorState {
  runsError: SerializedError | null;
  messageErrorsMap: Array<[string, SerializedError]>;
}

export type WorkerResponse =
  | { type: 'RUN_RESPONSES_UPDATED'; agentId: string; runResponses: RunResponse[] }
  | { type: 'LOADING_STATE_UPDATED'; agentId: string; loadingState: SerializedLoadingState }
  | { type: 'ERROR_STATE_UPDATED'; agentId: string; errorState: SerializedErrorState }
  | { type: 'ERROR'; agentId: string; error: string }
  | { type: 'SUBSCRIBED'; agentId: string }
  | { type: 'UNSUBSCRIBED'; agentId: string }
  | { type: 'FLUSHED'; agentId: string };


export type RunError =
  | { type: 'FREE_USAGE_EXCEEDED' }
  | { type: 'AGENT_LIMIT_EXCEEDED' }
  | { type: 'PREMIUM_USAGE_EXCEEDED' }
  | { type: 'RATE_LIMIT_EXCEEDED' }
  | { type: 'CREDIT_LIMIT_EXCEEDED' }
  | { type: 'INTERNAL_SERVER_ERROR' }
  | { type: 'NETWORK_ERROR' }
  | { type: 'ABORT_ERROR' }
  | { type: 'UNKNOWN' };


export interface UnknownMessage {
  id: string;
  message_type: 'unknown';
  contents: unknown;
}

export type RunResponseMessage = LettaMessageUnion | LettaStopReason | LettaUsageStatistics | LettaPing | UnknownMessage;

export interface RunResponse {
  run: Run;
  localRunId?: string;
  requestError?: RunError | null;
  messages: RunResponseMessage[];
}
