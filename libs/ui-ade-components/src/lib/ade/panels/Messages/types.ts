export interface GetMessagesWorkerPayload {
  cursor?: string;
  limit: number;
  agentId: string;
  url?: string;
  headers?: Record<string, string>;
  includeErr?: boolean;
}

export type MessagesDisplayMode = 'debug' | 'interactive' | 'simple';
