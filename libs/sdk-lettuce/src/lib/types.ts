export interface MigrateAgentsPayload {
  memoryVariables?: Record<string, string>;
  preserveCoreMemories?: boolean;
  preserveToolVariables?: boolean;
  agentIds?: string[];
  template: string;
  coreUserId: string;
  organizationId: string;
  batchConfig?: MigrationBatchConfig;
}

export interface MigrationBatchConfig {
  agentFetchBatchSize?: number; // Number of agents to fetch per API call (default: 50)
  workflowBatchSize?: number; // Number of agents to process concurrently (default: 10)
  maxRetries?: number; // Maximum retries for failed batches (default: 3)
}

export interface MigrateAgentPayload {
  memoryVariables?: Record<string, string>;
  preserveCoreMemories?: boolean;
  preserveToolVariables?: boolean;
  agentId: string;
  template: string;
  coreUserId: string;
  organizationId: string;
}

export interface DeleteExpiredTokensAndUsersResult {
  expiredTokens: number;
  deletedTokens: number;
  deletedUsers: number;
  failedUserIds: string[];
}
