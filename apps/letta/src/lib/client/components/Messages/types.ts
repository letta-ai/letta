export interface GetMessagesWorkerPayload {
  cursor?: string;
  limit: number;
  agentId: string;
  url?: string;
  headers?: Record<string, string>;
}
