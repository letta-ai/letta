export interface MigrateAgentsPayload {
  memoryVariables?: Record<string, string>;
  preserveCoreMemories?: boolean;
  preserveToolVariables?: boolean;
  agentIds?: string[];
  template: string;
  coreUserId: string;
  organizationId: string;
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
