export interface MigrateAgentsPayload {
  memoryVariables?: Record<string, string>;
  preserveCoreMemories?: boolean;
  agentIds?: string[];
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
