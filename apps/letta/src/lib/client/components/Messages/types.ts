export interface GetMessagesWorkerPayload {
  cursor?: string;
  limit: number;
  agentId: string;
}
